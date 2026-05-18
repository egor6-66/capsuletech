import { describe, expect, it, vi } from 'vitest';
import { createMetricsBus } from '../core/bus';

describe('metricsBus', () => {
  it('stores last sample per id and exposes via read()', () => {
    const bus = createMetricsBus();
    bus.write('lcp', 1200);
    bus.write('lcp', 1500);
    expect(bus.read('lcp')?.value).toBe(1500);
  });

  it('skips duplicate-value writes (no listener call, no history push)', () => {
    const bus = createMetricsBus();
    const fn = vi.fn();
    bus.subscribe(fn);
    bus.write('memory', 50);
    bus.write('memory', 50);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(bus.history('memory')).toHaveLength(1);
  });

  it('keeps per-metric ring-buffer history bounded by historySize', () => {
    const bus = createMetricsBus({ historySize: 3 });
    for (let i = 1; i <= 5; i++) bus.write('fps', i);
    const hist = bus.history('fps');
    expect(hist).toHaveLength(3);
    expect(hist.map((s) => s.value)).toEqual([3, 4, 5]);
  });

  it('attaches default meta from the metric id', () => {
    const bus = createMetricsBus();
    bus.write('lcp', 1000);
    expect(bus.meta('lcp')).toMatchObject({ id: 'lcp', kind: 'timing', unit: 'ms' });
  });

  it('derives label for custom.* ids from the suffix', () => {
    const bus = createMetricsBus();
    bus.write('custom.api.user.get', 42);
    expect(bus.meta('custom.api.user.get')?.label).toBe('api.user.get');
  });

  it('lets meta override label/unit/kind without losing the id', () => {
    const bus = createMetricsBus();
    bus.write('custom.requests' as const, 1, { label: 'API Requests', unit: 'req', kind: 'counter' });
    const m = bus.meta('custom.requests');
    expect(m).toMatchObject({ id: 'custom.requests', label: 'API Requests', unit: 'req', kind: 'counter' });
  });

  it('notifies subscribers and unsubscribes cleanly', () => {
    const bus = createMetricsBus();
    const fn = vi.fn();
    const off = bus.subscribe(fn);
    bus.write('lcp', 1000);
    off();
    bus.write('lcp', 2000);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('snapshot() returns last sample of every written id', () => {
    const bus = createMetricsBus();
    bus.write('lcp', 1000);
    bus.write('fps', 55);
    const snap = bus.snapshot();
    expect(snap.lcp.value).toBe(1000);
    expect(snap.fps.value).toBe(55);
  });

  it('supports string values for info-kind metrics', () => {
    const bus = createMetricsBus();
    bus.write('connection', '4g');
    expect(bus.read('connection')?.value).toBe('4g');
  });
});
