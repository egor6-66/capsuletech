import type { JSX } from 'solid-js';

export type ResizableOrientation = 'horizontal' | 'vertical';

/**
 * Описание одного item в `<Resizable items={...} />`.
 *
 * Между двумя соседними items рендерится handle тогда и только тогда, когда
 * оба item'а имеют `resizable !== false`. Если у item `resizable: false`,
 * соседние handles к нему не примыкают — панель «глухая».
 */
export interface IResizableItem {
  /** Что отрисовать внутри панели. */
  children: JSX.Element;
  /** По умолчанию `true`. Если `false` — handle к этой панели не ставится. */
  resizable?: boolean;
  /** Начальный размер панели в долях `(0..1)`. Передаётся в corvu Panel. */
  initialSize?: number;
  /** Минимальный размер `(0..1)`. */
  minSize?: number;
  /** Максимальный размер `(0..1)`. */
  maxSize?: number;
  /** Может ли панель схлопнуться в 0. corvu-flag. */
  collapsible?: boolean;
}

export interface IResizableProps {
  /** Массив панелей по порядку. */
  items: IResizableItem[];
  /** Направление группы. По умолчанию `'horizontal'`. */
  orientation?: ResizableOrientation;
  /** Рисовать визуальный grip на handle (точки-ручка). */
  withHandle?: boolean;
  class?: string;
}
