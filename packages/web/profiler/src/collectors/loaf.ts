import { supportsEntryType } from '../core/env';
import type { ICollector, IMetricsBus } from '../core/schema';

export interface ILoafOpts {
  durationThresholdMs?: number;
}

export function loafCollector(opts: ILoafOpts = {}): ICollector {
  const threshold = opts.durationThresholdMs ?? 50;

  return {
    name: 'loaf',
    init(bus: IMetricsBus) {
      if (!supportsEntryType('long-animation-frame')) return () => undefined;

      let observer: PerformanceObserver | null = null;
      try {
        observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.duration >= threshold) {
              bus.write('loaf', entry.duration);
            }
          }
        });
        observer.observe({ entryTypes: ['long-animation-frame'] });
      } catch {
        observer = null;
      }

      return () => observer?.disconnect();
    },
  };
}
