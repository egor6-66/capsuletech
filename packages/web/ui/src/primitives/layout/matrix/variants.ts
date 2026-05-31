import { cva } from '@capsuletech/web-style';

export const matrixSlots = {
  // ---------------------------------------------------------------------------
  // Legacy slot names (kept for backwards-compat with existing tests/stories)
  // ---------------------------------------------------------------------------
  header: 'min-h-10  sticky top-0 z-40 w-full backdrop-blur',
  main: 'flex-1',
  footer: '',
  sidebar: 'hidden w-64  md:block',
  contentWrapper: 'flex flex-1 flex-col overflow-hidden',
  asideRight: 'hidden w-80  lg:block',
  resizeSidebar: 'h-full w-full overflow-auto  scrollbar-hover',
  resizeMain: 'h-full w-full overflow-auto scrollbar-hover',
  resizeAsideRight: 'h-full w-full overflow-auto  scrollbar-hover',
  resizeHeader: 'w-full h-full overflow-auto border-b backdrop-blur scrollbar-hover',
  resizeFooter: 'w-full h-full overflow-auto border-t scrollbar-hover',
  gridContainer: 'grid h-full w-full overflow-hidden',
  gridLeft: 'w-64 overflow-auto scrollbar-hover',
  gridRight: 'w-80 overflow-auto  scrollbar-hover',

  // ---------------------------------------------------------------------------
  // v2 rows-engine slot classes
  // ---------------------------------------------------------------------------

  /**
   * Базовый класс для cell с id='main' — fill + scroll.
   */
  // resizeMain уже есть выше — переиспользуем

  /**
   * Базовый класс для всех НЕ-main cells в rows-engine.
   * Используется в renderCell когда id !== 'main'.
   */
  resizeSlot: 'h-full w-full overflow-auto scrollbar-hover',
};

export const matrixCva = cva(
  'h-full w-full text-foreground transition-colors', // базовые стили
);
