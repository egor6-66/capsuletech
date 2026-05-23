import type { IRow, LayoutPresets } from '../interfaces';
import { appShellResolver } from './app-shell';

type PresetResolver<P extends keyof LayoutPresets> = (slots: LayoutPresets[P]) => IRow[];

/**
 * Built-in preset registry.
 * `satisfies` гарантирует полноту: при добавлении нового ключа в LayoutPresets
 * TS укажет, что resolver отсутствует.
 */
const PRESETS = {
  'app-shell': appShellResolver,
} satisfies { [P in keyof LayoutPresets]: PresetResolver<P> };

/**
 * Резолвит именованный пресет в массив IRow[].
 *
 * @throws Error если пресет не зарегистрирован.
 */
export const resolvePreset = <P extends keyof LayoutPresets>(
  name: P,
  slots: LayoutPresets[P],
): IRow[] => {
  const resolver = PRESETS[name] as PresetResolver<P> | undefined;
  if (!resolver) throw new Error(`Matrix: unknown preset '${name}'`);
  return resolver(slots);
};

export { appShellResolver };
