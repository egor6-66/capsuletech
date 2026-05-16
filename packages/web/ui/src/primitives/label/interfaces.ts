import type { VariantProps } from 'class-variance-authority';
import type { JSX } from 'solid-js';
import type { labelCva } from './variants';

// Используем стандартные атрибуты Label из Solid
export interface ILabelProps
  extends JSX.LabelHTMLAttributes<HTMLLabelElement>,
    VariantProps<typeof labelCva> {
  // Добавляем class явно, так как в Solid это основной способ передачи стилей
  class?: string;
  // Если ты используешь ref, типизируем его правильно для Solid
  ref?: HTMLLabelElement | ((el: HTMLLabelElement) => void);
}
