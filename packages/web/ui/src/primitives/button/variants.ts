import { cva } from '@capsuletech/web-style';

export const variants = {
  variant: {
    default: 'bg-primary text-primary-foreground shadow hover:bg-primary/90',
    destructive: 'bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90',
    outline:
      'border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground',
    secondary: 'bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80',
    ghost: 'hover:bg-accent hover:text-accent-foreground',
    link: 'text-primary underline-offset-4 hover:underline',
  },
  size: {
    default: 'h-auto px-button py-button-sm',
    sm: 'h-auto rounded-md px-button-sm py-cell-tight text-xs',
    lg: 'h-auto rounded-md px-button-lg py-button',
    icon: 'h-9 w-9 p-0',
  },
};

export const buttonCva = cva(
  'cursor-pointer inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors duration-fast focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants,
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);
