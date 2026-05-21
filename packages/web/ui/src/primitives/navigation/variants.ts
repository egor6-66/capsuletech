import { cva } from '@capsuletech/web-style';

export const navigationVariants = {
  orientation: {
    horizontal: 'flex flex-row gap-1',
    vertical: 'flex flex-col gap-1',
  },
};

export const navigationCva = cva(
  'sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60',
  {
    variants: navigationVariants,
    defaultVariants: {
      orientation: 'horizontal',
    },
  },
);

export const navigationListVariants = {
  orientation: {
    horizontal: 'flex flex-row gap-0 items-center',
    vertical: 'flex flex-col gap-0 items-start',
  },
};

export const navigationListCva = cva('flex w-full', {
  variants: navigationListVariants,
  defaultVariants: {
    orientation: 'horizontal',
  },
});

export const navigationItemVariants = {
  variant: {
    default:
      'text-foreground/70 transition-colors duration-fast hover:text-foreground hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-md',
    active: 'text-foreground bg-accent/10 border-b-2 border-primary font-medium hover:bg-accent/20',
  },
  size: {
    default: 'px-button py-cell text-sm',
    lg: 'px-button-lg py-cell-loose text-base',
  },
};

export const navigationItemCva = cva(
  'relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-colors duration-fast focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50',
  {
    variants: navigationItemVariants,
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);
