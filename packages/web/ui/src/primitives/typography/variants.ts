import { cva } from '@capsuletech/web-style';

export const variants = {
  variant: {
    h1: 'scroll-m-20 text-4xl font-extrabold tracking-tight leading-tight',
    h2: 'scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight leading-tight',
    p: 'leading-normal text-base',
    blockquote: 'mt-6 border-l-2 pl-6 italic',
    code: 'relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm font-semibold',
    lead: 'text-xl leading-relaxed text-muted-foreground',
  },
  color: {
    default: 'text-foreground',
    muted: 'text-muted-foreground',
    primary: 'text-primary',
    destructive: 'text-destructive',
  },
};

export const typographyCva = cva(
  'transition-colors duration-fast relative group/typo flex items-center gap-2',
  {
    variants,
    defaultVariants: {
      variant: 'p',
      color: 'default',
    },
  },
);
