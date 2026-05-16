import type { VariantProps } from 'class-variance-authority';
import type { JSX } from 'solid-js';
import type { navigationCva, navigationItemCva } from './variants';

export type NavigationVariants = VariantProps<typeof navigationCva>;
export type NavigationItemVariants = VariantProps<typeof navigationItemCva>;

export interface INavigationProps
  extends Omit<JSX.HTMLAttributes<HTMLElement>, 'children'>,
    NavigationVariants {
  children: JSX.Element;
}

export interface INavigationListProps<T = any>
  extends Omit<JSX.HTMLAttributes<HTMLElement>, 'children'> {
  items?: T[] | undefined | null;
  children: (item: T, index: () => number) => JSX.Element;
  orientation?: 'horizontal' | 'vertical';
}

export interface INavigationItemProps
  extends Omit<JSX.AnchorHTMLAttributes<HTMLAnchorElement>, 'children'>,
    NavigationItemVariants {
  children: JSX.Element;
  active?: boolean;
  disabled?: boolean;
}
