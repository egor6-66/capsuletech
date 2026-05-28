import type { JSX } from 'solid-js';

/**
 * One field definition in PreviewCard.
 *
 * Mirrors the accessor pattern from @tanstack/solid-table `ColumnDef` so that
 * consumers already familiar with DataTable feel at home.
 */
export interface IPreviewCardField<TData> {
  /**
   * Accessor key — must be a direct key of TData.
   * If both `accessorFn` and `accessorKey` are provided, `accessorFn` wins.
   */
  accessorKey?: keyof TData & string;

  /**
   * Custom value extractor from the row object.
   * Takes precedence over `accessorKey` when both are supplied.
   */
  accessorFn?: (row: TData) => unknown;

  /**
   * Field label — rendered as muted small typography above the value.
   */
  header: string;

  /**
   * Custom cell renderer (e.g. formatters, links, badges).
   * When provided, replaces the default `<Typography>` value rendering.
   */
  cell?: (info: { getValue: () => unknown; row: TData }) => JSX.Element;

  /**
   * Stable key used for the field in the `<For>` loop.
   * Derived automatically from `accessorKey` when absent.
   * Required when using `accessorFn` without `accessorKey`.
   */
  id?: string;
}

export interface IPreviewCardProps<TData> {
  /**
   * Single item to preview.
   * When `null` or `undefined`, `emptyMessage` is rendered instead of field rows.
   */
  data: TData | undefined | null;

  /**
   * Ordered list of field definitions.
   * Fields are rendered in array order.
   */
  fields: IPreviewCardField<TData>[];

  /**
   * Content shown when `data` is null/undefined.
   * Accepts a plain string or arbitrary JSX.
   * When omitted, an empty fragment is rendered (no visible empty state).
   */
  emptyMessage?: string | JSX.Element;

  /**
   * Extra class applied to the outer wrapper element.
   * The wrapper is a flex-col container.
   */
  class?: string;
}
