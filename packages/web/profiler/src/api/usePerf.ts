import type { IMetricId, IMetricsBus } from '../core/schema';
import { useProfiler } from './useProfiler';

export interface IPerfTimer {
  end(): number;
}

export interface IPerfApi {
  mark(name: string): void;
  measure(name: string, startMark?: string, endMark?: string): number | undefined;
  count(name: string, n?: number): void;
  gauge(name: string, value: number, unit?: string): void;
  time(name: string): IPerfTimer;
}

function now(): number {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

export function createPerfApi(bus: IMetricsBus): IPerfApi {
  const counters = new Map<string, number>();

  return {
    mark(name) {
      if (typeof performance !== 'undefined' && typeof performance.mark === 'function') {
        try {
          performance.mark(name);
        } catch {
          /* ignore */
        }
      }
    },
    measure(name, startMark, endMark) {
      if (typeof performance === 'undefined' || typeof performance.measure !== 'function') {
        return undefined;
      }
      try {
        const m = performance.measure(name, startMark, endMark);
        return m?.duration;
      } catch {
        return undefined;
      }
    },
    count(name, n = 1) {
      const prev = counters.get(name) ?? 0;
      const next = prev + n;
      counters.set(name, next);
      bus.write(`custom.${name}` as IMetricId, next, { kind: 'counter', label: name });
    },
    gauge(name, value, unit) {
      bus.write(`custom.${name}` as IMetricId, value, {
        kind: 'gauge',
        label: name,
        ...(unit !== undefined ? { unit } : {}),
      });
    },
    time(name) {
      const start = now();
      return {
        end() {
          const dur = now() - start;
          bus.write(`custom.${name}` as IMetricId, dur, {
            kind: 'timing',
            label: name,
            unit: 'ms',
          });
          return dur;
        },
      };
    },
  };
}

export function usePerf(): IPerfApi {
  return createPerfApi(useProfiler());
}
