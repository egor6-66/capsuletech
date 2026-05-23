/**
 * createSwapEngine — swap-mode DnD engine for Matrix.
 *
 * MUST be called at component construction time (inside a Solid component
 * function body) because createDraggable / createDroppable call createMemo /
 * createEffect internally — these require an active reactive owner.
 *
 * v2 badge-UX changes:
 * - Drag is triggered ONLY via DragBadge (pointerdown on badge → dnd.startDrag).
 * - Cell element is registered as draggable but with disabled=true so the cell
 *   surface itself does not start a drag.
 * - Drop targets show a ring highlight when a drag is active and the cell is a
 *   valid target (isOver + canDrop).
 * - `enabled` accessor is no longer tied to layoutMode; caller passes `() => true`
 *   when 2+ resizable draggable cells exist.
 */

import type { IDraggable, IDroppable } from '@capsuletech/web-dnd';
import { createDraggable, createDroppable } from '@capsuletech/web-dnd';
import { type Accessor, createEffect, createSignal, type JSX } from 'solid-js';
import type { ICell, IRow, LayoutChangeEvent } from '../interfaces';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ISwapEngineOptions {
  rows: Accessor<IRow[]>;
  /**
   * When false, accepts() returns false (no drops allowed).
   * In the badge-UX, caller passes `() => true` unconditionally — the badge
   * is only shown when 2+ resizable cells exist, so swap is always valid.
   */
  enabled: Accessor<boolean>;
  onLayoutChange?: (e: LayoutChangeEvent) => void;
}

export interface ISwapEngine {
  /** Reactive getter of children for a given cellId (reflects swap state). */
  getCellChildren: (cellId: string) => JSX.Element;
  /**
   * Returns a ref callback for the cell element — registers it as a draggable
   * source + droppable target. The cell element itself does NOT trigger drag
   * (disabled=true); drag starts from the DragBadge via dnd.startDrag.
   */
  bindCell: (cell: ICell, rowId: string | undefined) => (el: HTMLElement) => void;
  /**
   * Returns reactive drop-highlight state for a cell.
   * `isOver` — pointer is over this cell during an active drag.
   * `canDrop` — isOver && this cell accepts the active drag payload.
   */
  getCellDropState: (cellId: string) => { isOver: Accessor<boolean>; canDrop: Accessor<boolean> };
  /** Draggable id string for a given cellId — used by DragBadge. */
  getDraggableId: (cellId: string) => string;
  /** Number of draggable cells registered (determines badge visibility). */
  draggableCount: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Resolves the swapGroup for a cell. */
const resolveGroup = (cell: ICell, rowId: string | undefined): string =>
  cell.swapGroup ?? rowId ?? cell.id;

interface ICellEntry {
  cell: ICell;
  rowId: string | undefined;
}

/** Flat list of all draggable cells from rows snapshot. */
const flatDraggableCells = (rows: IRow[]): ICellEntry[] => {
  const result: ICellEntry[] = [];
  for (const row of rows) {
    for (const cell of row.cells) {
      if (cell.draggable) {
        result.push({ cell, rowId: row.id });
      }
    }
  }
  return result;
};

// ---------------------------------------------------------------------------
// createSwapEngine
// ---------------------------------------------------------------------------

export const createSwapEngine = (opts: ISwapEngineOptions): ISwapEngine => {
  // -------------------------------------------------------------------------
  // Children map
  // -------------------------------------------------------------------------

  const buildInitialMap = (rows: IRow[]): Record<string, JSX.Element> => {
    const map: Record<string, JSX.Element> = {};
    for (const row of rows) {
      for (const cell of row.cells) {
        map[cell.id] = cell.children;
      }
    }
    return map;
  };

  const [childrenMap, setChildrenMap] = createSignal<Record<string, JSX.Element>>(
    buildInitialMap(opts.rows()),
  );

  // Re-build map when rows change. Intentionally resets swap state.
  // ADR 016: "if parent re-creates rows with same ids — swap state is lost. OK for v1."
  createEffect(() => {
    const rows = opts.rows();
    setChildrenMap(buildInitialMap(rows));
  });

  // -------------------------------------------------------------------------
  // doSwap
  // -------------------------------------------------------------------------

  const doSwap = (aId: string, bId: string): void => {
    setChildrenMap((prev) => {
      const next = { ...prev };
      const tmp = next[aId];
      next[aId] = next[bId];
      next[bId] = tmp;
      return next;
    });
    opts.onLayoutChange?.({ kind: 'swap', a: aId, b: bId });
  };

  // -------------------------------------------------------------------------
  // Per-cell bindings — created at engine construction time.
  //
  // createDraggable / createDroppable must be called at top-level component
  // scope (they use createMemo / createEffect internally).
  //
  // We snapshot rows() once at construction. If rows change (e.g. preset
  // receives new slots), the parent <Matrix> re-renders and createSwapEngine
  // is called fresh — so the binding set refreshes automatically.
  // -------------------------------------------------------------------------

  interface ICellBinding {
    draggable: IDraggable;
    droppable: IDroppable;
  }

  const bindingMap = new Map<string, ICellBinding>();

  for (const { cell, rowId } of flatDraggableCells(opts.rows())) {
    const group = resolveGroup(cell, rowId);
    const cellId = cell.id;

    // disabled=true: badge calls dnd.startDrag directly; the cell element
    // is registered so the DnD context can track it, but pointerdown on the
    // cell surface itself does not start a drag.
    const draggable = createDraggable({
      id: `cell:${cellId}`,
      data: () => ({ cellId, swapGroup: group }),
      disabled: () => true,
    });

    const droppable = createDroppable({
      id: `cell:${cellId}`,
      accepts: (data) => {
        const d = data as { cellId?: string; swapGroup?: string };
        return (
          opts.enabled() &&
          typeof d.swapGroup === 'string' &&
          d.swapGroup === group &&
          d.cellId !== cellId
        );
      },
      onDrop: (data) => {
        const d = data as { cellId?: string };
        if (typeof d.cellId === 'string') {
          doSwap(d.cellId, cellId);
        }
      },
    });

    bindingMap.set(cellId, { draggable, droppable });
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  const getCellChildren = (cellId: string): JSX.Element => childrenMap()[cellId];

  const bindCell =
    (cell: ICell, _rowId: string | undefined): ((el: HTMLElement) => void) =>
    (el: HTMLElement) => {
      const binding = bindingMap.get(cell.id);
      if (!binding) return; // non-draggable cell — no-op ref
      binding.draggable.ref(el);
      binding.droppable.ref(el);
    };

  const getCellDropState = (
    cellId: string,
  ): { isOver: Accessor<boolean>; canDrop: Accessor<boolean> } => {
    const binding = bindingMap.get(cellId);
    if (!binding) return { isOver: () => false, canDrop: () => false };
    return { isOver: binding.droppable.isOver, canDrop: binding.droppable.canDrop };
  };

  const getDraggableId = (cellId: string): string => `cell:${cellId}`;

  return {
    getCellChildren,
    bindCell,
    getCellDropState,
    getDraggableId,
    draggableCount: bindingMap.size,
  };
};
