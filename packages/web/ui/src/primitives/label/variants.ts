import { cva } from '@capsuletech/web-style';

export const variants = {
  variant: {
    default: 'text-primary shadow',
  },
  size: {
    default: '',
  },
};

export const labelCva = cva(
  'text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
  {
    variants,
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);
