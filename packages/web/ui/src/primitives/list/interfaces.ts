import type { VariantProps } from 'class-variance-authority';
import type { JSX } from 'solid-js';
import type { listItemVariants, listVariants } from './variants';

export interface IListItemProps extends Omit<JSX.HTMLAttributes<HTMLDivElement>, 'children'> {
  variant?: VariantProps<typeof listItemVariants>['variant'];
  asChild?: boolean;
  children?: JSX.Element | ((props: any) => JSX.Element);
  class?: string;
  style?: JSX.CSSProperties | string;
}

export interface IListProps<T> extends Omit<JSX.HTMLAttributes<HTMLDivElement>, 'children'> {
  items?: T[] | undefined | null;
  // Функция отрисовки (render prop)
  children: (item: T, index: () => number) => JSX.Element;
  variant?: VariantProps<typeof listVariants>['variant'];
  orientation?: VariantProps<typeof listVariants>['orientation'];
  class?: string;
  style?: JSX.CSSProperties | string;
}
export interface IVirtualListProps<T> extends IListProps<T> {
  estimateSize?: number;
}
