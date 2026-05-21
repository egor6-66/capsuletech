import type { JSX } from 'solid-js';

export interface ITableProps extends JSX.HTMLAttributes<HTMLTableElement> {}

export interface ITableHeaderProps extends JSX.HTMLAttributes<HTMLTableSectionElement> {}

export interface ITableBodyProps extends JSX.HTMLAttributes<HTMLTableSectionElement> {}

export interface ITableRowProps extends JSX.HTMLAttributes<HTMLTableRowElement> {
  /** Set to "selected" to apply selected row styling via data-[state=selected] */
  'data-state'?: 'selected' | string;
}

export interface ITableHeadProps extends JSX.ThHTMLAttributes<HTMLTableCellElement> {}

export interface ITableCellProps extends JSX.TdHTMLAttributes<HTMLTableCellElement> {}
