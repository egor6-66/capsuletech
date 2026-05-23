import { desktopBuild, desktopDev } from '../actions/desktop';
import { ICONS } from '../cli/tui/icons';
import type { Command } from './types';

export const desktopCommands: Command[] = [
  {
    id: 'desktop.dev',
    label: `${ICONS.desktopDev} Desktop dev`,
    icon: ICONS.desktopDev,
    description:
      'Запустить Tauri-shell поверх dev-сервера (сначала: capsule dev в другом окне). URL берётся из capsule.config.ts → devServerPort или http://localhost:3000.',
    scope: ['app'],
    category: 'dev',
    params: [
      {
        name: 'url',
        description: 'URL Vite dev-сервера (дефолт: http://localhost:<devServerPort ?? 3000>)',
        required: false,
      },
    ],
    action: desktopDev,
  },
  {
    id: 'desktop.build',
    label: `${ICONS.desktopBuild} Desktop build`,
    icon: ICONS.desktopBuild,
    description:
      'Собрать MSI/NSIS-инсталлятор через Tauri (требует свежий capsule build). Версия берётся из apps/<name>/package.json:version.',
    scope: ['app'],
    category: 'dev',
    params: [
      {
        name: 'version',
        description: 'Версия бандла semver (дефолт: package.json:version ?? 0.0.0)',
        required: false,
      },
      {
        name: 'dist',
        description:
          'Путь к dist относительно workspace root (дефолт: apps/<name>/dist)',
        required: false,
      },
    ],
    action: desktopBuild,
  },
];
