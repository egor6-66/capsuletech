import { type ICapsuleRouter, RouterContext } from '@capsuletech/web-router';
import { createStyle } from '@capsuletech/web-style';
import { For, type JSX, splitProps, useContext } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import { Animate, type AnimateVariant } from '../../wrappers/animate';
import { Flex } from '../flex/flex';
import type { IFlexItem } from '../flex/interfaces';
import type { ICell, IMatrixProps, IRow } from './interfaces';
import { resolvePreset } from './presets';
import { matrixCva, matrixSlots } from './variants';

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
): JSX.Element => {
  const tag = cell.tag ?? 'div';
  const isMain = cell.id === 'main';
  const content = isMain ? animateMain(cell.children, animated, router) : cell.children;

  // fr width: flex-1 (no Panel, just grow)
  // Other widths handled by the row-level Flex items machinery
  return (
    <Dynamic component={tag} class={isMain ? matrixSlots.resizeMain : matrixSlots.resizeSlot}>
      {content}
    </Dynamic>
  );
};

// ---------------------------------------------------------------------------
// Row renderer — turns one IRow into a horizontal Flex (resizable or static)
// ---------------------------------------------------------------------------

/**
 * Converts IRow cells into IFlexItem[].
 *
 * Cells with `width='fr'` or `width=undefined` (and not resizable) get no
 * initialSize — fillInitialSizes inside Flex will distribute the remainder.
 * Cells with `width='auto'` also get no initialSize but are non-resizable.
 */
const rowToFlexItems = (
  row: IRow,
  animated: boolean | AnimateVariant | undefined,
  router: ICapsuleRouter | null,
): IFlexItem[] =>
  row.cells.map((cell) => {
    const widthIsNumber = typeof cell.width === 'number';
    return {
      children: renderCell(cell, animated, router),
      resizable: cell.resizable ?? false,
      initialSize: widthIsNumber ? (cell.width as number) : undefined,
      minSize: undefined,
      maxSize: undefined,
    };
  });

/**
 * Checks whether any cell in the row opts-in to resizable.
 */
const rowHasResizable = (row: IRow): boolean => row.cells.some((c) => c.resizable === true);

// ---------------------------------------------------------------------------
// Renders a single row
//
// NB: absolute/inset containment для corvu — same pattern as the old matrix.
// corvu measures rootSize via ResizeObserver on its DOM element. When the
// container is a flex item without an explicit height, `h-full` resolves to
// content-height → corvu Root grows unbounded. `relative` + `absolute inset-0`
// breaks the percentage-height chain and gives corvu a stable measure target.
// ---------------------------------------------------------------------------

