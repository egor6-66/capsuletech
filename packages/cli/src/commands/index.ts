import { CATEGORY_ICONS } from '../cli/tui/icons';
import type { CliContext } from '../context';
import { buildCommands } from './build';
import { createCommands } from './create';
import { desktopCommands } from './desktop';
import { devCommands } from './dev';
import { gitCommands } from './git';
import { buildNavigationCommands } from './navigation';
import { nxCommands } from './nx';
import { releaseCommands } from './release';
import { type Category, type Command, matchesScope } from './types';
import { workspaceCommands } from './workspace';

export * from './types';

/** Команды, известные на этапе регистрации (commander). */
export const staticCommands: Command[] = [
  ...createCommands,
  ...devCommands,
  ...buildCommands,
  ...desktopCommands,
  ...workspaceCommands,
  ...gitCommands,
  ...releaseCommands,
  ...nxCommands,
];

/** Все команды для данного ctx, включая динамически собранные (open project). */
export const collectCommands = (ctx: CliContext): Command[] => [
  ...staticCommands.filter((c) => matchesScope(c, ctx.type)),
  ...buildNavigationCommands(ctx),
];

export const CATEGORY_META: Record<Category, { icon: string; label: string; order: number }> = {
  create: { icon: CATEGORY_ICONS.create, label: 'Create', order: 1 },
  dev: { icon: CATEGORY_ICONS.dev, label: 'Dev', order: 2 },
  workspace: { icon: CATEGORY_ICONS.workspace, label: 'Workspace', order: 3 },
  git: { icon: CATEGORY_ICONS.git, label: 'Git', order: 4 },
  release: { icon: CATEGORY_ICONS.release, label: 'Release', order: 5 },
  nx: { icon: CATEGORY_ICONS.nx, label: 'Nx', order: 6 },
  navigation: { icon: CATEGORY_ICONS.navigation, label: 'Navigate', order: 7 },
};

export const groupByCategory = (cmds: Command[]): Map<Category, Command[]> => {
  const map = new Map<Category, Command[]>();
  for (const cmd of cmds) {
    if (!map.has(cmd.category)) map.set(cmd.category, []);
    map.get(cmd.category)!.push(cmd);
  }
  return new Map(
    [...map.entries()].sort(([a], [b]) => CATEGORY_META[a].order - CATEGORY_META[b].order),
  );
};

export const findCommandById = (id: string): Command | undefined =>
  staticCommands.find((c) => c.id === id);
