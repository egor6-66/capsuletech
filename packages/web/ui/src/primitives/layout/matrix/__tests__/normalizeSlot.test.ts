import { describe, expect, it } from 'vitest';
import type { IResizableSlotConfig, SlotValue } from '../interfaces';
import { type INormalizedSlot, normalizeSlot } from '../utils';

describe('normalizeSlot', () => {
  it('returns null for undefined', () => {
    expect(normalizeSlot(undefined)).toBeNull();
  });

  it('returns null for null (cast)', () => {
    expect(normalizeSlot(null as unknown as SlotValue | undefined)).toBeNull();
  });

  it('normalizes object-form slot with only children', () => {
    const slot: IResizableSlotConfig = { children: 'hello' };
    const result = normalizeSlot(slot);
    expect(result).not.toBeNull();
    expect(result!.children).toBe('hello');
    expect(result!.resizable).toBe(false);
    expect(result!.initialSize).toBeUndefined();
    expect(result!.minSize).toBeUndefined();
    expect(result!.maxSize).toBeUndefined();
  });

  it('normalizes slot with resizable: true and size config', () => {
    const slot: IResizableSlotConfig = {
      children: 'sidebar',
      resizable: true,
      initialSize: 0.2,
      minSize: 0.12,
      maxSize: 0.5,
    };
    const result = normalizeSlot(slot) as INormalizedSlot;
    expect(result.resizable).toBe(true);
    expect(result.initialSize).toBe(0.2);
    expect(result.minSize).toBe(0.12);
    expect(result.maxSize).toBe(0.5);
  });

  it('normalizes slot with explicit resizable: false', () => {
    const slot: IResizableSlotConfig = { children: 'x', resizable: false };
    const result = normalizeSlot(slot) as INormalizedSlot;
    expect(result.resizable).toBe(false);
  });

  it('SlotValue is exactly IResizableSlotConfig (type-level assertion)', () => {
    // If SlotValue were a union, this assignment would fail at compile time.
    const v: SlotValue = { children: null };
    const cfg: IResizableSlotConfig = v;
    expect(cfg).toBeDefined();
  });
});
