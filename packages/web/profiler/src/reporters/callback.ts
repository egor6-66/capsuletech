import type { IMetricsBus, IMetricsListener, IReporter } from '../core/schema';

export function callbackReporter(fn: IMetricsListener): IReporter {
  return {
    name: 'callback',
    init(bus: IMetricsBus) {
      return bus.subscribe(fn);
    },
  };
}
