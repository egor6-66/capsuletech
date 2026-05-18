import { supportsEntryType } from '../core/env';
import type { ICollector, IMetricsBus } from '../core/schema';

export interface IEventTimingOpts {
  durationThresholdMs?: number;
}

interface PerformanceObserverObserveOptions {
  type?: string;
  buffered?: boolean;
  durationThreshold?: number;
}

export function eventTimingCollector(opts: IEventTimingOpts = {}): ICollector {
  const durationThreshold = opts.durationThresholdMs ?? 40;

  return {
    name: 'eventTiming',
    init(bus: IMetricsBus) {
      if (!supportsEntryType('event')) return () => undefined;

      let observer: PerformanceObserver | null = null;
      try {
        observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            bus.write('event', entry.duration);
          }
        });
        const observeOpts: PerformanceObserverObserveOptions = {
          type: 'event',
          buffered: true,
          durationThreshold,
        };
        observer.observe(observeOpts as unknown as PerformanceObserverInit);
      } catch {
        observer = null;
      }

      return () => observer?.disconnect();
    },
  };
}
