import {
  createSolidTable,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type PaginationState,
  type Row,
  type RowSelectionState,
  type SortingState,
  type Table as TanstackTable,
} from '@tanstack/solid-table';
import { createVirtualizer } from '@tanstack/solid-virtual';
import {
  createEffect,
  createSignal,
  For,
  mergeProps,
  Show,
  splitProps,
  useContext,
} from 'solid-js';

import { Button } from '../../primitives/button';
import { Table } from '../../primitives/table';
import { CompositeProxyContext } from '../compositeProxy';
import type { IDataTableInfiniteOptions, IDataTableProps } from './interfaces';

const DEFAULT_PAGE_SIZE = 10;
const DEFAULT_ITEM_HEIGHT = 36;
const DEFAULT_OVERSCAN = 5;
const DEFAULT_THRESHOLD = 5;

function resolveInfiniteOptions(
  infinite: boolean | IDataTableInfiniteOptions,
): Required<IDataTableInfiniteOptions> {
  const base = typeof infinite === 'object' ? infinite : {};
  return {
    itemHeight: base.itemHeight ?? DEFAULT_ITEM_HEIGHT,
    overscan: base.overscan ?? DEFAULT_OVERSCAN,
    threshold: base.threshold ?? DEFAULT_THRESHOLD,
  };
}

function EmptyState(props: { message?: string | import('solid-js').JSX.Element }) {
  return (
    <div class="flex h-24 items-center justify-center text-sm text-muted-foreground">
      <Show when={props.message !== undefined} fallback={<span>No results.</span>}>
        {props.message}
      </Show>
    </div>
  );
}

/**
 * Tailwind-классы для ячейки таблицы. Фиксируют high-priority три инварианта:
 *  - `whitespace-nowrap` — текст не переносится в несколько строк (фикс height row'а).
 *  - `overflow-hidden text-ellipsis` — длинный текст обрезается с `…`.
 *  - `align-middle` — вертикальное центрирование (важно когда row имеет explicit height).
 * Применяется и к `<th>`, и к `<td>` (см. TableHeaders + ...TableBody).
 */
const CELL_CLAMP_CLS = 'whitespace-nowrap overflow-hidden text-ellipsis';

