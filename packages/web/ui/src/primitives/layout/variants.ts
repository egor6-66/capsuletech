import { cva } from '@capsuletech/web-style';

export const layoutSlots = {
  header:
    'min-h-10 border-b bg-muted/40 sticky top-0 z-40 w-full  backdrop-blur px-[--layout-padding] py-[--component-padding]',
  main: 'flex-1',
  footer: 'p-[--layout-padding]',
  sidebar: 'hidden w-64 border-r bg-muted/40 md:block p-[--component-padding]',
  contentWrapper: 'flex flex-1 flex-col overflow-hidden',
  asideRight: 'bg-muted/40 hidden w-80 border-l lg:block p-[--layout-padding]',
  /**
   * Resize-режим: те же визуальные стили, что и легаси-slot'ы, но **без**
   * фиксированной ширины и без `hidden md:block` — шириной управляет corvu
   * Panel через inline `style`. Высоту фиксируем `h-full`, скролл — `overflow-auto`.
   */
  resizeSidebar:
    'h-full w-full overflow-auto border-r bg-muted/40 p-[--component-padding]',
  resizeMain: 'h-full w-full overflow-auto',
  resizeAsideRight:
    'h-full w-full overflow-auto border-l bg-muted/40 p-[--layout-padding]',
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
