import type { ColumnDef } from '@tanstack/solid-table';
import type { JSX } from 'solid-js';

export type { ColumnDef } from '@tanstack/solid-table';

/**
 * Typed column definition wrapper.
 *
 * Tightens `accessorKey` from `string` to `keyof TData & string` so that TS
 * catches mismatched keys at the call-site. All other `ColumnDef` fields are
 * inherited unchanged.
 *
 * Note: TanStack's own `ColumnDef<TData>` types `accessorKey` as `string`
 * (they use a separate generic for the value), so this wrapper adds the
 * constraint we want without changing runtime behaviour.
 */
export type IColumn<TData> = Omit<ColumnDef<TData>, 'accessorKey'> & {
  accessorKey?: keyof TData & string;
};

export interface IDataTableInfiniteOptions {
  /** Estimated row height in px. Default: 36. */
  itemHeight?: number;
  /** Number of rows rendered outside the visible area. Default: 5. */
  overscan?: number;
  /**
   * How many rows before the end of the list triggers `onLoadMore`.
   * Only used when `onLoadMore` is also provided. Default: 5.
   */
  threshold?: number;
}

export interface IDataTableProps<TData> {
  data: TData[];
  /**
   * Column definitions. Prefer `IColumn<TData>[]` over raw `ColumnDef<TData>[]`
   * for tight `accessorKey` inference.
   */
  columns: IColumn<TData>[];

  /**
   * Enable click-to-sort on column headers.
   * Shows ↑ / ↓ / ↕ direction indicators.
   */
  sorting?: boolean;

  /**
   * @deprecated Use `infinite` instead for large datasets.
   * Enable row pagination (click Prev/Next).
   * Pass `true` for default pageSize (10) or an object to configure it.
   */
  pagination?: boolean | { pageSize?: number };

  /**
   * Enable virtual infinite scroll via @tanstack/solid-virtual.
   * Pass `true` for defaults or an object to tune behaviour.
   *
   * When enabled:
   * - `pagination` is ignored.
   * - All rows are passed to TanStack Table (no getPaginationRowModel).
   * - Only visible rows are rendered (row recycling).
   *
   * Defaults: `{ itemHeight: 36, overscan: 5, threshold: 5 }`.
   */
  infinite?: boolean | IDataTableInfiniteOptions;

  /**
   * Called when the user scrolls within `threshold` rows of the end.
   * Only fires when `infinite` is enabled. Use for server-side pagination /
   * "load more" pattern.
   */
  onLoadMore?: () => void;

  /**
   * Enable a leading checkbox column + row selection state.
   * Consumer is responsible for adding a select ColumnDef if they need
   * custom rendering; this flag wires the selection row model.
   */
  selection?: boolean;

  /**
   * Enable client-side global text filtering.
   * Pair with the `toolbar` slot to render a filter <Input>.
   */
  filtering?: boolean;

  /**
   * Content rendered when `data.length === 0`.
   * Defaults to a simple centred "No results." message.
   */
  emptyMessage?: string | JSX.Element;

  /**
   * Slot rendered above the table (e.g. a search Input).
   * Receives no special wiring — consumer controls the signal.
   */
  toolbar?: JSX.Element;

  /** Extra class on the outer wrapper div. */
  class?: string;
}
