import { desktopBuild, desktopDev } from '../actions/desktop';
import { ICONS } from '../cli/tui/icons';
import type { Command } from './types';

export const desktopCommands: Command[] = [
  {
    id: 'desktop.dev',
    label: `${ICONS.desktopDev} Desktop dev`,
    icon: ICONS.desktopDev,
    description: 'Запустить Tauri-shell поверх dev-сервера (сначала: capsule dev в другом окне)',
    scope: ['app'],
    category: 'dev',
    params: [
      {
        name: 'url',
        description: 'URL Vite dev-сервера',
        prompt: {
          type: 'input',
          message: 'URL dev-сервера',
          placeholder: 'http://localhost:3000',
        },
      },
    ],
    action: desktopDev,
  },
  {
    id: 'desktop.build',
    label: `${ICONS.desktopBuild} Desktop build`,
    icon: ICONS.desktopBuild,
    description: 'Собрать MSI/NSIS-инсталлятор через Tauri (требует свежий capsule build)',
    scope: ['app'],
    category: 'dev',
    params: [
      {
        name: 'version',
        description: 'Версия бандла (semver без префикса v)',
        prompt: {
          type: 'input',
          message: 'Версия',
          placeholder: '0.0.1',
        },
      },
    ],
    action: desktopBuild,
  },
];
