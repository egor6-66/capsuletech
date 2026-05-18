import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMetricsBus } from '../core/bus';
import { callbackReporter } from '../reporters/callback';
import { consoleReporter } from '../reporters/console';

describe('callbackReporter', () => {
  it('forwards every bus.write to the callback', () => {
    const bus = createMetricsBus();
    const fn = vi.fn();
    const cleanup = callbackReporter(fn).init(bus);

    bus.write('lcp', 1200);
    bus.write('fps', 60);

    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn.mock.calls[0][0]).toBe('lcp');
    expect(fn.mock.calls[0][1].value).toBe(1200);
    expect(fn.mock.calls[1][0]).toBe('fps');

    cleanup();
    bus.write('cls', 0.01);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('does not fire for duplicate-value writes (bus dedup)', () => {
    const bus = createMetricsBus();
    const fn = vi.fn();
    callbackReporter(fn).init(bus);

    bus.write('memory', 50);
    bus.write('memory', 50);
    bus.write('memory', 60);

    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe('consoleReporter', () => {
  const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

  afterEach(() => {
    logSpy.mockClear();
  });

  it('logs id+label+value+unit with default prefix', () => {
    const bus = createMetricsBus();
    consoleReporter().init(bus);
    bus.write('lcp', 1200);
    expect(logSpy).toHaveBeenCalledWith('[profiler] LCP = 1200 ms');
  });

  it('respects custom prefix', () => {
    const bus = createMetricsBus();
    consoleReporter({ prefix: '<perf>' }).init(bus);
    bus.write('fps', 60);
    expect(logSpy.mock.calls[0][0]).toMatch(/^<perf> /);
  });

  it('honors filter()', () => {
    const bus = createMetricsBus();
    consoleReporter({ filter: (id) => id.startsWith('error.') }).init(bus);
    bus.write('lcp', 1000);
    bus.write('error.js', 1);
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy.mock.calls[0][0]).toContain('JS Errors');
  });
});
