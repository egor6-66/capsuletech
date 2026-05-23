/**
 * EditBadge — small toggle button that switches Matrix between view/edit modes.
 *
 * Positioned absolute in the top-right corner of the Matrix root.
 * Styled with theme tokens (matches other primitives, no raw color values).
 */
import type { Accessor } from 'solid-js';

interface IEditBadgeProps {
  mode: Accessor<'view' | 'edit'>;
  onToggle: () => void;
}

export const EditBadge = (props: IEditBadgeProps) => (
  <button
    type="button"
    class="absolute right-2 top-2 z-10 rounded px-2 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    classList={{
      'bg-primary text-primary-foreground': props.mode() === 'edit',
      'bg-muted text-muted-foreground hover:bg-muted/80': props.mode() === 'view',
    }}
    onClick={() => props.onToggle()}
    title={props.mode() === 'edit' ? 'Exit layout edit mode' : 'Enter layout edit mode'}
    aria-label="Toggle layout edit mode"
    aria-pressed={props.mode() === 'edit'}
  >
    {props.mode() === 'edit' ? '✓ Done' : '⇄ Edit'}
  </button>
);
