/**
 * DragBadge — per-cell drag handle badge.
 *
 * Renders a 6-dot grip icon in the top-right corner of a resizable cell.
 * Visible only when 2+ resizable cells exist (swap has a target).
 *
 * Pointerdown on badge → calls dnd.startDrag for the associated cell.
 * The cell element is registered as a draggable (via createDraggable ref)
 * but with disabled=true so the cell surface itself does not trigger drag.
 *
 * Must be rendered inside <DnDProvider> tree.
 */
import type { DraggableId } from '@capsuletech/web-dnd';
import { useDnD } from '@capsuletech/web-dnd';
import { GripIcon } from '../../flex/_resize/grip-icon';

interface IDragBadgeProps {
  /** The draggable id to activate on pointerdown (matches createDraggable id). */
  draggableId: DraggableId;
}

export const DragBadge = (props: IDragBadgeProps) => {
  const dnd = useDnD();

  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    dnd.startDrag(props.draggableId, e);
  };

  return (
    <button
      type="button"
      aria-label="Drag to swap cell"
      title="Drag to swap"
      class="absolute right-1 top-1 z-20 flex h-7 w-7 cursor-grab items-center justify-center rounded border border-border bg-card/80 opacity-80 shadow-sm backdrop-blur-sm transition-all hover:bg-accent hover:opacity-100 active:cursor-grabbing"
      onPointerDown={onPointerDown}
    >
      {/* Shared grip icon; override wrapper to remove double-border inside the button */}
      <GripIcon class="flex items-center justify-center" />
    </button>
  );
};
