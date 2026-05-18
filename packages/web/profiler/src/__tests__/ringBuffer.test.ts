import { describe, expect, it } from 'vitest';
import { createRingBuffer } from '../core/ringBuffer';

describe('ringBuffer', () => {
  it('keeps items in insertion order while under capacity', () => {
    const rb = createRingBuffer<number>(4);
    rb.push(1);
    rb.push(2);
    rb.push(3);
    expect(rb.length).toBe(3);
    expect(rb.toArray()).toEqual([1, 2, 3]);
    expect(rb.last()).toBe(3);
  });

  it('overwrites oldest items past capacity', () => {
    const rb = createRingBuffer<number>(3);
    rb.push(1);
    rb.push(2);
    rb.push(3);
    rb.push(4);
    rb.push(5);
    expect(rb.length).toBe(3);
    expect(rb.toArray()).toEqual([3, 4, 5]);
    expect(rb.last()).toBe(5);
  });

  it('returns undefined for last() on empty buffer', () => {
    const rb = createRingBuffer<string>(2);
    expect(rb.last()).toBeUndefined();
    expect(rb.toArray()).toEqual([]);
  });

  it('throws on non-positive capacity', () => {
    expect(() => createRingBuffer<number>(0)).toThrow();
    expect(() => createRingBuffer<number>(-1)).toThrow();
  });
});
