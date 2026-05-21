import { cva } from '@capsuletech/web-style';

export const matrixSlots = {
  header:
    'min-h-10 border-b  sticky top-0 z-40 w-full  backdrop-blur px-[--layout-padding] py-[--component-padding]',
  main: 'flex-1',
  footer: 'p-[--layout-padding]',
  sidebar: 'hidden w-64 border-r  md:block p-[--component-padding]',
  contentWrapper: 'flex flex-1 flex-col overflow-hidden',
  asideRight: 'hidden w-80 border-l lg:block p-[--layout-padding]',
  /**
   * Resize-режим: те же визуальные стили, что и легаси-slot'ы, но **без**
   * фиксированной ширины и без `hidden md:block` — шириной управляет corvu
   * Panel через inline `style`. Высоту фиксируем `h-full`, скролл — `overflow-auto`.
   */
  resizeSidebar: 'h-full w-full overflow-auto border-r  p-[--component-padding]',
  resizeMain: 'h-full w-full overflow-auto',
  resizeAsideRight: 'h-full w-full overflow-auto border-l  p-[--layout-padding]',
  /**
   * Resize-режим vertical: header/footer становятся panel'ями corvu, поэтому
   * фиксированной высоты быть не должно — её определяет drag.
   * Базовые стили (border, фон, padding) сохраняем.
   */
  resizeHeader:
    'w-full h-full overflow-auto border-b px-[--layout-padding] py-[--component-padding] backdrop-blur',
  resizeFooter: 'w-full h-full overflow-auto border-t p-[--layout-padding]',
  /**
   * Grid layout: CSS Grid с tracks `auto / 1fr / auto` по обеим осям.
   * `grid-template-areas` задаётся inline-стилем динамически.
   */
  gridContainer: 'grid h-full w-full overflow-hidden',
  gridLeft: 'w-64 overflow-auto border-r  p-[--component-padding]',
  gridRight: 'w-80 overflow-auto border-l  p-[--layout-padding]',
};

export const matrixCva = cva(
  'h-full w-full text-foreground transition-colors', // базовые стили
);
