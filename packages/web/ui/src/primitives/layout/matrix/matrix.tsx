import { DnDProvider, useDnD } from '@capsuletech/web-dnd';
import { type ICapsuleRouter, RouterContext } from '@capsuletech/web-router';
import { createStyle } from '@capsuletech/web-style';
import {
  type Accessor,
  createMemo,
  createSignal,
  For,
  type JSX,
  Show,
  splitProps,
  useContext,
} from 'solid-js';
import { Dynamic } from 'solid-js/web';
import { Animate, type AnimateVariant } from '../../wrappers/animate';
import { Flex } from '../flex/flex';
import type { IFlexItem } from '../flex/interfaces';
import { DragBadge } from './dnd/drag-badge';
import { createInsertEngine } from './dnd/insert';
import { createSwapEngine } from './dnd/swap';
import type { ICell, IMatrixProps, IRow } from './interfaces';
import { resolvePreset } from './presets';
import { matrixCva, matrixSlots } from './variants';

// ---------------------------------------------------------------------------
// No-op ref helper — Solid's `ref={undefined}` on plain HTML elements throws
// "TypeError: fn is not a function" because the compiled JSX expects a callable.
// `<Dynamic>` tolerates undefined refs internally, but the centroid path uses
// a plain `<div>`. Use NOOP_REF as the default-no-bind ref.
// ---------------------------------------------------------------------------
const NOOP_REF = (_el: HTMLElement): void => {};

// ---------------------------------------------------------------------------
// animateMain helper — wraps content in <Animate> if `animated` is set
// ---------------------------------------------------------------------------

const animateMain = (
  content: JSX.Element,
  animated: boolean | AnimateVariant | undefined,
  router: ICapsuleRouter | null,
): JSX.Element => {
  if (!animated) return content;
  const variant: AnimateVariant = typeof animated === 'string' ? animated : 'fade';
  if (router) {
    return (
      <Animate variant={variant} keyed={router.current()}>
        {content}
      </Animate>
    );
  }
  return <Animate variant={variant}>{content}</Animate>;
};

// ---------------------------------------------------------------------------
// Cell renderer — renders one ICell as the correct HTML5 element
// ---------------------------------------------------------------------------

/**
 * Per-cell DnD state passed down from the swap engine.
 * `undefined` when DnD is not active for this cell.
 */
interface ICellDndState {
  draggableId: string;
  isOver: Accessor<boolean>;
  canDrop: Accessor<boolean>;
  /** Drag is active AND this cell would accept the active payload (soft highlight). */
  canAccept: Accessor<boolean>;
  showBadge: boolean;
}

const renderCell = (
  cell: ICell,
  animated: boolean | AnimateVariant | undefined,
  router: ICapsuleRouter | null,
  /** Reactive children override from swap engine (undefined → use cell.children directly). */
  getSwappedChildren: ((cellId: string) => JSX.Element) | undefined,
  /** Ref to apply drag+drop binding (undefined → no binding). */
  cellRef: ((el: HTMLElement) => void) | undefined,
  /** DnD state for badge rendering + drop highlight. undefined = no DnD on this cell. */
  dndState: ICellDndState | undefined,
  /** Reactive: true when any drag is active — suppresses hover events on cell content. */
  isDragging: Accessor<boolean>,
): JSX.Element => {
  const tag = cell.tag ?? 'div';
  const isMain = cell.id === 'main';
  const children = getSwappedChildren ? getSwappedChildren(cell.id) : cell.children;
  const content = isMain ? animateMain(children, animated, router) : children;

  // Cells with DnD need `position: relative` to host the absolute badge.
  // The badge must live outside the scroll container so it stays pinned to
  // the top-right corner even when cell content (e.g. DataTable) scrolls.
  // Pattern: outer non-scroll wrapper (relative) → inner absolute inset-0
  // scroll wrapper (ref) → badge sibling to the inner wrapper.
  if (dndState) {
    return (
      <Dynamic
        component={tag}
        ref={cellRef}
        class={`${isMain ? matrixSlots.resizeMain : matrixSlots.resizeSlot} relative`}
      >
        {/* Inner scroll wrapper; pointer-events-none during drag prevents hover leaking
            into cell content (table row hover, map hover, etc.).
            DnD ref lives on the outer wrapper so elementFromPoint() always hits it. */}
        <div
          class="absolute inset-0 overflow-auto"
          classList={{ 'pointer-events-none': isDragging() }}
        >
          {content}
        </div>
        {/* Absolute overlay renders above canvas / GPU layers — ring/box-shadow do not. */}
        <Show when={dndState.canAccept() || dndState.canDrop() || dndState.isOver()}>
          <div
            class="pointer-events-none absolute inset-0 z-30 transition-colors duration-150"
            classList={{
              // Soft: drag active, cell is a valid target but pointer not over it yet
              'border-2 border-primary/30 bg-primary/5':
                dndState.canAccept() && !dndState.canDrop(),
              // Strong: pointer is over this cell and it accepts the payload
              'border-2 border-primary bg-primary/15': dndState.canDrop(),
              // Wrong group: hovering a cell that cannot accept the active drag
              'border-2 border-border':
                dndState.isOver() && !dndState.canDrop() && !dndState.canAccept(),
            }}
          />
        </Show>
        {dndState.showBadge && <DragBadge draggableId={dndState.draggableId} />}
      </Dynamic>
    );
  }

  return (
    <Dynamic
      component={tag}
      ref={cellRef}
      class={isMain ? matrixSlots.resizeMain : matrixSlots.resizeSlot}
    >
      {content}
    </Dynamic>
  );
};