// Shared header rendering — used in both standard and infinite modes
function TableHeaders<TData>(props: {
  table: TanstackTable<TData>;
  sorting: boolean;
  style?: import('solid-js').JSX.CSSProperties;
}) {
  return (
    <Table.Header style={props.style}>
      <For each={props.table.getHeaderGroups()}>
        {(headerGroup) => (
          <Table.Row>
            <For each={headerGroup.headers}>
              {(header) => (
                <Table.Head
                  class={[
                    CELL_CLAMP_CLS,
                    props.sorting && header.column.getCanSort() ? 'cursor-pointer select-none' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={
                    props.sorting && header.column.getCanSort()
                      ? header.column.getToggleSortingHandler()
                      : undefined
                  }
                >
                  <Show when={!header.isPlaceholder}>
                    <span class="inline-flex items-center gap-1">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      <Show when={props.sorting && header.column.getCanSort()}>
                        {header.column.getIsSorted() === 'asc'
                          ? ' ↑'
                          : header.column.getIsSorted() === 'desc'
                            ? ' ↓'
                            : ' ↕'}
                      </Show>
                    </span>
                  </Show>
                </Table.Head>
              )}
            </For>
          </Table.Row>
        )}
      </For>
    </Table.Header>
  );
}

/**
 * Props for wrapped data-row components inside the table bodies.
 * `meta` and `payload` are the per-row HCA target descriptors produced by
 * `itemMeta` / `itemPayload` factories on IDataTableProps. When
 * CompositeProxyContext.wrap is provided (injected by web-core), these are
 * read by the events-wrapper to build the HCA target for the emitted event.
 * When wrap is absent they are forwarded as plain HTML attributes (no-op).
 *
 * `active` is a reactive accessor (not a plain boolean) so that when external
 * state changes the highlight re-computes inside DataRow's own reactive scope
 * without forcing the parent `<For>` to re-run for the other rows.
 */
interface IDataRowProps<TData> {
  row: Row<TData>;
  selection: boolean;
  itemHeight?: number;
  meta?: { tags: string[]; [k: string]: unknown };
  payload?: Record<string, unknown>;
  hasMeta: boolean;
  /** Reactive accessor — true when this row is the externally-active row. */
  active?: () => boolean;
}

/**
 * Inner data-row component. Defined as a named component so the wrap factory
 * can attach a stable display name and web-core can register it correctly.
 * `meta` and `payload` are intentionally spread onto the <Table.Row> —
 * UiProxy in web-core reads them from the JSX props.
 * Non-standard props that DOM would reject are handled by UiProxy before
 * they reach the DOM (it strips them during event-binding).
 */
function DataRow<TData>(props: IDataRowProps<TData>) {
  const [local, rowProps] = splitProps(props, [
    'row',
    'selection',
    'itemHeight',
    'hasMeta',
    'active',
  ]);
  return (
    <Table.Row
      data-state={local.selection && local.row.getIsSelected() ? 'selected' : undefined}
      data-active={local.active?.() ? 'true' : undefined}
      style={local.itemHeight ? { height: `${local.itemHeight}px` } : undefined}
      classList={{
        'cursor-pointer': local.hasMeta,
        'bg-primary/20': !!local.active?.(),
      }}
      {...(rowProps as object)}
    >
      <For each={local.row.getVisibleCells()}>
        {(cell) => (
          <Table.Cell class={CELL_CLAMP_CLS}>
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </Table.Cell>
        )}
      </For>
    </Table.Row>
  );
}

function StandardTableBody<TData>(props: {
  rows: Row<TData>[];
  selection: boolean;
  itemHeight?: number;
  itemMeta?: (row: TData) => { tags: string[]; [k: string]: unknown };
  itemPayload?: (row: TData) => Record<string, unknown>;
  isRowActive?: (row: TData) => boolean;
  WrappedDataRow: (props: IDataRowProps<TData>) => import('solid-js').JSX.Element;
}) {
  return (
    <Table.Body>
      <For each={props.rows}>
        {(row) => {
          const meta = props.itemMeta ? props.itemMeta(row.original) : undefined;
          const payload = props.itemPayload ? props.itemPayload(row.original) : undefined;
          // Wrap the predicate in a stable getter so DataRow's classList
          // re-evaluates reactively when the external signal changes,
          // without causing the <For> loop to re-run for unrelated rows.
          const active = props.isRowActive ? () => props.isRowActive!(row.original) : undefined;
          return (
            <props.WrappedDataRow
              row={row}
              selection={props.selection}
              hasMeta={!!meta}
              meta={meta}
              payload={payload}
              active={active}
            />
          );
        }}
      </For>
    </Table.Body>
  );
}

/**
 * Virtual infinite scroll table body.
 *
 * Container занимает 100% высоты родителя (`h-full`) и скроллится в обе оси.
 * Внутри — обычный `<table>` с виртуализированным `<tbody>`:
 *  - **spacer-padding** вместо `position: absolute` (последний ломал column
 *    alignment, потому что absolute-positioned `<tr>` выпадает из table flow);
 *  - первый `<tr>` — невидимый spacer высотой до начала первой видимой строки;
 *  - последний `<tr>` — spacer высотой от конца последней видимой строки до
 *    общей высоты scroll-области (`virtualizer.getTotalSize()`);
 *  - middle rows — реальные `<Table.Row>` с фиксированной высотой `vRow.size`.
 *
 * `table-fixed` + `min-w-max` дают: колонки одной ширины (если не задана
 * `columnDef.size`), table растёт по width до содержимого → если общая ширина
 * больше контейнера, появляется horizontal scroll.
 */
function InfiniteTable<TData>(props: {
  table: TanstackTable<TData>;
  sorting: boolean;
  selection: boolean;
  infinite: boolean | IDataTableInfiniteOptions;
  onLoadMore?: () => void;
  itemMeta?: (row: TData) => { tags: string[]; [k: string]: unknown };
  itemPayload?: (row: TData) => Record<string, unknown>;
  isRowActive?: (row: TData) => boolean;
  WrappedDataRow: (props: IDataRowProps<TData>) => import('solid-js').JSX.Element;
}) {
  let scrollEl: HTMLDivElement | undefined;

  const opts = resolveInfiniteOptions(props.infinite);

  const virtualizer = createVirtualizer({
    get count() {
      return props.table.getRowModel().rows.length;
    },
    getScrollElement: () => scrollEl ?? null,
    estimateSize: () => opts.itemHeight,
    overscan: opts.overscan,
  });

  // Trigger onLoadMore when near the bottom
  createEffect(() => {
    if (!props.onLoadMore) return;
    const items = virtualizer.getVirtualItems();
    if (items.length === 0) return;
    const lastIndex = items[items.length - 1]?.index ?? 0;
    const rowCount = props.table.getRowModel().rows.length;
    if (lastIndex >= rowCount - opts.threshold) {
      props.onLoadMore();
    }
  });

  const rows = () => props.table.getRowModel().rows;
  const virtualItems = () => virtualizer.getVirtualItems();
  const paddingBefore = () => virtualItems()[0]?.start ?? 0;
  const paddingAfter = () => {
    const items = virtualItems();
    const lastEnd = items[items.length - 1]?.end ?? 0;
    return Math.max(0, virtualizer.getTotalSize() - lastEnd);
  };

  return (
    <div ref={scrollEl} class="h-full overflow-auto scrollbar-hover">
      <Table class="table-fixed min-w-max">
        <TableHeaders
          table={props.table}
          sorting={props.sorting}
          style={{ position: 'sticky', top: '0', 'z-index': '1', background: 'var(--background)' }}
        />

        <Table.Body>
          <Show when={paddingBefore() > 0}>
            <tr style={{ height: `${paddingBefore()}px` }} />
          </Show>

          <For each={virtualItems()}>
            {(vRow) => {
              const row = () => rows()[vRow.index];
              const meta = () => (props.itemMeta ? props.itemMeta(row().original) : undefined);
              const payload = () =>
                props.itemPayload ? props.itemPayload(row().original) : undefined;
              // Reactive getter so the highlight tracks external signal changes
              // without re-running the virtualizer's <For> loop for other rows.
              const active = props.isRowActive
                ? () => props.isRowActive!(row().original)
                : undefined;
              return (
                <props.WrappedDataRow
                  row={row()}
                  selection={props.selection}
                  itemHeight={vRow.size}
                  hasMeta={!!props.itemMeta}
                  meta={meta()}
                  payload={payload()}
                  active={active}
                  data-index={vRow.index}
                />
              );
            }}
          </For>

          <Show when={paddingAfter() > 0}>
            <tr style={{ height: `${paddingAfter()}px` }} />
          </Show>
        </Table.Body>
      </Table>
    </div>
  );
}

export function DataTable<TData>(rawProps: IDataTableProps<TData>) {
  const { wrap } = useContext(CompositeProxyContext);

  // Wrap the inner DataRow component once at construction time (not per render).
  // When wrap is undefined (Storybook / standalone) → identity, DataRow used as-is.
  const WrappedDataRow: (props: IDataRowProps<TData>) => import('solid-js').JSX.Element = wrap
    ? wrap(DataRow<TData>, 'DataTableRow')
    : DataRow<TData>;

  const props = mergeProps(
    { sorting: false, pagination: false, selection: false, filtering: false } as const,
    rawProps,
  );
  const [local] = splitProps(props, [
    'data',
    'columns',
    'sorting',
    'pagination',
    'infinite',
    'onLoadMore',
    'itemMeta',
    'itemPayload',
    'isRowActive',
    'selection',
    'filtering',
    'emptyMessage',
    'toolbar',
    'class',
  ]);

  // --- feature signals ---

  const [sortingState, setSortingState] = createSignal<SortingState>([]);
  const [rowSelectionState, setRowSelectionState] = createSignal<RowSelectionState>({});

  const isInfinite = () => !!local.infinite;

  const resolvedPageSize = () => {
    if (!local.pagination) return DEFAULT_PAGE_SIZE;
    if (typeof local.pagination === 'object') return local.pagination.pageSize ?? DEFAULT_PAGE_SIZE;
    return DEFAULT_PAGE_SIZE;
  };

  const [paginationState, setPaginationState] = createSignal<PaginationState>({
    pageIndex: 0,
    pageSize: resolvedPageSize(),
  });

  // --- table instance ---

  const table = createSolidTable<TData>({
    get data() {
      return local.data;
    },
    get columns() {
      // Cast: IColumn<TData> is structurally compatible with ColumnDef<TData>.
      return local.columns as Parameters<typeof createSolidTable<TData>>[0]['columns'];
    },
    getCoreRowModel: getCoreRowModel(),

    // sorting
    ...(local.sorting && {
      onSortingChange: setSortingState,
      getSortedRowModel: getSortedRowModel(),
    }),

    // pagination — skip when infinite scroll is enabled
    ...(local.pagination &&
      !local.infinite && {
        onPaginationChange: setPaginationState,
        getPaginationRowModel: getPaginationRowModel(),
      }),

    // selection
    ...(local.selection && {
      onRowSelectionChange: setRowSelectionState,
      enableRowSelection: true,
    }),

    // filtering
    ...(local.filtering && {
      getFilteredRowModel: getFilteredRowModel(),
    }),

    state: {
      get sorting() {
        return sortingState();
      },
      get pagination() {
        return paginationState();
      },
      get rowSelection() {
        return rowSelectionState();
      },
    },
  });

  const isEmpty = () => local.data.length === 0;

  // Корневой контейнер — `h-full flex flex-col`. Toolbar/pagination — auto-height,
  // table-секция — `flex-1 min-h-0` (растягивается по родителю + min-h-0 нужен,
  // чтобы внутренний `h-full overflow-auto` InfiniteTable получил реальную
  // высоту, а не схлопнулся в content height).
  return (
    <div class={`flex h-full min-h-0 flex-col ${local.class ?? ''}`}>
      <Show when={local.toolbar !== undefined}>
        <div class="mb-component">{local.toolbar}</div>
      </Show>

      <div class="min-h-0 flex-1">
        <Show when={!isEmpty()} fallback={<EmptyState message={local.emptyMessage} />}>
          <Show
            when={isInfinite()}
            fallback={
              // --- Standard (non-virtual) render ---
              <Table>
                <TableHeaders table={table} sorting={!!local.sorting} />
                <StandardTableBody
                  rows={table.getRowModel().rows}
                  selection={!!local.selection}
                  itemMeta={local.itemMeta}
                  itemPayload={local.itemPayload}
                  isRowActive={local.isRowActive}
                  WrappedDataRow={WrappedDataRow}
                />
              </Table>
            }
          >
            <InfiniteTable
              table={table}
              sorting={!!local.sorting}
              selection={!!local.selection}
              infinite={local.infinite!}
              onLoadMore={local.onLoadMore}
              itemMeta={local.itemMeta}
              itemPayload={local.itemPayload}
              isRowActive={local.isRowActive}
              WrappedDataRow={WrappedDataRow}
            />
          </Show>
        </Show>
      </div>

      {/* Pagination controls (only when infinite is NOT enabled) */}
      <Show when={local.pagination && !local.infinite}>
        <div class="mt-component flex items-center justify-between text-sm">
          <span class="text-muted-foreground">
            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
          </span>
          <div class="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={!table.getCanPreviousPage()}
              onClick={() => table.previousPage()}
            >
              Previous
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!table.getCanNextPage()}
              onClick={() => table.nextPage()}
            >
              Next
            </Button>
          </div>
        </div>
      </Show>
    </div>
  );
}
