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
    <div
      role="button"
      tabIndex={0}
      aria-label="Drag to swap cell"
      title="Drag to swap"
      class="absolute right-1 top-1 z-20 flex h-7 w-7 cursor-grab items-center justify-center rounded border border-border bg-card/80 opacity-80 shadow-sm backdrop-blur-sm transition-all hover:bg-accent hover:opacity-100 active:cursor-grabbing"
      onPointerDown={onPointerDown}
    >
      <GripIcon />
    </div>
  );
};

/**
 * GripIcon — 6 dots (2×3 grid), styled like a resize handle grip.
 * Matches the visual language of the resize handle in Flex/Resizable.
 */
const GripIcon = () => (
  <svg
    width="10"
    height="14"
    viewBox="0 0 10 14"
    fill="currentColor"
    aria-hidden="true"
    class="text-foreground"
  >
    {/* Left column: 3 dots */}
    <circle cx="2" cy="2.5" r="1.25" />
    <circle cx="2" cy="7" r="1.25" />
    <circle cx="2" cy="11.5" r="1.25" />
    {/* Right column: 3 dots */}
    <circle cx="8" cy="2.5" r="1.25" />
    <circle cx="8" cy="7" r="1.25" />
    <circle cx="8" cy="11.5" r="1.25" />
  </svg>
);
