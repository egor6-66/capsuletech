import { cva } from '@capsuletech/web-style';

export const variants = {
  variant: {
    // default: 'text-primary-foreground shadow hover:bg-primary/90',
  },
  size: {
    default: 'h-auto px-input py-input',
  },
};

export const inputCva = cva(
  'flex w-full rounded-md border border-input text-sm shadow-sm transition-colors duration-fast file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants,
    defaultVariants: {
      // variant: 'default',
      size: 'default',
    },
  },
);
