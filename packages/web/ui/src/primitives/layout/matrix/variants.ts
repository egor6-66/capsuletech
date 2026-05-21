import { cva } from '@capsuletech/web-style';

export const matrixSlots = {
  header: 'min-h-10 border-b sticky top-0 z-40 w-full backdrop-blur',
  main: 'flex-1',
  footer: '',
  sidebar: 'hidden w-64 border-r md:block',
  contentWrapper: 'flex flex-1 flex-col overflow-hidden',
  asideRight: 'hidden w-80 border-l lg:block',
  /**
   * Resize-режим: те же визуальные стили, что и легаси-slot'ы, но **без**
   * фиксированной ширины и без `hidden md:block` — шириной управляет corvu
   * Panel через inline `style`. Высоту фиксируем `h-full`, скролл — `overflow-auto`.
   */
  resizeSidebar: 'h-full w-full overflow-auto border-r scrollbar-hover',
  resizeMain: 'h-full w-full overflow-auto scrollbar-hover',
  resizeAsideRight: 'h-full w-full overflow-auto border-l scrollbar-hover',
  /**
   * Resize-режим vertical: header/footer становятся panel'ями corvu, поэтому
   * фиксированной высоты быть не должно — её определяет drag.
   * Базовые стили (border, фон, padding) сохраняем.
   */
  resizeHeader: 'w-full h-full overflow-auto border-b backdrop-blur scrollbar-hover',
  resizeFooter: 'w-full h-full overflow-auto border-t scrollbar-hover',
  /**
   * Grid layout: CSS Grid с tracks `auto / 1fr / auto` по обеим осям.
   * `grid-template-areas` задаётся inline-стилем динамически.
   */
  gridContainer: 'grid h-full w-full overflow-hidden',
  gridLeft: 'w-64 overflow-auto border-r scrollbar-hover',
  gridRight: 'w-80 overflow-auto border-l scrollbar-hover',
};

export const matrixCva = cva(
  'h-full w-full text-foreground transition-colors', // базовые стили
);
