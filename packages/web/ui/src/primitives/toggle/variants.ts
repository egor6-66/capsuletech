import { cva } from '@capsuletech/web-style';

/**
 * Track — внешняя кнопка-переключатель. `data-checked` атрибут управляет
 * цветом из темы (`bg-primary` vs `bg-muted`). `group` нужен, чтобы дочерний
 * thumb мог реагировать на data-checked родителя.
 */
export const toggleTrackCva = cva(
  'group relative inline-flex items-center rounded-full border border-border bg-muted transition-colors duration-fast cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[checked]:bg-primary data-[checked]:border-primary',
  {
    variants: {
      size: {
        sm: 'h-4 w-7',
        md: 'h-5 w-9',
        lg: 'h-6 w-11',
      },
    },
    defaultVariants: { size: 'md' },
  },
);

/**
 * Thumb — белый/foreground кружок, едет по треку. Реагирует на
 * `data-checked` на родителе через `group-data-[checked]:`.
 */
export const toggleThumbCva = cva(
  'block rounded-full bg-background shadow-md transition-transform duration-fast translate-x-0.5',
  {
    variants: {
      size: {
        sm: 'h-3 w-3 group-data-[checked]:translate-x-3',
        md: 'h-3.5 w-3.5 group-data-[checked]:translate-x-[18px]',
        lg: 'h-5 w-5 group-data-[checked]:translate-x-5',
      },
    },
    defaultVariants: { size: 'md' },
  },
);

export const toggleLabelCva = cva('select-none cursor-pointer text-foreground transition-colors duration-fast', {
  variants: {
    size: {
      sm: 'text-xs',
      md: 'text-sm',
      lg: 'text-base',
    },
  },
  defaultVariants: { size: 'md' },
});
