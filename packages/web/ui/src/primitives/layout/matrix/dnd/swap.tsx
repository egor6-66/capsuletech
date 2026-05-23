/**
 * createSwapEngine — swap-mode DnD engine for Matrix.
 *
 * MUST be called at component construction time (inside a Solid component
 * function body) because createDraggable / createDroppable call createMemo /
 * createEffect internally — these require an active reactive owner.
 *
 * Manages a cellId→JSX map reflecting current swap state. On drop: swaps
 * entries a↔b and emits onLayoutChange.
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
  /** True when layoutMode === 'edit' && dndMode === 'swap'. */
  enabled: Accessor<boolean>;
  onLayoutChange?: (e: LayoutChangeEvent) => void;
}

export interface ISwapEngine {
  /** Reactive getter of children for a given cellId (reflects swap state). */
  getCellChildren: (cellId: string) => JSX.Element;
  /**
   * Returns a combined drag+drop ref callback for the given cell element.
   * Safe for any cell — non-draggable cells get a no-op ref.
   */
  bindCell: (cell: ICell, rowId: string | undefined) => (el: HTMLElement) => void;
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

    const draggable = createDraggable({
      id: `cell:${cellId}`,
      data: () => ({ cellId, swapGroup: group }),
      disabled: () => !opts.enabled(),
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
      disabled: () => !opts.enabled(),
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

  return { getCellChildren, bindCell };
};
