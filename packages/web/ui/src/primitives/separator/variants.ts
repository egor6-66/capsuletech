import { cva } from '@capsuletech/web-style';

export const variants = {
  variant: {
    horizontal: 'h-[1px] w-full',
    vertical: 'h-full w-[1px]',
  },
};

export const separatorCva = cva('shrink-0 bg-border', {
  variants,
  defaultVariants: {
    variant: 'horizontal',
  },
});