// ---------------------------------------------------------------------------
// Row renderer — turns one IRow into a horizontal Flex (resizable or static)
// ---------------------------------------------------------------------------

const rowToFlexItems = (
  row: IRow,
  animated: boolean | AnimateVariant | undefined,
  router: ICapsuleRouter | null,
  getSwappedChildren: ((cellId: string) => JSX.Element) | undefined,
  bindCell: ((cell: ICell, rowId: string | undefined) => (el: HTMLElement) => void) | undefined,
  getCellDndState: ((cell: ICell) => ICellDndState | undefined) | undefined,
  /** Saved sizes for this row's horizontal panels (index-aligned). */
  savedSizes: number[] | undefined,
  isDragging: Accessor<boolean>,
): IFlexItem[] =>
  row.cells.map((cell, i) => {
    const widthIsNumber = typeof cell.width === 'number';
    const cellRef = cell.draggable && bindCell ? bindCell(cell, row.id) : NOOP_REF;
    const dndState = getCellDndState ? getCellDndState(cell) : undefined;
    // Prefer session-persisted size; fall back to declared cell.width.
    const resolvedSize = savedSizes?.[i] ?? (widthIsNumber ? (cell.width as number) : undefined);
    return {
      children: renderCell(cell, animated, router, getSwappedChildren, cellRef, dndState, isDragging),
      resizable: cell.resizable ?? false,
      initialSize: resolvedSize,
      minSize: undefined,
      maxSize: undefined,
    };
  });

const rowHasResizable = (row: IRow): boolean => row.cells.some((c) => c.resizable === true);

// ---------------------------------------------------------------------------
// renderRow
// ---------------------------------------------------------------------------

