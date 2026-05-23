import { type Accessor, createEffect, createMemo, onCleanup } from 'solid-js';
import { useDnD } from './context';
import type { DragData, IDraggable, IDraggableOptions } from './types';

const toAccessor = <T>(v: Accessor<T> | T): Accessor<T> =>
  typeof v === 'function' ? (v as Accessor<T>) : () => v;

/**
 * Primitive для draggable-источника. Применяется как `ref={drag.ref}` на
 * элементе, который должен быть перетаскиваемым.
 *
 * Старт drag'а — `pointerdown` (любая кнопка/палец). На draggable-элементе
 * проставляется `touch-action: none`, чтобы touch-drag не конфликтовал со
 * скроллом страницы.
 *
 * Текстовое выделение во время drag'а гасится глобально через `user-select:
 * none` пока `isDragging`.
 */
export const createDraggable = <T extends DragData = DragData>(
  options: IDraggableOptions<T>,
): IDraggable => {
  const dnd = useDnD();
  const data = toAccessor(options.data);
  const disabled = options.disabled ?? (() => false);

  let elRef: HTMLElement | null = null;

  const isDragging = createMemo(() => dnd.state.activeId() === options.id);

  const onPointerDown = (e: PointerEvent) => {
    if (disabled()) return;
    // Только основная кнопка (или touch — у touch button === 0)
    if (e.button !== 0) return;
    e.preventDefault();
    dnd.startDrag(options.id, e);
  };

  const ref = (el: HTMLElement) => {
    if (elRef) {
      elRef.removeEventListener('pointerdown', onPointerDown);
    }
    elRef = el;
    if (!el) return;
    el.style.touchAction = 'none';
    el.dataset.dndDraggable = '';
    el.addEventListener('pointerdown', onPointerDown);

    const unregister = dnd.registerDraggable({
      id: options.id,
      data: data as Accessor<DragData>,
      el,
    });

    onCleanup(() => {
      el.removeEventListener('pointerdown', onPointerDown);
      unregister();
    });
  };

  // Глобальное гашение text-selection пока тянем — иначе drag по тексту
  // выделяет случайные участки.
  createEffect(() => {
    if (!isDragging()) return;
    const prev = document.body.style.userSelect;
    document.body.style.userSelect = 'none';
    onCleanup(() => {
      document.body.style.userSelect = prev;
    });
  });

  return { ref, isDragging };
};
