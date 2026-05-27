export interface IDarkModeToggleProps {
  /** Optional DOM target for applying the dark class (defaults to documentElement). */
  target?: HTMLElement;
  /** Extra CSS classes forwarded to the button element. */
  class?: string;
  /** Called after toggle with the new isDark value. */
  onChange?: (isDark: boolean) => void;
}
