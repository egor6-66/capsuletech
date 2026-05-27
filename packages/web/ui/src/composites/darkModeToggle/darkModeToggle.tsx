import { toggleDarkMode, useDarkMode } from '@capsuletech/web-style';

import type { IDarkModeToggleProps } from './interfaces';

/**
 * Button that toggles dark mode via the @capsuletech/web-style store.
 *
 * State lives in the module-level signal from web-style — no local signal
 * needed. Applies .dark on document.documentElement (or the provided target).
 *
 * @example
 * ```tsx
 * <DarkModeToggle />
 * <DarkModeToggle onChange={(dark) => console.log(dark)} />
 * ```
 */
export const DarkModeToggle = (props: IDarkModeToggleProps) => {
  const isDark = useDarkMode();
  return (
    <button
      type="button"
      onClick={() => {
        // Capture the NEXT value before calling toggle so onChange receives the
        // post-toggle state regardless of when Solid flushes the signal update.
        const nextDark = !isDark();
        toggleDarkMode(props.target);
        props.onChange?.(nextDark);
      }}
      aria-label={isDark() ? 'Switch to light mode' : 'Switch to dark mode'}
      class={`inline-flex items-center justify-center rounded-md border border-border bg-card px-3 py-1.5 text-sm hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring transition-colors ${props.class ?? ''}`}
    >
      {isDark() ? '☀' : '☾'}
    </button>
  );
};
