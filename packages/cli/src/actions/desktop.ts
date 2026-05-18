import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { execa } from 'execa';
import type { CommandAction } from '../commands/types';
import { kit } from '../kit';

const requireApp = (
  ctx: Parameters<CommandAction>[0],
): ctx is Parameters<CommandAction>[0] & { name: string; root: string } => {
  if (ctx.type !== 'app' || !ctx.root || !ctx.name) {
    kit.log.error('Desktop-команды запускаются только внутри apps/<name>/');
    return false;
  }
  return true;
};

const resolveScript = (root: string): string | null => {
  const p = join(root, 'scripts', 'desktop.mjs');
  if (!existsSync(p)) {
    kit.log.error(`Не нашёл ${p}`);
    return null;
  }
  return p;
};

const runDesktop = async (
  ctx: Parameters<CommandAction>[0],
  action: 'dev' | 'build',
  params: Record<string, unknown>,
): Promise<void> => {
  if (!requireApp(ctx)) return;
  const script = resolveScript(ctx.root);
  if (!script) return;

  const flags: string[] = [];
  if (typeof params.url === 'string') flags.push(`--url=${params.url}`);
  if (typeof params.dist === 'string') flags.push(`--dist=${params.dist}`);
  if (typeof params.version === 'string') flags.push(`--version=${params.version}`);

  await execa('node', [script, action, ctx.name, ...flags], {
    cwd: ctx.root,
    stdio: 'inherit',
  });
};

export const desktopDev: CommandAction = (ctx, params) => runDesktop(ctx, 'dev', params);
export const desktopBuild: CommandAction = (ctx, params) => runDesktop(ctx, 'build', params);
