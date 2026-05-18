import { hasPO, supportsEntryType } from '../core/env';
import type { ICollector, IMetricId, IMetricsBus } from '../core/schema';

export function userTimingCollector(): ICollector {
  return {
    name: 'userTiming',
    init(bus: IMetricsBus) {
      if (!hasPO()) return () => undefined;

      let markObs: PerformanceObserver | null = null;
      let measureObs: PerformanceObserver | null = null;

      if (supportsEntryType('mark')) {
        try {
          markObs = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              const id = `custom.mark.${entry.name}` as IMetricId;
              bus.write(id, entry.startTime, {
                kind: 'event',
                label: entry.name,
                unit: 'ms',
              });
            }
          });
          markObs.observe({ entryTypes: ['mark'] });
        } catch {
          markObs = null;
        }
      }

      if (supportsEntryType('measure')) {
        try {
          measureObs = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              const id = `custom.measure.${entry.name}` as IMetricId;
              bus.write(id, entry.duration, {
                kind: 'timing',
                label: entry.name,
                unit: 'ms',
              });
            }
          });
          measureObs.observe({ entryTypes: ['measure'] });
        } catch {
          measureObs = null;
        }
      }

      return () => {
        markObs?.disconnect();
        measureObs?.disconnect();
      };
    },
  };
}
