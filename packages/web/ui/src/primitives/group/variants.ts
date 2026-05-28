import { cva } from '@capsuletech/web-style';

/**
 * Separator внутри Group — визуальный разделитель.
 * orientation='vertical'   → вертикальная линия (1px × stretch) — для горизонтального Group.
 * orientation='horizontal' → горизонтальная линия (∞ × 1px)    — для вертикального Group.
 */
export const groupSeparatorVariants = cva('shrink-0 bg-border', {
  variants: {
    orientation: {
      horizontal: 'h-px w-auto',            // горизонтальная линия (∞×1px)
      vertical: 'h-auto w-px self-stretch', // вертикальная линия  (1px×∞)
    },
  },
  defaultVariants: { orientation: 'vertical' },
});
