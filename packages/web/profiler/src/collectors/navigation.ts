import type { ICollector, IMetricsBus } from '../core/schema';
import { isBrowser } from './_ssr';

export function navigationCollector(): ICollector {
  return {
    name: 'navigation',
    init(bus: IMetricsBus) {
      if (!isBrowser) return () => undefined;

      const entries = performance.getEntriesByType('navigation');
      const nav = entries[0] as PerformanceNavigationTiming | undefined;
      if (!nav) return () => undefined;

      if (nav.domContentLoadedEventEnd > 0) {
        bus.write('dom.ready', Math.round(nav.domContentLoadedEventEnd));
      }
      return () => undefined;
    },
  };
}
