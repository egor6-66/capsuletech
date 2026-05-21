import { cva } from '@capsuletech/web-style';

export const variants = {
  variant: {
    default: '',
  },
  size: {
    default: '',
  },
};

export const cardCva = cva('rounded-lg border bg-card text-card-foreground shadow', {
  variants,

  defaultVariants: {
    variant: 'default',
    size: 'default',
  },
});
