import type { ICollector, IMetricsBus } from '../core/schema';
import { isBrowser } from './_ssr';

interface INavigatorWithConnection extends Navigator {
  connection?: { effectiveType?: string };
}

export function connectionCollector(): ICollector {
  return {
    name: 'connection',
    init(bus: IMetricsBus) {
      if (!isBrowser) return () => undefined;
      const conn = (navigator as INavigatorWithConnection).connection;
      if (!conn) return () => undefined;

      const write = () => {
        const t = conn.effectiveType;
        if (t) bus.write('connection', t);
      };

      write();
      const target = conn as unknown as EventTarget & { addEventListener?: EventTarget['addEventListener'] };
      const supportsEvents = typeof target.addEventListener === 'function';
      if (supportsEvents) target.addEventListener('change', write);

      return () => {
        if (supportsEvents) target.removeEventListener('change', write);
      };
    },
  };
}
