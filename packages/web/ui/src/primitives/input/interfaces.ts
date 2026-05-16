import type { VariantProps } from 'class-variance-authority';
import type { JSX } from 'solid-js';
import type { inputCva } from './variants';

export type InputVariants = VariantProps<typeof inputCva>;

export interface IInputProps
  extends Omit<JSX.InputHTMLAttributes<HTMLInputElement>, 'size'>,
    InputVariants {}
