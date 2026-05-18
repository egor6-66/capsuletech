import type { IMetricsBus, IReporter } from '../core/schema';

export interface IConsoleReporterOpts {
  prefix?: string;
  filter?: (id: string) => boolean;
}

export function consoleReporter(opts: IConsoleReporterOpts = {}): IReporter {
  const prefix = opts.prefix ?? '[profiler]';
  const filter = opts.filter;

  return {
    name: 'console',
    init(bus: IMetricsBus) {
      return bus.subscribe((id, sample, meta) => {
        if (filter && !filter(id)) return;
        const label = meta.label || id;
        const unit = meta.unit ? ` ${meta.unit}` : '';
        console.log(`${prefix} ${label} = ${sample.value}${unit}`);
      });
    },
  };
}
