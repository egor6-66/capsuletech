import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execa } from 'execa';
import type { CommandAction } from '../commands/types';
import { listWorkspaceChildren } from '../context';
import { kit } from '../kit';

const readJson = <T = unknown>(path: string): T | null => {
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as T;
  } catch {
    return null;
  }
};

export const workspaceInfo: CommandAction = async (ctx) => {
  if (!ctx.root) return;

  const apps = listWorkspaceChildren(ctx.root, 'apps');
  const libs = listWorkspaceChildren(ctx.root, 'packages');
  const pkg = readJson<{ name?: string; version?: string }>(join(ctx.root, 'package.json'));

  let branch = '?';
  try {
    const { stdout } = await execa('git', ['branch', '--show-current'], { cwd: ctx.root });
    branch = stdout.trim() || '?';
  } catch {
    /* not a git repo */
  }

  kit.note(
    [
      `root:     ${ctx.root}`,
      `name:     ${pkg?.name ?? '—'}`,
      `version:  ${pkg?.version ?? '—'}`,
      `branch:   ${branch}`,
      `mode:     ${ctx.mode}`,
      `apps:     ${apps.length}${apps.length ? ` — ${apps.join(', ')}` : ''}`,
      `packages: ${libs.length}${libs.length ? ` — ${libs.slice(0, 5).join(', ')}${libs.length > 5 ? '…' : ''}` : ''}`,
    ].join('\n'),
    'Workspace',
  );
};
