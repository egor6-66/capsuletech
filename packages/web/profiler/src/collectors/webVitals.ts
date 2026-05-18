import { type Metric, onCLS, onFCP, onINP, onLCP, onTTFB } from 'web-vitals';
import type { ICollector, IMetricId, IMetricsBus } from '../core/schema';
import { isBrowser } from './_ssr';

export interface IWebVitalsOpts {
  reportAllChanges?: boolean;
}

const ID_BY_NAME: Record<string, IMetricId> = {
  CLS: 'cls',
  FCP: 'fcp',
  LCP: 'lcp',
  INP: 'inp',
  TTFB: 'ttfb',
};

export function webVitalsCollector(opts: IWebVitalsOpts = {}): ICollector {
  const reportAllChanges = opts.reportAllChanges ?? true;

  return {
    name: 'webVitals',
    init(bus: IMetricsBus) {
      if (!isBrowser) return () => undefined;

      let disposed = false;
      const handler = (metric: Metric) => {
        if (disposed) return;
        const id = ID_BY_NAME[metric.name];
        if (id) bus.write(id, metric.value);
      };

      onCLS(handler, { reportAllChanges });
      onLCP(handler, { reportAllChanges });
      onFCP(handler, { reportAllChanges });
      onINP(handler, { reportAllChanges });
      onTTFB(handler);

      return () => {
        disposed = true;
      };
    },
  };
}
