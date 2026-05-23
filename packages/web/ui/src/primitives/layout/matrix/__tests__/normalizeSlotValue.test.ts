import { describe, expect, it } from 'vitest';
import { type INormalizedSlot, normalizeSlotValue } from '../utils';

describe('normalizeSlotValue', () => {
  it('returns null for undefined', () => {
    expect(normalizeSlotValue(undefined)).toBeNull();
  });

  it('returns null for null', () => {
    expect(normalizeSlotValue(null as never)).toBeNull();
  });

  it('wraps a bare string (JSX-form) as children with draggable=false', () => {
    const result = normalizeSlotValue('hello' as never);
    expect(result).not.toBeNull();
    expect(result!.children).toBe('hello');
    expect(result!.draggable).toBe(false);
    expect(result!.initialSize).toBeUndefined();
  });

  it('wraps an array (JSX-form) as children', () => {
    // Arrays are valid Solid JSX (fragments) — treated as JSX-form, not config
    const arr = ['a', 'b'] as never;
    const result = normalizeSlotValue(arr);
    expect(result!.children).toBe(arr);
    expect(result!.draggable).toBe(false);
  });

  it('passes through object-form with all fields', () => {
    const result = normalizeSlotValue({
      children: 'x',
      initialSize: 0.2,
      minSize: 0.1,
      maxSize: 0.5,
      draggable: true,
    });
    expect(result).toMatchObject<Partial<INormalizedSlot>>({
      children: 'x',
      initialSize: 0.2,
      minSize: 0.1,
      maxSize: 0.5,
      draggable: true,
    });
  });

  it('object-form with only children defaults draggable to false', () => {
    const result = normalizeSlotValue({ children: 'x' });
    expect(result!.draggable).toBe(false);
    expect(result!.initialSize).toBeUndefined();
  });

  it('object-form with explicit draggable: false stays false', () => {
    const result = normalizeSlotValue({ children: 'x', draggable: false });
    expect(result!.draggable).toBe(false);
  });
});
