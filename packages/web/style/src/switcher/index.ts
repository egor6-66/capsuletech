/**
 * Switcher state-stores и helpers. Visual widget'ы (DarkModeToggle / ThemePicker /
 * LayoutModeToggle) живут в `@capsuletech/web-ui/composites` — web-style не
 * зависит от web-ui (иначе cycle), поэтому видимые компоненты переехали туда.
 *
 * Web-style оставляет только:
 *  - Reactive signal stores (`useTheme` / `useDarkMode` / `useLayoutMode`).
 *  - Setters / togglers + DOM-apply helpers.
 *  - `DISCOVERED_THEMES` (eager-glob по themes/).
 */
export {
  useTheme,
  useDarkMode,
  setTheme,
  setDarkMode,
  toggleDarkMode,
  DISCOVERED_THEMES,
} from './theme';
export {
  useLayoutMode,
  setLayoutMode,
  toggleLayoutMode,
  type LayoutMode,
} from './layoutMode';
