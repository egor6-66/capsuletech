import { describe, expect, it } from 'vitest';
import { createPerfApi } from '../api/usePerf';
import { createMetricsBus } from '../core/bus';

describe('createPerfApi', () => {
  it('count() accumulates and writes the running total as a counter', () => {
    const bus = createMetricsBus();
    const perf = createPerfApi(bus);

    perf.count('clicks');
    perf.count('clicks', 3);
    perf.count('clicks');

    const sample = bus.read('custom.clicks');
    expect(sample?.value).toBe(5);
    expect(bus.meta('custom.clicks')?.kind).toBe('counter');
    expect(bus.meta('custom.clicks')?.label).toBe('clicks');
  });

  it('gauge() writes the value verbatim with kind=gauge', () => {
    const bus = createMetricsBus();
    const perf = createPerfApi(bus);

    perf.gauge('cart.items', 7);
    expect(bus.read('custom.cart.items')?.value).toBe(7);
    expect(bus.meta('custom.cart.items')?.kind).toBe('gauge');

    perf.gauge('cart.items', 3);
    expect(bus.read('custom.cart.items')?.value).toBe(3);
  });

  it('gauge() respects optional unit override', () => {
    const bus = createMetricsBus();
    const perf = createPerfApi(bus);
    perf.gauge('cart.size', 1024, 'KB');
    expect(bus.meta('custom.cart.size')?.unit).toBe('KB');
  });

  it('time().end() writes elapsed ms with kind=timing', () => {
    const bus = createMetricsBus();
    const perf = createPerfApi(bus);

    const timer = perf.time('api.user.get');
    const elapsed = timer.end();

    expect(elapsed).toBeGreaterThanOrEqual(0);
    const sample = bus.read('custom.api.user.get');
    expect(sample?.value).toBe(elapsed);
    expect(bus.meta('custom.api.user.get')?.kind).toBe('timing');
    expect(bus.meta('custom.api.user.get')?.unit).toBe('ms');
  });

  it('mark() is a no-throw in environments without performance.mark', () => {
    const bus = createMetricsBus();
    const perf = createPerfApi(bus);
    expect(() => perf.mark('start')).not.toThrow();
  });

  it('measure() returns undefined when end-mark is missing instead of throwing', () => {
    const bus = createMetricsBus();
    const perf = createPerfApi(bus);
    const result = perf.measure('never-defined', 'no-such-start');
    expect(result).toBeUndefined();
  });
});
