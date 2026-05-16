import type { SeparatorRootProps } from '@kobalte/core/separator';
import type { VariantProps } from 'class-variance-authority';
import type { JSX } from 'solid-js';
import type { separatorCva } from './variants';

// Используем прямой VariantProps, чтобы избежать проблем с StyleVariants
export interface ISeparatorProps extends SeparatorRootProps {
  variant?: VariantProps<typeof separatorCva>['variant'];
  class?: string;
  style?: JSX.CSSProperties | string;
}
