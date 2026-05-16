import { cva } from '@capsule/web-style';

export const variants = {
  variant: {
    default: '',
  },
  size: {
    default: '',
  },
};

export const cardCva = cva('rounded-xl border bg-card text-card-foreground shadow', {
  variants,

  defaultVariants: {
    variant: 'default',
    size: 'default',
  },
});
