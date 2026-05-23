import { DnDProvider } from '@capsuletech/web-dnd';
import { type ICapsuleRouter, RouterContext } from '@capsuletech/web-router';
import { createStyle } from '@capsuletech/web-style';
import {
  type Accessor,
  createMemo,
  createSignal,
  For,
  type JSX,
  splitProps,
  useContext,
} from 'solid-js';
import { Dynamic } from 'solid-js/web';
import { Animate, type AnimateVariant } from '../../wrappers/animate';
import { Flex } from '../flex/flex';
import type { IFlexItem } from '../flex/interfaces';
import { EditBadge } from './dnd/edit-badge';
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

const renderCell = (
  cell: ICell,
  animated: boolean | AnimateVariant | undefined,
  router: ICapsuleRouter | null,
  /** Reactive children override from swap engine (undefined → use cell.children directly). */
  getSwappedChildren: ((cellId: string) => JSX.Element) | undefined,
  /** Ref to apply drag+drop binding (undefined → no binding). */
  cellRef: ((el: HTMLElement) => void) | undefined,
): JSX.Element => {
  const tag = cell.tag ?? 'div';
  const isMain = cell.id === 'main';
  const children = getSwappedChildren ? getSwappedChildren(cell.id) : cell.children;
  const content = isMain ? animateMain(children, animated, router) : children;

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
): IFlexItem[] =>
  row.cells.map((cell) => {
    const widthIsNumber = typeof cell.width === 'number';
    const cellRef = cell.draggable && bindCell ? bindCell(cell, row.id) : NOOP_REF;
    return {
      children: renderCell(cell, animated, router, getSwappedChildren, cellRef),
      resizable: cell.resizable ?? false,
      initialSize: widthIsNumber ? (cell.width as number) : undefined,
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
): JSX.Element => {
  const hasResizable = rowHasResizable(row);

  if (hasResizable) {
    const items = rowToFlexItems(row, animated, router, getSwappedChildren, bindCell);
    return (
      <div class="relative h-full min-h-0 flex-1 overflow-hidden">
        <div class="absolute inset-0">
          <Flex orientation="horizontal" items={items} withHandle />
        </div>
      </div>
    );
  }

  return (
    <div
      class="flex min-h-0 w-full overflow-hidden"
      classList={{ 'flex-1': row.height === 'fr' || row.height === undefined }}
    >
      <For each={row.cells}>
        {(cell) => {
          const cellRef = cell.draggable && bindCell ? bindCell(cell, row.id) : NOOP_REF;
          return renderCell(cell, animated, router, getSwappedChildren, cellRef);
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
): IFlexItem[] =>
  rows.map((row) => {
    const heightIsNumber = typeof row.height === 'number';
    const isResizable = row.resizable ?? true;
    return {
      children: renderRow(row, animated, router, getSwappedChildren, bindCell),
      resizable: isResizable,
      initialSize: heightIsNumber ? (row.height as number) : undefined,
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
  onBadgeToggle: () => void;
  onLayoutChange: ((e: import('./interfaces').LayoutChangeEvent) => void) | undefined;
}

const MatrixContent = (props: IMatrixContentProps) => {
  const swapEnabled = createMemo(() => props.layoutMode() === 'edit' && props.dndMode() === 'swap');

  const swap = createSwapEngine({
    rows: props.rows,
    enabled: swapEnabled,
    onLayoutChange: props.onLayoutChange,
  });

  const hasDraggableCells = createMemo(() =>
    props.rows().some((r) => r.cells.some((c) => c.draggable)),
  );

  const renderContent = (): JSX.Element => {
    const rows = props.rows();

    if (rows.length === 0) return null;

    const isSwap = props.dndMode() === 'swap';
    const swapGetChildren = isSwap ? swap.getCellChildren : undefined;
    const swapBind = isSwap ? swap.bindCell : undefined;

    // Single row, single cell (centroid shortcut)
    if (rows.length === 1 && rows[0].cells.length === 1 && !rows[0].resizable) {
      const cell = rows[0].cells[0];
      const isMain = cell.id === 'main';
      if (!rows[0].height || rows[0].height === 'fr') {
        const children = swapGetChildren ? swapGetChildren(cell.id) : cell.children;
        const cellRef = cell.draggable && swapBind ? swapBind(cell, rows[0].id) : NOOP_REF;
        return (
          <div class="flex h-full w-full items-center justify-center" ref={cellRef}>
            {isMain ? animateMain(children, props.animated, props.router) : children}
          </div>
        );
      }
    }

    const useVertical = hasVerticalResizable(rows);

    if (useVertical) {
      const verticalItems = rowsToVerticalItems(
        rows,
        props.animated,
        props.router,
        swapGetChildren,
        swapBind,
      );
      return (
        <div class="relative h-full w-full overflow-hidden">
          <div class="absolute inset-0">
            <Flex orientation="vertical" items={verticalItems} withHandle />
          </div>
        </div>
      );
    }

    return (
      <div class="flex h-full w-full flex-col overflow-hidden">
        <For each={rows}>
          {(row) => {
            if (row.height === 'auto' || (row.height === undefined && rows.length > 1)) {
              return (
                <div class="w-full shrink-0">
                  {renderRow(row, props.animated, props.router, swapGetChildren, swapBind)}
                </div>
              );
            }
            return renderRow(row, props.animated, props.router, swapGetChildren, swapBind);
          }}
        </For>
      </div>
    );
  };

  return (
    <>
      {renderContent()}
      {hasDraggableCells() && <EditBadge mode={props.layoutMode} onToggle={props.onBadgeToggle} />}
    </>
  );
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

  // Uncontrolled local mode
  const [localLayoutMode, setLocalLayoutMode] = createSignal<'view' | 'edit'>('view');
  const layoutMode = createMemo(() => local.layoutMode ?? localLayoutMode());
  const dndMode = createMemo(() => local.dndMode ?? 'swap');

  const handleBadgeToggle = () => {
    if (local.layoutMode === undefined) {
      setLocalLayoutMode((m) => (m === 'edit' ? 'view' : 'edit'));
    }
  };

  return (
    <DnDProvider>
      <div ref={local.ref} class={`${className()} relative`} style={style()} {...(rest as object)}>
        <MatrixContent
          rows={getRows}
          animated={local.animated}
          router={router}
          layoutMode={layoutMode}
          dndMode={dndMode}
          onBadgeToggle={handleBadgeToggle}
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
 * **DnD / edit-mode (Phase 1.2):**
 * - `layoutMode="edit"` — activates drag handles on `draggable: true` cells.
 * - `dndMode="swap"` (default) — dragging swaps children between cells.
 * - `onLayoutChange` — called with `{ kind: 'swap', a, b }` after each swap.
 * - Without `layoutMode` prop (uncontrolled) — an EditBadge in the top-right
 *   corner toggles edit mode. Badge only appears when any cell has `draggable: true`.
 *
 * SlotValue для preset-mode: `<MyWidget />` или
 * `{ children: <MyWidget />, initialSize: 0.2, draggable: true }`.
 */
export const Matrix = MatrixImpl;
