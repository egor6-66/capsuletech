import type { LayoutMode } from '@capsuletech/web-style';

export interface ILayoutModeToggleProps {
  /** Extra CSS classes forwarded to the button element. */
  class?: string;
  /**
   * Called after toggle with the new mode value.
   * Note: the callback receives the mode that will be active AFTER the toggle,
   * computed optimistically from the current signal value.
   */
  onChange?: (mode: LayoutMode) => void;
}
