import type { Category } from '../../commands/types';

/**
 * Иконки TUI — curated double-width эмодзи **без** VS16 (U+FE0F).
 *
 * Почему не `figures`: width-1 геометрические глифы (◆ ◇ ☰ ★) выглядят как
 * математические символы, а не как иконки. Юзер хочет «красиво» — это эмодзи.
 *
 * Почему именно такой набор: используем **только** code points с
 * Emoji_Presentation=Yes (RGI emoji). У них:
 *  - `string-width` всегда возвращает 2,
 *  - современные терминалы (Windows Terminal, iTerm2, WezTerm, Konsole,
 *    Alacritty, GNOME Terminal) рендерят их как 2 ячейки,
 *  - НЕ нужен VS16-модификатор — он же был источником съезда разделителей
 *    у `🕸️`, `▶️`, `◀️`, `⬆️`, `🎛️` и прочих default-text глифов.
 *
 * Правило: добавляешь иконку → она ДОЛЖНА быть default-emoji (RGI Emoji_Presentation).
 * Список — https://unicode.org/Public/emoji/15.0/emoji-data.txt (поле
 * `Emoji_Presentation`). Не угадывай — проверяй.
 *
 * См. memory: feedback_cli_icons.
 */

export const CATEGORY_ICONS: Record<Category, string> = {
  create: '✨',
  dev: '🚀',
  workspace: '📂',
  git: '🌿',
  release: '📦',
  nx: '🧩',
  navigation: '🧭',
};

export const ICONS = {
  // create
  workspaceNew: '🆕',
  app: '📱',
  lib: '📦',

  // dev
  devServer: '🚀',
  buildApp: '🏗️',
  desktopDev: '💻',
  desktopBuild: '📀',

  // workspace
  info: '💡',

  // git
  status: '📊',
  branches: '🌳',
  switch: '🔀',
  createBranch: '🌱',
  pull: '📥',
  push: '📤',
  sync: '🔄',
  syncMain: '🆙',
  pr: '🚢',
  cleanMerged: '🧹',
  commit: '💾',
  log: '📜',

  // nx
  projects: '📋',
  affected: '🔥',
  graph: '🌐',
  report: '🧾',
  runTarget: '🎯',

  // release
  plan: '🔍',
  release: '📦',
  tags: '🔖',

  // navigation
  navApp: '📱',
  navLib: '📦',
  navBack: '🔙',

  // ui markers (width-1 ASCII/text — без эмодзи, не мешают padToWidth)
  pointerActive: '▸',
  pointerUp: '↑',
  pointerDown: '↓',
  enter: '↵',
} as const;
