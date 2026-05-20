import type { Preview } from 'storybook-solidjs-vite';

import './preview.css';

// Eager-импорт всех тем — CSS попадает в preview-бандл, имена идут в toolbar.
// Тот же приём использует ThemeSwitcher в @capsuletech/web-style/switcher.
const themeModules = import.meta.glob('../../style/src/themes/*.css', { eager: true });
const THEMES = Object.keys(themeModules)
  .map((p) => p.match(/([^/]+)\.css$/)?.[1] ?? '')
  .filter((n) => n && n !== 'index')
  .sort();

const DEFAULT_THEME = THEMES[0] ?? 'black';

const preview: Preview = {
  parameters: {
    backgrounds: {
      default: 'dark',
      values: [
        { name: 'dark', value: 'oklch(0.145 0 0)' },
        { name: 'light', value: 'oklch(1 0 0)' },
      ],
    },
  },
  /**
   * Глобальный toolbar-переключатель темы. Storybook сам кладёт выбранное
   * значение в `context.globals.theme`; декоратор внизу выставляет
   * `data-theme` на `<html>` — CSS-переменные подменяются автоматически
   * (см. packages/web/style/src/themes/*.css).
   */
  globalTypes: {
    theme: {
      name: 'Theme',
      description: 'Capsule UI theme',
      defaultValue: DEFAULT_THEME,
      toolbar: {
        icon: 'paintbrush',
        items: THEMES.map((value) => ({ value, title: value })),
        dynamicTitle: true,
      },
    },
  },
  decorators: [
    (Story, context) => {
      document.documentElement.classList.add('dark');
      const theme = (context.globals.theme as string | undefined) ?? DEFAULT_THEME;
      document.documentElement.setAttribute('data-theme', theme);
      return Story();
    },
  ],
};

export default preview;
