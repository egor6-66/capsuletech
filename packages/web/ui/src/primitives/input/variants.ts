import { cva } from '@capsule/web-style';

export const variants = {
  variant: {
    // default: 'text-primary-foreground shadow hover:bg-primary/90',
  },
  size: {
    default: 'h-auto  p-component',
  },
};

export const inputCva = cva(
  'flex h-9 w-full rounded-md border border-input text-base shadow-sm transition-colors file:border-0  file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
  {
    variants,
    defaultVariants: {
      // variant: 'default',
      size: 'default',
    },
  },
);
