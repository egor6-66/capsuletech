import type { VariantProps } from 'class-variance-authority';
import type { Component, JSX } from 'solid-js';
import type { typographyCva } from './variants';

export type TypographyVariants = VariantProps<typeof typographyCva>;

export interface ITypographyProps extends JSX.HTMLAttributes<HTMLElement>, TypographyVariants {
  // В Solid используем string или Component для динамических тегов
  as?: string | Component<any>;
}
