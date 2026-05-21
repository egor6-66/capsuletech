import { createApp, createLayer, createLib, createWorkspace } from '../actions';
import { ICONS } from '../cli/tui/icons';
import { LAYER_ICONS, LAYER_LABELS, type Layer } from '../templates/layers';
import type { Command } from './types';

const layerCommand = (layer: Layer): Command => ({
  id: `create.${LAYER_LABELS[layer].toLowerCase()}`,
  label: `${LAYER_ICONS[layer]} ${LAYER_LABELS[layer]}`,
  icon: LAYER_ICONS[layer],
  description: `Создать ${LAYER_LABELS[layer]} в текущем приложении`,
  scope: ['app'],
  category: 'create',
  staticParams: { layer },
  params: [
    {
      name: 'name',
      description:
        'Имя в kebab-case, `/` для вложенности (_auth/login → src/<layer>/_auth/login.tsx)',
      positional: true,
      required: true,
      prompt: {
        type: 'input',
        message: `Имя ${LAYER_LABELS[layer]} (kebab-case, '/' = вложенность)`,
        placeholder: `my-${layer.slice(0, -1)}`,
      },
      validate: (v) =>
        /^[a-z][a-z0-9-]*(\/[a-z][a-z0-9-]*)*$/.test(v)
          ? undefined
          : 'kebab-case, опционально `/` для вложенности',
    },
  ],
  action: createLayer,
});

export const createCommands: Command[] = [
  {
    id: 'create.workspace',
    label: `${ICONS.workspaceNew} Workspace`,
    icon: ICONS.workspaceNew,
    description: 'Создать новый capsule-workspace в текущей папке',
    scope: ['no-workspace'],
    category: 'create',
    action: createWorkspace,
  },
  {
    id: 'create.app',
    label: `${ICONS.app} App`,
    icon: ICONS.app,
    description: 'Создать новое приложение в apps/',
    scope: ['workspace-root'],
    category: 'create',
    params: [
      {
        name: 'name',
        description: 'Имя приложения в kebab-case',
        positional: true,
        prompt: {
          type: 'input',
          message: 'Имя app (kebab-case)',
          placeholder: 'my-app',
        },
        validate: (v) =>
          /^[a-z][a-z0-9-]*$/.test(v) ? undefined : 'kebab-case, начинается с буквы',
      },
    ],
    action: createApp,
  },
  {
    id: 'create.lib',
    label: `${ICONS.lib} Lib`,
    icon: ICONS.lib,
    description: 'Создать новую библиотеку в packages/',
    scope: ['workspace-root'],
    category: 'create',
    params: [
      {
        name: 'name',
        description: 'Имя библиотеки в kebab-case',
        positional: true,
        prompt: {
          type: 'input',
          message: 'Имя lib (kebab-case)',
          placeholder: 'my-lib',
        },
        validate: (v) =>
          /^[a-z][a-z0-9-]*$/.test(v) ? undefined : 'kebab-case, начинается с буквы',
      },
    ],
    action: createLib,
  },
  layerCommand('pages'),
  layerCommand('views'),
  layerCommand('controllers'),
  layerCommand('features'),
  layerCommand('widgets'),
  layerCommand('shapes'),
];