const renderRow = (
  row: IRow,
  animated: boolean | AnimateVariant | undefined,
  router: ICapsuleRouter | null,
): JSX.Element => {
  const hasResizable = rowHasResizable(row);

  if (hasResizable) {
    const items = rowToFlexItems(row, animated, router);
    return (
      <div class="relative h-full min-h-0 flex-1 overflow-hidden">
        <div class="absolute inset-0">
          <Flex orientation="horizontal" items={items} withHandle />
        </div>
      </div>
    );
  }

  // Static row — plain flex-row, no corvu
  return (
    <div
      class="flex min-h-0 w-full overflow-hidden"
      classList={{ 'flex-1': row.height === 'fr' || row.height === undefined }}
    >
      <For each={row.cells}>{(cell) => renderCell(cell, animated, router)}</For>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Rows-engine — renders rows as a vertical Flex (resizable or static)
// ---------------------------------------------------------------------------

/**
 * Converts IRow[] into vertical IFlexItem[] for the outer vertical Flex.
 */
const rowsToVerticalItems = (
  rows: IRow[],
  animated: boolean | AnimateVariant | undefined,
  router: ICapsuleRouter | null,
): IFlexItem[] =>
  rows.map((row) => {
    const heightIsNumber = typeof row.height === 'number';
    const isResizable = row.resizable ?? true;
    return {
      children: renderRow(row, animated, router),
      resizable: isResizable,
      initialSize: heightIsNumber ? (row.height as number) : undefined,
    };
  });

/**
 * Checks whether any row opts-in to vertical resizable.
 */
const hasVerticalResizable = (rows: IRow[]): boolean =>
  rows.some((r) => {
    // A row is resizable if it has an explicit `resizable: true`
    // OR if it has a numeric height (→ corvu Panel basis)
    return r.resizable === true || typeof r.height === 'number';
  });

// ---------------------------------------------------------------------------
// MatrixImpl
// ---------------------------------------------------------------------------

const MatrixImpl = (props: IMatrixProps) => {
  // Split out Phase 1.2 noop props so they don't leak to the DOM
  const [local, rest] = splitProps(
    props as IMatrixProps & { dndMode?: unknown; layoutMode?: unknown; onLayoutChange?: unknown },
    [
      'class',
      'style',
      'ref',
      'animated',
      // preset-mode
      'preset',
      'slots',
      // raw mode
      'rows',
      // Phase 1.2 noop placeholders
      'dndMode',
      'layoutMode',
      'onLayoutChange',
    ],
  );

  const { className, style } = createStyle(matrixCva, {
    class: local.class,
    style: local.style,
  });

  // Soft-dep on router
  const router = useContext(RouterContext);

  // Resolve rows: preset → resolvePreset, raw → use directly
  const getRows = (): IRow[] => {
    if (local.preset != null) {
      return resolvePreset(
        local.preset as keyof import('./interfaces').LayoutPresets,
        local.slots as never,
      );
    }
    return (local.rows as IRow[]) ?? [];
  };

  const renderContent = (): JSX.Element => {
    const rows = getRows();

    if (rows.length === 0) return null;

    // Single row, single cell (centroid or trivial) — shortcut
    if (rows.length === 1 && rows[0].cells.length === 1 && !rows[0].resizable) {
      const cell = rows[0].cells[0];
      const isMain = cell.id === 'main';
      if (!rows[0].height || rows[0].height === 'fr') {
        return (
          <div class="flex h-full w-full items-center justify-center">
            {isMain ? animateMain(cell.children, local.animated, router) : cell.children}
          </div>
        );
      }
    }

    // Multi-row or single resizable row
    const useVertical = hasVerticalResizable(rows);

    if (useVertical) {
      const verticalItems = rowsToVerticalItems(rows, local.animated, router);
      return (
        // NB: same absolute containment as old matrix — see comment above renderRow
        <div class="relative h-full w-full overflow-hidden">
          <div class="absolute inset-0">
            <Flex orientation="vertical" items={verticalItems} withHandle />
          </div>
        </div>
      );
    }

    // All rows are non-resizable — static flex-col
    return (
      <div class="flex h-full w-full flex-col overflow-hidden">
        <For each={rows}>
          {(row) => {
            // 'auto' height — wrap in a non-growing div
            if (row.height === 'auto' || (row.height === undefined && rows.length > 1)) {
              return <div class="w-full shrink-0">{renderRow(row, local.animated, router)}</div>;
            }
            return renderRow(row, local.animated, router);
          }}
        </For>
      </div>
    );
  };

  return (
    <div ref={local.ref} class={className()} style={style()} {...(rest as object)}>
      {renderContent()}
    </div>
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
 *        { id: 'a', children: <A />, width: 0.5, resizable: true },
 *        { id: 'b', children: <B />, width: 0.5, resizable: true },
 *      ]},
 *    ]} />
 *    ```
 *
 * SlotValue для preset-mode: либо JSX напрямую (`<MyWidget />`), либо
 * object-форма (`{ children: <MyWidget />, initialSize: 0.2 }`).
 *
 * **Phase 1.2 placeholders:** `dndMode`, `layoutMode`, `onLayoutChange` приняты
 * в типах но не реализованы — будут добавлены с DnD в Phase 1.2.
 */
export const Matrix = MatrixImpl;
