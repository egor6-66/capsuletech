import type { IResizableSlotConfig, SlotValue } from './interfaces';

/**
 * Нормализованный slot, как его потребляет grid: всегда `{children, resizable, ...}`
 * с гарантированным булевым `resizable`.
 */
export interface INormalizedSlot extends IResizableSlotConfig {
  resizable: boolean;
}

/**
 * Нормализует slot-config: гарантирует `resizable: boolean` (default `false`).
 * Возвращает `null` для отсутствующих слотов.
 */
export const normalizeSlot = (slot: SlotValue | undefined): INormalizedSlot | null => {
  if (slot === undefined || slot === null) return null;
  return {
    children: slot.children,
    resizable: slot.resizable ?? false,
    initialSize: slot.initialSize,
    minSize: slot.minSize,
    maxSize: slot.maxSize,
  };
};
