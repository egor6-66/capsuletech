import { nxAffected, nxGraph, nxProjects, nxReport, nxRun } from '../actions';
import { ICONS } from '../cli/tui/icons';
import type { Command } from './types';

const WORKSPACE_SCOPE = ['workspace-root', 'app', 'lib', 'workspace-inner'] as const;

export const nxCommands: Command[] = [
  {
    id: 'nx.projects',
    label: `${ICONS.projects} Projects`,
    icon: ICONS.projects,
    description: 'Список всех проектов workspace (nx show projects)',
    scope: [...WORKSPACE_SCOPE],
    category: 'nx',
    action: nxProjects,
  },
  {
    id: 'nx.affected',
    label: `${ICONS.affected} Affected`,
    icon: ICONS.affected,
    description: 'Проекты, затронутые относительно ветки main',
    scope: [...WORKSPACE_SCOPE],
    category: 'nx',
    action: nxAffected,
  },
  {
    id: 'nx.graph',
    label: `${ICONS.graph} Graph`,
    icon: ICONS.graph,
    description: 'Открыть интерактивный граф зависимостей в браузере',
    scope: [...WORKSPACE_SCOPE],
    category: 'nx',
    action: nxGraph,
  },
  {
    id: 'nx.report',
    label: `${ICONS.report} Report`,
    icon: ICONS.report,
    description: 'Версии nx и установленных плагинов',
    scope: [...WORKSPACE_SCOPE],
    category: 'nx',
    action: nxReport,
  },
  {
    id: 'nx.run',
    label: `${ICONS.runTarget} Run target`,
    icon: ICONS.runTarget,
    description: 'Выполнить nx-таргет: <project>:<task>',
    scope: [...WORKSPACE_SCOPE],
    category: 'nx',
    params: [
      {
        name: 'target',
        description: 'project:target, например @capsuletech/cli:build',
        positional: true,
        required: true,
        prompt: {
          type: 'input',
          message: 'project:target',
          placeholder: '@capsuletech/cli:build',
        },
      },
    ],
    action: nxRun,
  },
];
