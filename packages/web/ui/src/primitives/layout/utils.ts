import type { JSX } from 'solid-js';
import type { IResizableSlotConfig, SlotValue } from './interfaces';

/**
 * Нормализованный slot, как его потребляет grid: всегда `{children, resizable, ...}`.
 * Если пришёл JSX-element — это `{children: <X/>, resizable: false}`.
 */
export interface INormalizedSlot extends IResizableSlotConfig {
  resizable: boolean;
}

/**
 * Распознаём slot-конфиг как plain object literal с `children`.
 * JSX-узлы Solid — это Node/функция/примитив, у них нет прототипа `Object.prototype`,
 * поэтому такой чек устойчив.
 */
export const normalizeSlot = (slot: SlotValue | undefined): INormalizedSlot | null => {
  if (slot === undefined || slot === null) return null;
  if (
    typeof slot === 'object' &&
    Object.getPrototypeOf(slot) === Object.prototype &&
    'children' in (slot as object)
  ) {
    const cfg = slot as IResizableSlotConfig;
    return {
      children: cfg.children,
      // opt-in: object-форма без явного `resizable: true` ведёт себя как JSX-слот
      // (легаси-разметка с `<aside>/<main>` и дефолтными классами).
      resizable: cfg.resizable ?? false,
      initialSize: cfg.initialSize,
      minSize: cfg.minSize,
      maxSize: cfg.maxSize,
    };
  }
  return { children: slot as JSX.Element, resizable: false };
};
