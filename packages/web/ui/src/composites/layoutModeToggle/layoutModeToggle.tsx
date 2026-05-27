import { Show } from 'solid-js';
import { toggleLayoutMode, useLayoutMode } from '@capsuletech/web-style';

import type { ILayoutModeToggleProps } from './interfaces';

/**
 * Button that toggles layout mode (view / edit) via the @capsuletech/web-style store.
 *
 * State lives in the module-level signal from web-style — no local signal needed.
 * Displays "Edit" label in view mode (click to switch to edit) and "View" label
 * in edit mode (click to switch to view).
 *
 * @example
 * ```tsx
 * <LayoutModeToggle />
 * <LayoutModeToggle onChange={(mode) => console.log(mode)} />
 * ```
 */
export const LayoutModeToggle = (props: ILayoutModeToggleProps) => {
  const mode = useLayoutMode();
  return (
    <button
      type="button"
      onClick={() => {
        // Capture the NEXT value before calling toggle so onChange receives the
        // post-toggle state regardless of when Solid flushes the signal update.
        const nextMode = mode() === 'view' ? 'edit' : 'view';
        toggleLayoutMode();
        props.onChange?.(nextMode);
      }}
      aria-label={mode() === 'edit' ? 'Switch to view mode' : 'Switch to edit mode'}
      class={`inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-sm hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring transition-colors ${props.class ?? ''}`}
    >
      <Show when={mode() === 'edit'} fallback={<>&#x270E; Edit</>}>
        &#x25B8; View
      </Show>
    </button>
  );
};
