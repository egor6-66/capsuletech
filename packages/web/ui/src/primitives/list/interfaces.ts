import type { VariantProps } from 'class-variance-authority';
import type { Component, JSX } from 'solid-js';
import type { listItemVariants, listVariants } from './variants';

export interface IListItemProps extends Omit<JSX.HTMLAttributes<HTMLDivElement>, 'children'> {
  variant?: VariantProps<typeof listItemVariants>['variant'];
  asChild?: boolean;
  children?: JSX.Element | ((props: any) => JSX.Element);
  class?: string;
  style?: JSX.CSSProperties | string;
}

/** Render-prop (classic) mode: items + children as render function. */
export interface IListRenderProps<T> extends Omit<JSX.HTMLAttributes<HTMLDivElement>, 'children'> {
  items: T[];
  children: (item: T, index: () => number) => JSX.Element;
  /** Batch mode props must be absent in render-prop mode. */
  data?: never;
  as?: never;
  itemProps?: never;
  variant?: VariantProps<typeof listVariants>['variant'];
  orientation?: VariantProps<typeof listVariants>['orientation'];
  class?: string;
  style?: JSX.CSSProperties | string;
}

/** Batch mode: pass `data` array + `as` template component. */
export interface IListBatchProps<T> extends Omit<JSX.HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Data array — rendered via <For> internally. */
  data: T[];
  /** Template component rendered for each item. Receives spread of itemProps(item). */
  as: Component<any>;
  /** Maps each item to props for the template. Defaults to identity (item as-is). */
  itemProps?: (item: T) => Record<string, unknown>;
  /** items/children must be absent in batch mode. */
  items?: never;
  children?: never;
  variant?: VariantProps<typeof listVariants>['variant'];
  orientation?: VariantProps<typeof listVariants>['orientation'];
  class?: string;
  style?: JSX.CSSProperties | string;
}

/** Semantic (no data) mode: plain children, no iteration. */
export interface IListSemanticProps extends JSX.HTMLAttributes<HTMLUListElement> {
  data?: never;
  as?: never;
  itemProps?: never;
  items?: never;
  variant?: VariantProps<typeof listVariants>['variant'];
  orientation?: VariantProps<typeof listVariants>['orientation'];
  class?: string;
  style?: JSX.CSSProperties | string;
}

/** Union of all three list modes. */
export type IListProps<T = unknown> = IListRenderProps<T> | IListBatchProps<T> | IListSemanticProps;

export interface IVirtualListProps<T> extends Omit<JSX.HTMLAttributes<HTMLDivElement>, 'children'> {
  items: T[];
  children: (item: T, index: () => number) => JSX.Element;
  estimateSize?: number;
  variant?: VariantProps<typeof listVariants>['variant'];
  orientation?: VariantProps<typeof listVariants>['orientation'];
  class?: string;
  style?: JSX.CSSProperties | string;
}
