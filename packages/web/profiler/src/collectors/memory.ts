import type { ICollector, IMetricsBus } from '../core/schema';
import { isBrowser } from './_ssr';

export interface IMemoryOpts {
  intervalMs?: number;
}

interface IPerformanceWithMemory extends Performance {
  memory?: { usedJSHeapSize: number };
}

export function memoryCollector(opts: IMemoryOpts = {}): ICollector {
  const intervalMs = opts.intervalMs ?? 2000;

  return {
    name: 'memory',
    init(bus: IMetricsBus) {
      if (!isBrowser) return () => undefined;
      const perf = performance as IPerformanceWithMemory;
      if (!perf.memory) return () => undefined;

      const sample = () => {
        const mem = perf.memory;
        if (!mem) return;
        bus.write('memory', Math.round(mem.usedJSHeapSize / 1024 / 1024));
      };

      sample();
      const id = setInterval(sample, intervalMs);

      return () => clearInterval(id);
    },
  };
}
