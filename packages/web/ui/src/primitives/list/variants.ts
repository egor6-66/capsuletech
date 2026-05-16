import { cva } from '@capsuletech/web-style';

export const listVariants = cva('flex w-full', {
  variants: {
    orientation: {
      vertical: 'flex-col gap-1',
      horizontal: 'flex-row gap-2 items-center',
    },
    variant: {
      default: 'p-1',
      flush: 'p-0 gap-0',
    },
  },
  defaultVariants: {
    orientation: 'vertical',
    variant: 'default',
  },
});

export const listItemVariants = cva(
  'flex items-center px-3 py-2 rounded-md text-sm transition-colors cursor-pointer outline-none shrink-0',
  {
    variants: {
      variant: {
        default: 'hover:bg-accent hover:text-accent-foreground focus:bg-accent',
        active: 'bg-primary text-primary-foreground',
        ghost: 'hover:bg-muted',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);
