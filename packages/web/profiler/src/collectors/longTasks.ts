import { supportsEntryType } from '../core/env';
import type { ICollector, IMetricsBus } from '../core/schema';

export interface ILongTasksOpts {
  durationThresholdMs?: number;
}

export function longTasksCollector(opts: ILongTasksOpts = {}): ICollector {
  const threshold = opts.durationThresholdMs ?? 50;

  return {
    name: 'longTasks',
    init(bus: IMetricsBus) {
      if (!supportsEntryType('longtask')) return () => undefined;

      let observer: PerformanceObserver | null = null;
      try {
        observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.duration >= threshold) {
              bus.write('longtask', entry.duration);
            }
          }
        });
        observer.observe({ entryTypes: ['longtask'] });
      } catch {
        observer = null;
      }

      return () => observer?.disconnect();
    },
  };
}
