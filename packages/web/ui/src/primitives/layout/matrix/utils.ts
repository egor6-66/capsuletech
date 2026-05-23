import type { JSX } from 'solid-js';
import type { SlotValue } from './interfaces';

/**
 * Нормализованный slot — всегда объект с `children` + размерами + `draggable`.
 */
export interface INormalizedSlot {
  children: JSX.Element;
  initialSize?: number;
  minSize?: number;
  maxSize?: number;
  draggable: boolean;
}

/**
 * Нормализует SlotValue в INormalizedSlot.
 *
 * Heuristic: если у значения есть собственный ключ `children` — это object-форма.
 * Иначе — JSX-элемент (строка / функция / массив / число / boolean / null).
 *
 * Это покрывает все realistic cases:
 * - `<Header />` — функция без `children` → JSX-форма
 * - `"text"` — строка → JSX-форма
 * - `{ children: <Header />, initialSize: 0.2 }` → object-форма
 * - `{ children: <Header /> }` — объект с `children`, без size → object-форма
 *
 * Returns `null` для `undefined`/`null`.
 */
export const normalizeSlotValue = (slot: SlotValue | undefined): INormalizedSlot | null => {
  if (slot === undefined || slot === null) return null;

  // Object-форма: любой plain-object с ключом `children`
  if (typeof slot === 'object' && !Array.isArray(slot) && Object.hasOwn(slot, 'children')) {
    const config = slot as {
      children: JSX.Element;
      initialSize?: number;
      minSize?: number;
      maxSize?: number;
      draggable?: boolean;
    };
    return {
      children: config.children,
      initialSize: config.initialSize,
      minSize: config.minSize,
      maxSize: config.maxSize,
      draggable: config.draggable ?? false,
    };
  }

  // JSX-форма: строка, число, boolean, функция, массив, или любой другой объект
  return {
    children: slot as JSX.Element,
    draggable: false,
  };
};
