import type { JSX } from 'solid-js';

export interface IThemePickerProps {
  /**
   * Override the available theme list.
   * Defaults to `DISCOVERED_THEMES` from @capsuletech/web-style (all CSS files
   * under the themes/ directory, sorted alphabetically).
   */
  themes?: readonly string[];
  /** Optional DOM target for applying the theme (defaults to documentElement). */
  target?: HTMLElement;
  /** Called after a theme is selected with the new theme name. */
  onChange?: (theme: string) => void;
  /**
   * Custom label for the dropdown trigger.
   * Defaults to "Theme: <currentThemeName>".
   */
  triggerLabel?: string | JSX.Element;
  /** Extra CSS classes forwarded to the trigger button. */
  class?: string;
  /**
   * Render mode.
   *  - `'standalone'` (default) — own `<Dropdown>` root + Trigger + Content.
   *    Используется как полностью самостоятельный widget (settings page,
   *    toolbar, etc.).
   *  - `'sub'` — `<Dropdown.Sub>` + `SubTrigger` + `SubContent`. Используется
   *    ВНУТРИ другого `<Dropdown.Content>` как nested submenu (header menu,
   *    context menu и т.п.). Открытие/закрытие синхронизировано с parent
   *    через Kobalte context — без конфликта focus / outside-click.
   */
  mode?: 'standalone' | 'sub';
}
