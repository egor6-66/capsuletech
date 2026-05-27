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
}
