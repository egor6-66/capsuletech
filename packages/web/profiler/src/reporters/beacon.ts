import { isBrowser } from '../core/env';
import type { IMetricsBus, IReporter } from '../core/schema';

export interface IBeaconReporterOpts {
  url: string;
  on?: Array<'hidden' | 'pagehide'>;
  serializer?: (snapshot: ReturnType<IMetricsBus['snapshot']>) => BodyInit;
}

const noop = () => undefined;

export function beaconReporter(opts: IBeaconReporterOpts): IReporter {
  const triggers = opts.on ?? ['hidden', 'pagehide'];
  const serializer = opts.serializer ?? ((snap) => JSON.stringify(snap));

  return {
    name: 'beacon',
    init(bus: IMetricsBus) {
      if (!isBrowser || typeof navigator.sendBeacon !== 'function') return noop;

      const send = () => {
        try {
          const body = serializer(bus.snapshot());
          navigator.sendBeacon(opts.url, body);
        } catch {
          /* swallow — beacon is best-effort */
        }
      };

      const onVisibility = () => {
        if (document.visibilityState === 'hidden') send();
      };
      const onPageHide = () => send();

      if (triggers.includes('hidden')) document.addEventListener('visibilitychange', onVisibility);
      if (triggers.includes('pagehide')) window.addEventListener('pagehide', onPageHide);

      return () => {
        if (triggers.includes('hidden'))
          document.removeEventListener('visibilitychange', onVisibility);
        if (triggers.includes('pagehide')) window.removeEventListener('pagehide', onPageHide);
      };
    },
  };
}