const renderRow = (
  row: IRow,
  animated: boolean | AnimateVariant | undefined,
  router: ICapsuleRouter | null,
  getSwappedChildren: ((cellId: string) => JSX.Element) | undefined,
  bindCell: ((cell: ICell, rowId: string | undefined) => (el: HTMLElement) => void) | undefined,
  bindRow: ((rowId: string) => (el: HTMLElement) => void) | undefined,
  getCellDndState: ((cell: ICell) => ICellDndState | undefined) | undefined,
  /** Saved horizontal panel sizes for this row (index-aligned, session-persisted). */
  savedSizes: number[] | undefined,
  /** Called when corvu reports new horizontal sizes for this row. */
  onRowSizesChange: ((sizes: number[]) => void) | undefined,
  isDragging: Accessor<boolean>,
): JSX.Element => {
  const hasResizable = rowHasResizable(row);
  // Cross-row drop target ref — only meaningful in insert mode (bindRow defined).
  const rowDropRef = bindRow && row.id ? bindRow(row.id) : NOOP_REF;

  if (hasResizable) {
    const items = rowToFlexItems(
      row,
      animated,
      router,
      getSwappedChildren,
      bindCell,
      getCellDndState,
      savedSizes,
      isDragging,
    );
    return (
      <div ref={rowDropRef} class="relative h-full min-h-0 flex-1 overflow-hidden">
        <div class="absolute inset-0">
          <Flex
            orientation="horizontal"
            items={items}
            withHandle
            onSizesChange={onRowSizesChange}
          />
        </div>
      </div>
    );
  }

  return (
    <div
      ref={rowDropRef}
      class="flex h-full min-h-0 w-full overflow-hidden"
      classList={{ 'flex-1': row.height === 'fr' || row.height === undefined }}
    >
      <For each={row.cells}>
        {(cell) => {
          const cellRef = cell.draggable && bindCell ? bindCell(cell, row.id) : NOOP_REF;
          const dndState = getCellDndState ? getCellDndState(cell) : undefined;
          return renderCell(cell, animated, router, getSwappedChildren, cellRef, dndState, isDragging);
        }}
      </For>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Rows-engine
// ---------------------------------------------------------------------------

const rowsToVerticalItems = (
  rows: IRow[],
  animated: boolean | AnimateVariant | undefined,
  router: ICapsuleRouter | null,
  getSwappedChildren: ((cellId: string) => JSX.Element) | undefined,
  bindCell: ((cell: ICell, rowId: string | undefined) => (el: HTMLElement) => void) | undefined,
  bindRow: ((rowId: string) => (el: HTMLElement) => void) | undefined,
  getCellDndState: ((cell: ICell) => ICellDndState | undefined) | undefined,
  /** Saved vertical panel sizes (index-aligned). */
  savedVerticalSizes: number[] | undefined,
  /** Per-row saved horizontal sizes. Key = rowId ?? "r<index>". */
  getRowSavedSizes: ((rowKey: string) => number[] | undefined) | undefined,
  /** Called when a horizontal row's corvu sizes change. Key = rowId ?? "r<index>". */
  onRowSizesChange: ((rowKey: string, sizes: number[]) => void) | undefined,
  isDragging: Accessor<boolean>,
): IFlexItem[] =>
  rows.map((row, i) => {
    const heightIsNumber = typeof row.height === 'number';
    const isResizable = row.resizable ?? true;
    const rowKey = row.id ?? `r${i}`;
    const rowSaved = getRowSavedSizes ? getRowSavedSizes(rowKey) : undefined;
    const rowOnChange = onRowSizesChange
      ? (sizes: number[]) => onRowSizesChange(rowKey, sizes)
      : undefined;
    // Prefer session-persisted vertical size; fall back to declared row.height.
    const resolvedHeight =
      savedVerticalSizes?.[i] ?? (heightIsNumber ? (row.height as number) : undefined);
    return {
      children: renderRow(
        row,
        animated,
        router,
        getSwappedChildren,
        bindCell,
        bindRow,
        getCellDndState,
        rowSaved,
        rowOnChange,
        isDragging,
      ),
      resizable: isResizable,
      initialSize: resolvedHeight,
    };
  });

const hasVerticalResizable = (rows: IRow[]): boolean =>
  rows.some((r) => r.resizable === true || typeof r.height === 'number');

// ---------------------------------------------------------------------------
// MatrixContent — inner component that lives INSIDE DnDProvider
//
// createDraggable / createDroppable call useDnD() which reads the DnD context.
// They must run inside the provider tree. By placing the swap engine here,
// we guarantee the context is available when createSwapEngine runs.
// ---------------------------------------------------------------------------

interface IMatrixContentProps {
  rows: Accessor<IRow[]>;
  animated: boolean | AnimateVariant | undefined;
  router: ICapsuleRouter | null;
  layoutMode: Accessor<'view' | 'edit'>;
  dndMode: Accessor<'swap' | 'insert'>;
  onLayoutChange: ((e: import('./interfaces').LayoutChangeEvent) => void) | undefined;
}

// ---------------------------------------------------------------------------
// SizesMap — session-only persistence of user-resized panel sizes.
// Key scheme:
//   "v"         → vertical flex (rows column)
//   "h:<rowKey>" → horizontal flex within a row (rowKey = rowId ?? "r<index>")
//
// Implemented as a plain mutable object (not a signal) for two reasons:
//   1. Reads must NOT be reactive — we deliberately read at rebuild time only,
//      so we never want sizesMap to be a dependency of renderContent().
//   2. corvu fires onSizesChange SYNCHRONOUSLY during panel unregistration
//      (cleanup/unmount). These calls carry shrinking arrays (panels removed
//      one-by-one) that would corrupt the snapshot if saved. We guard against
//      this by discarding updates where sizes.length < snapshot[key].length.
// ---------------------------------------------------------------------------

type SizesMap = Record<string, number[]>;

const MatrixContent = (props: IMatrixContentProps) => {
  // Reactive drag-active flag — suppresses pointer-events on cell content during drag.
  // useDnD() is safe here: MatrixContent always renders inside DnDProvider.
  const dnd = useDnD();
  const isDragging = createMemo(() => dnd.state.activeId() !== null);

  // Swap is enabled whenever dndMode is 'swap' — layoutMode is no longer the gate.
  // Badge visibility (2+ draggable cells) is the UX gate.
  const swapEnabled = createMemo(() => props.dndMode() === 'swap');
  const insertEnabled = createMemo(
    () => props.layoutMode() === 'edit' && props.dndMode() === 'insert',
  );

  // Plain mutable store — intentionally NOT a signal.
  // Reads inside renderContent() must not create reactive dependencies.
  const sizesSnapshot: SizesMap = {};

  const getSavedSizes = (key: string): number[] | undefined => sizesSnapshot[key];

  const saveSizes = (key: string, sizes: number[]): void => {
    const prev = sizesSnapshot[key];
    // Guard against corvu's cleanup-time calls: when panels unregister one-by-one,
    // corvu fires onSizesChange with a shrinking array. Discard those calls so
    // we don't overwrite valid resize data with partial/empty arrays.
    if (prev !== undefined && sizes.length < prev.length) return;
    sizesSnapshot[key] = sizes;
  };

  const getRowSavedSizes = (rowKey: string): number[] | undefined => getSavedSizes(`h:${rowKey}`);

  const onRowSizesChange = (rowKey: string, sizes: number[]): void => {
    saveSizes(`h:${rowKey}`, sizes);
  };

  const onVerticalSizesChange = (sizes: number[]): void => {
    saveSizes('v', sizes);
  };

  const swap = createSwapEngine({
    rows: props.rows,
    enabled: swapEnabled,
    onLayoutChange: props.onLayoutChange,
  });

  const insert = createInsertEngine({
    rows: props.rows,
    enabled: insertEnabled,
    onLayoutChange: props.onLayoutChange,
  });

  // Badge is shown on each draggable cell only when 2+ draggable cells exist
  // (otherwise there is nothing to swap with).
  const showBadges = createMemo(() => swap.draggableCount >= 2 && props.dndMode() === 'swap');

  // Effective rows: insert mode mutates layout structure; swap mode does not.
  const effectiveRows = createMemo(() =>
    props.dndMode() === 'insert' ? insert.rows() : props.rows(),
  );

  // Build getCellDndState — returns per-cell badge + highlight state.
  const getCellDndState = (cell: ICell): ICellDndState | undefined => {
    if (!cell.draggable || props.dndMode() !== 'swap') return undefined;
    const { isOver, canDrop, canAccept } = swap.getCellDropState(cell.id);
    return {
      draggableId: swap.getDraggableId(cell.id),
      isOver,
      canDrop,
      canAccept,
      showBadge: showBadges(),
    };
  };

  const renderContent = (): JSX.Element => {
    const rows = effectiveRows();

    if (rows.length === 0) return null;

    const isSwap = props.dndMode() === 'swap';
    const isInsert = props.dndMode() === 'insert';
    const swapGetChildren = isSwap ? swap.getCellChildren : undefined;
    const swapBind = isSwap ? swap.bindCell : isInsert ? insert.bindCell : undefined;
    const insertBindRow = isInsert ? insert.bindRow : undefined;
    const cellDndState = isSwap ? getCellDndState : undefined;

    // Single row, single cell (centroid shortcut)
    if (rows.length === 1 && rows[0].cells.length === 1 && !rows[0].resizable) {
      const cell = rows[0].cells[0];
      const isMain = cell.id === 'main';
      if (!rows[0].height || rows[0].height === 'fr') {
        const children = swapGetChildren ? swapGetChildren(cell.id) : cell.children;
        const cellRef = cell.draggable && swapBind ? swapBind(cell, rows[0].id) : NOOP_REF;
        const dndState = cellDndState ? cellDndState(cell) : undefined;
        return (
          <div ref={cellRef} class="relative flex h-full w-full items-center justify-center">
            {/* Inner wrapper: overflow-auto allows content to scroll.
                pointer-events-none during drag prevents hover leaking into content.
                DnD ref is on the outer wrapper so elementFromPoint() always hits it. */}
            <div
              class="absolute inset-0 overflow-auto flex items-center justify-center"
              classList={{ 'pointer-events-none': isDragging() }}
            >
              {isMain ? animateMain(children, props.animated, props.router) : children}
            </div>
            {/* Absolute overlay renders above canvas / GPU layers */}
            <Show
              when={dndState && (dndState.canAccept() || dndState.canDrop() || dndState.isOver())}
            >
              <div
                class="pointer-events-none absolute inset-0 z-30 transition-colors duration-150"
                classList={{
                  'border-2 border-primary/30 bg-primary/5':
                    (dndState?.canAccept() ?? false) && !(dndState?.canDrop() ?? false),
                  'border-2 border-primary bg-primary/15': dndState?.canDrop() ?? false,
                  'border-2 border-border':
                    (dndState?.isOver() ?? false) &&
                    !(dndState?.canDrop() ?? false) &&
                    !(dndState?.canAccept() ?? false),
                }}
              />
            </Show>
            {dndState?.showBadge && <DragBadge draggableId={dndState.draggableId} />}
          </div>
        );
      }
    }

    const useVertical = hasVerticalResizable(rows);

    if (useVertical) {
      // 'auto'-height rows (e.g. header) must not enter the corvu Resizable engine —
      // they have content-driven height and must be rendered as shrink-0 wrappers.
      // Only rows with numeric or 'fr' height participate in the resizable Flex so that
      // fillInitialSizes distributes space correctly among only the sized rows.
      const hasAutoRows = rows.some((r) => r.height === 'auto');

      if (!hasAutoRows) {
        // Fast path: no auto rows — feed all rows directly to vertical Flex.
        const verticalItems = rowsToVerticalItems(
          rows,
          props.animated,
          props.router,
          swapGetChildren,
          swapBind,
          insertBindRow,
          cellDndState,
          getSavedSizes('v'),
          getRowSavedSizes,
          onRowSizesChange,
          isDragging,
        );
        return (
          <div class="relative h-full w-full overflow-hidden">
            <div class="absolute inset-0">
              <Flex
                orientation="vertical"
                items={verticalItems}
                withHandle
                onSizesChange={onVerticalSizesChange}
              />
            </div>
          </div>
        );
      }

      // Mixed path: auto-height rows render as shrink-0, the resizable group renders
      // as a flex-1 block that fills the remaining space.
      // We build the resizable items from non-auto rows only.
      const resizableRows = rows.filter((r) => r.height !== 'auto');
      const verticalItems = rowsToVerticalItems(
        resizableRows,
        props.animated,
        props.router,
        swapGetChildren,
        swapBind,
        insertBindRow,
        cellDndState,
        getSavedSizes('v'),
        getRowSavedSizes,
        onRowSizesChange,
        isDragging,
      );

      // Walk rows in order: emit shrink-0 divs for auto rows, and a single flex-1
      // resizable block at the position of the first non-auto row (skipping the rest).
      let resizableBlockEmitted = false;
      const elements: JSX.Element[] = rows.map((row, _i) => {
        if (row.height === 'auto') {
          const rowKey = row.id ?? `r${_i}`;
          return (
            <div class="w-full shrink-0">
              {renderRow(
                row,
                props.animated,
                props.router,
                swapGetChildren,
                swapBind,
                insertBindRow,
                cellDndState,
                getRowSavedSizes(rowKey),
                (sizes) => onRowSizesChange(rowKey, sizes),
                isDragging,
              )}
            </div>
          );
        }
        if (resizableBlockEmitted) return null;
        resizableBlockEmitted = true;
        return (
          <div class="relative min-h-0 flex-1 overflow-hidden">
            <div class="absolute inset-0">
              <Flex
                orientation="vertical"
                items={verticalItems}
                withHandle
                onSizesChange={onVerticalSizesChange}
              />
            </div>
          </div>
        );
      });

      return <div class="flex h-full w-full flex-col overflow-hidden">{elements}</div>;
    }

    return (
      <div class="flex h-full w-full flex-col overflow-hidden">
        <For each={rows}>
          {(row, i) => {
            const rowKey = row.id ?? `r${i()}`;
            if (row.height === 'auto' || (row.height === undefined && rows.length > 1)) {
              return (
                <div class="w-full shrink-0">
                  {renderRow(
                    row,
                    props.animated,
                    props.router,
                    swapGetChildren,
                    swapBind,
                    insertBindRow,
                    cellDndState,
                    getRowSavedSizes(rowKey),
                    (sizes) => onRowSizesChange(rowKey, sizes),
                    isDragging,
                  )}
                </div>
              );
            }
            return renderRow(
              row,
              props.animated,
              props.router,
              swapGetChildren,
              swapBind,
              insertBindRow,
              cellDndState,
              getRowSavedSizes(rowKey),
              (sizes) => onRowSizesChange(rowKey, sizes),
              isDragging,
            );
          }}
        </For>
      </div>
    );
  };

  return <>{renderContent()}</>;
};

// ---------------------------------------------------------------------------
// MatrixImpl — outer shell (provides DnDProvider + layout mode signals)
// ---------------------------------------------------------------------------

const MatrixImpl = (props: IMatrixProps) => {
  const [local, rest] = splitProps(props, [
    'class',
    'style',
    'ref',
    'animated',
    'preset',
    'slots',
    'rows',
    'dndMode',
    'layoutMode',
    'onLayoutChange',
  ]);

  const { className, style } = createStyle(matrixCva, {
    class: local.class,
    style: local.style,
  });

  const router = useContext(RouterContext);

  const getRows = createMemo((): IRow[] => {
    if (local.preset != null) {
      return resolvePreset(
        local.preset as keyof import('./interfaces').LayoutPresets,
        local.slots as never,
      );
    }
    return (local.rows as IRow[]) ?? [];
  });

  // Uncontrolled local mode (kept for insert-mode legacy; not used by badge-UX swap)
  const [localLayoutMode, setLocalLayoutMode] = createSignal<'view' | 'edit'>('view');
  const layoutMode = createMemo(() => local.layoutMode ?? localLayoutMode());
  const dndMode = createMemo(() => local.dndMode ?? 'swap');

  // Kept for controlled layoutMode support (insert mode, future)
  void setLocalLayoutMode;

  return (
    <DnDProvider showDefaultOverlay overlayMode="thumbnail">
      <div ref={local.ref} class={`${className()} relative`} style={style()} {...(rest as object)}>
        <MatrixContent
          rows={getRows}
          animated={local.animated}
          router={router}
          layoutMode={layoutMode}
          dndMode={dndMode}
          onLayoutChange={local.onLayoutChange}
        />
      </div>
    </DnDProvider>
  );
};

/**
 * Matrix — rows-of-cells layout engine.
 *
 * **Два режима:**
 *
 * 1. **Preset** — именованный пресет + типизированные slots:
 *    ```tsx
 *    <Matrix preset="app-shell" slots={{
 *      header:  <Header />,
 *      main:    <Main />,
 *      footer:  <Footer />,
 *    }} />
 *    ```
 *
 * 2. **Raw rows** — явный массив IRow[]:
 *    ```tsx
 *    <Matrix rows={[
 *      { cells: [{ id: 'top', tag: 'header', children: <Header /> }] },
 *      { resizable: true, cells: [
 *        { id: 'a', children: <A />, width: 0.5, resizable: true, draggable: true, swapGroup: 'main-row' },
 *        { id: 'b', children: <B />, width: 0.5, resizable: true, draggable: true, swapGroup: 'main-row' },
 *      ]},
 *    ]} />
 *    ```
 *
 * **DnD / badge-UX (Phase 1.2 v2):**
 * - Each resizable draggable cell shows a DragBadge (grip icon) in its top-right corner.
 * - Badge is visible only when 2+ draggable cells exist in the same swapGroup.
 * - Mousedown on badge → activates drag for that cell (pointer captured).
 * - Drop targets highlight with inset box-shadow (renders above canvas/child layers) during an active drag.
 * - `onLayoutChange` called with `{ kind: 'swap', a, b }` after each successful swap.
 * - No global edit badge / no edit mode toggle — drag is always available via badge.
 * - `layoutMode` prop still accepted (for insert mode / controlled state future use).
 * - `dndMode` defaults to `'swap'`.
 */
export const Matrix = MatrixImpl;
