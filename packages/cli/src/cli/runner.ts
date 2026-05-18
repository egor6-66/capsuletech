import type { Command, CommandParam } from '../commands';
import type { CliContext } from '../context';
import { kit } from '../kit';

const askParam = async (param: CommandParam): Promise<unknown> => {
  if (!param.prompt) return undefined;
  if (param.prompt.type === 'input') {
    const value = await kit.input(
      param.prompt.message,
      param.prompt.placeholder,
      (v) => param.validate?.(v) ?? '',
    );
    return value;
  }
  if (param.prompt.type === 'confirm') {
    return await kit.confirm(param.prompt.message);
  }
  if (param.prompt.type === 'select') {
    return await kit.select(param.prompt.message, param.prompt.options());
  }
  return undefined;
};

/**
 * Соединяет staticParams + provided + интерактивные промпты в единый объект,
 * который уходит в `command.action(ctx, params)`. Поэтому одну action можно
 * звать и из TUI, и из commander — params собираются по одинаковому контракту.
 */
export const resolveParams = async (
  cmd: Command,
  provided: Record<string, unknown> = {},
): Promise<Record<string, unknown> | null> => {
  const out: Record<string, unknown> = { ...cmd.staticParams };
  for (const param of cmd.params ?? []) {
    if (out[param.name] !== undefined) continue;
    if (provided[param.name] !== undefined) {
      out[param.name] = provided[param.name];
      continue;
    }
    const value = await askParam(param);
    if (value === undefined || value === null || value === '') {
      if (param.required) return null;
      if (param.default !== undefined) out[param.name] = param.default;
      continue;
    }
    out[param.name] = value;
  }
  return out;
};

export const runCommand = async (
  cmd: Command,
  ctx: CliContext,
  provided: Record<string, unknown> = {},
): Promise<void> => {
  const params = await resolveParams(cmd, provided);
  if (params === null) {
    kit.log.warn('Отменено.');
    return;
  }
  try {
    await cmd.action(ctx, params);
  } catch (err) {
    kit.log.error(err instanceof Error ? err.message : String(err));
  }
};
