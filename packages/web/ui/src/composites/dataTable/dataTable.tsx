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
import { For, Show, createEffect, createSignal, mergeProps, splitProps } from 'solid-js';

import { Button } from '../../primitives/button';
import { Table } from '../../primitives/table';
import type { IDataTableInfiniteOptions, IDataTableProps } from './interfaces';

const DEFAULT_PAGE_SIZE = 10;
const DEFAULT_ITEM_HEIGHT = 36;
const DEFAULT_OVERSCAN = 5;
const DEFAULT_THRESHOLD = 5;

function resolveInfiniteOptions(infinite: boolean | IDataTableInfiniteOptions): Required<IDataTableInfiniteOptions> {
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
                  class={props.sorting && header.column.getCanSort() ? 'cursor-pointer select-none' : undefined}
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

function StandardTableBody<TData>(props: {
  rows: Row<TData>[];
  selection: boolean;
}) {
  return (
    <Table.Body>
      <For each={props.rows}>
        {(row) => (
          <Table.Row data-state={props.selection && row.getIsSelected() ? 'selected' : undefined}>
            <For each={row.getVisibleCells()}>
              {(cell) => (
                <Table.Cell>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </Table.Cell>
              )}
            </For>
          </Table.Row>
        )}
      </For>
    </Table.Body>
  );
}

// Virtual infinite scroll table body
function InfiniteTable<TData>(props: {
  table: TanstackTable<TData>;
  sorting: boolean;
  selection: boolean;
  infinite: boolean | IDataTableInfiniteOptions;
  onLoadMore?: () => void;
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

  return (
    <div
      ref={scrollEl}
      class="relative overflow-auto scrollbar-hover"
      style={{ height: '400px' }}
    >
      {/* Spacer: tells the browser the full scroll height */}
      <div style={{ height: `${virtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
        <Table>
          <TableHeaders
            table={props.table}
            sorting={props.sorting}
            style={{ position: 'sticky', top: '0', 'z-index': '1', background: 'var(--background)' }}
          />

          <Table.Body>
            <For each={virtualizer.getVirtualItems()}>
              {(vRow) => {
                const row = () => rows()[vRow.index];
                return (
                  <Table.Row
                    data-index={vRow.index}
                    data-state={props.selection && row().getIsSelected() ? 'selected' : undefined}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: `${vRow.size}px`,
                      transform: `translateY(${vRow.start}px)`,
                    }}
                  >
                    <For each={row().getVisibleCells()}>
                      {(cell) => (
                        <Table.Cell>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </Table.Cell>
                      )}
                    </For>
                  </Table.Row>
                );
              }}
            </For>
          </Table.Body>
        </Table>
      </div>
    </div>
  );
}

export function DataTable<TData>(rawProps: IDataTableProps<TData>) {
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
    ...(local.pagination && !local.infinite && {
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

  return (
    <div class={local.class}>
      <Show when={local.toolbar !== undefined}>
        <div class="mb-component">{local.toolbar}</div>
      </Show>

      <Show when={!isEmpty()} fallback={<EmptyState message={local.emptyMessage} />}>
        <Show
          when={isInfinite()}
          fallback={
            // --- Standard (non-virtual) render ---
            <Table>
              <TableHeaders table={table} sorting={!!local.sorting} />
              <StandardTableBody rows={table.getRowModel().rows} selection={!!local.selection} />
            </Table>
          }
        >
          <InfiniteTable
            table={table}
            sorting={!!local.sorting}
            selection={!!local.selection}
            infinite={local.infinite!}
            onLoadMore={local.onLoadMore}
          />
        </Show>
      </Show>

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
