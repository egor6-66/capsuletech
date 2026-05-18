import { goToRoot, openProject } from '../actions';
import { ICONS } from '../cli/tui/icons';
import type { CliContext } from '../context';
import { listWorkspaceChildren } from '../context';
import type { Command } from './types';

/**
 * Навигационные команды строятся динамически от ctx: для каждого app/lib в
 * workspace создаётся отдельный пункт «открыть». Эти команды доступны только
 * через TUI — в commander они не регистрируются (там просто `cd`).
 */
export const buildNavigationCommands = (ctx: CliContext): Command[] => {
  if (!ctx.root) return [];

  const cmds: Command[] = [];

  if (ctx.type === 'workspace-root' || ctx.type === 'workspace-inner') {
    for (const name of listWorkspaceChildren(ctx.root, 'apps')) {
      cmds.push({
        id: `open.app.${name}`,
        label: `${ICONS.navApp} ${name}`,
        icon: ICONS.navApp,
        description: `Перейти в apps/${name}`,
        scope: ['workspace-root', 'workspace-inner'],
        category: 'navigation',
        staticParams: { dir: 'apps', name },
        action: openProject,
      });
    }
    for (const name of listWorkspaceChildren(ctx.root, 'packages')) {
      cmds.push({
        id: `open.lib.${name}`,
        label: `${ICONS.navLib} ${name}`,
        icon: ICONS.navLib,
        description: `Перейти в packages/${name}`,
        scope: ['workspace-root', 'workspace-inner'],
        category: 'navigation',
        staticParams: { dir: 'packages', name },
        action: openProject,
      });
    }
  }

  if (ctx.type === 'app' || ctx.type === 'lib') {
    cmds.push({
      id: 'open.root',
      label: `${ICONS.navBack} Вернуться в корень workspace`,
      icon: ICONS.navBack,
      description: 'cd до workspace root',
      scope: ['app', 'lib'],
      category: 'navigation',
      action: goToRoot,
    });
  }

  return cmds;
};
