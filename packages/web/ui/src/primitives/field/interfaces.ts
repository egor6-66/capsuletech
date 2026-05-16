import type { VariantProps } from 'class-variance-authority';
import type { JSX } from 'solid-js';
import type { fieldCva } from './variants';
export type FieldVariants = VariantProps<typeof fieldCva>;
export interface IFieldProps extends JSX.HTMLAttributes<HTMLDivElement>, FieldVariants {}
