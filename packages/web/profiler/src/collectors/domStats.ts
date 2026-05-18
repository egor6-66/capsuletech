import type { ICollector, IMetricsBus } from '../core/schema';
import { isBrowser } from '../core/env';

export interface IDomStatsOpts {
  intervalMs?: number;
}

export function domStatsCollector(opts: IDomStatsOpts = {}): ICollector {
  const intervalMs = opts.intervalMs ?? 5000;

  return {
    name: 'domStats',
    init(bus: IMetricsBus) {
      if (!isBrowser || typeof document === 'undefined') return () => undefined;

      const sample = () => {
        bus.write('dom.nodes', document.getElementsByTagName('*').length);
      };

      sample();
      const id = setInterval(sample, intervalMs);

      return () => clearInterval(id);
    },
  };
}
