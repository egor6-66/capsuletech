import type { VariantProps } from 'class-variance-authority';
import type { JSX } from 'solid-js';
import type { cardCva } from './variants';

export type CardVariants = VariantProps<typeof cardCva>;

export interface ICardProps extends JSX.HTMLAttributes<HTMLDivElement>, CardVariants {}
