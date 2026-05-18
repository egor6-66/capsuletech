import type { ICollector, IMetricsBus } from '../core/schema';
import { hasPO, isBrowser, supportsEntryType } from './_ssr';

export interface INetworkOpts {
  secondPassDelayMs?: number;
}

function computeTotals() {
  const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
  let transfer = 0;
  let decoded = 0;
  for (const r of resources) {
    transfer += r.transferSize || 0;
    decoded += r.decodedBodySize || r.encodedBodySize || r.transferSize || 0;
  }
  return { transfer: transfer / 1024 / 1024, decoded: decoded / 1024 / 1024 };
}

export function networkCollector(opts: INetworkOpts = {}): ICollector {
  const secondPass = opts.secondPassDelayMs ?? 2000;

  return {
    name: 'network',
    init(bus: IMetricsBus) {
      if (!isBrowser) return () => undefined;

      const write = () => {
        const { transfer, decoded } = computeTotals();
        bus.write('network.transfer', transfer);
        bus.write('network.decoded', decoded);
      };

      write();
      const timeoutId = setTimeout(write, secondPass);

      let observer: PerformanceObserver | null = null;
      if (hasPO() && supportsEntryType('resource')) {
        try {
          observer = new PerformanceObserver(() => write());
          observer.observe({ entryTypes: ['resource'] });
        } catch {
          observer = null;
        }
      }

      return () => {
        clearTimeout(timeoutId);
        observer?.disconnect();
      };
    },
  };
}
