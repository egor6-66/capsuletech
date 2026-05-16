import { cva } from '@capsuletech/web-style';

/**
 * Корневой контейнер Resizable. `data-orientation` ставит сам corvu —
 * Tailwind-селекторы переключают direction.
 */
export const resizableRootCva = cva('flex size-full data-[orientation=vertical]:flex-col');

/**
 * Handle между двумя панелями. Длинная строка скопирована из shadcn/solid-ui;
 * orientation-aware варианты — через `data-[orientation=vertical]:*` (атрибут
 * ставит corvu).
 */
export const resizableHandleCva = cva(
  'relative flex w-px shrink-0 items-center justify-center bg-border after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 data-[orientation=vertical]:h-px data-[orientation=vertical]:w-full data-[orientation=vertical]:after:left-0 data-[orientation=vertical]:after:h-1 data-[orientation=vertical]:after:w-full data-[orientation=vertical]:after:-translate-y-1/2 data-[orientation=vertical]:after:translate-x-0 [&[data-orientation=vertical]>div]:rotate-90',
);
