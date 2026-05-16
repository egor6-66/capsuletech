import { cva } from '@capsuletech/web-style';

export const layoutSlots = {
  header: 'sticky top-0 z-40 w-full  backdrop-blur px-[--layout-padding] py-[--component-padding]',
  main: 'flex-1',
  footer: 'p-[--layout-padding]',
  sidebar: 'hidden w-64 border-r bg-muted/40 md:block p-[--component-padding]',
  contentWrapper: 'flex flex-1 flex-col overflow-hidden',
  asideRight: 'hidden w-80 border-l lg:block p-[--layout-padding]',
};

export const variants = {
  variant: {
    standard: 'flex flex-col',
    dashboard: 'flex h-screen overflow-hidden',
    'holy-grail': 'flex flex-col',
    centroid: 'flex items-center justify-center',
  },
};

export const layoutCva = cva(
  'h-full w-full text-foreground transition-colors', // базовые стили
  {
    variants,
    defaultVariants: {
      variant: 'standard',
    },
  },
);
