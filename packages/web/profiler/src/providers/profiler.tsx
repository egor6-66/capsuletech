import { type JSX, onCleanup, onMount, Show } from 'solid-js';
import { ProfilerContext } from '../api/useProfiler';
import {
  connectionCollector,
  domStatsCollector,
  errorsCollector,
  eventTimingCollector,
  fpsCollector,
  loafCollector,
  longTasksCollector,
  memoryCollector,
  navigationCollector,
  networkCollector,
  networkDeepCollector,
  userTimingCollector,
  webVitalsCollector,
} from '../collectors';
import { createMetricsBus } from '../core/bus';
import type { ICollector, IMetricsBus, IReporter } from '../core/schema';
import { ProfilerDashboard } from '../widget';

export type IProfilerCollectorsOpt = 'all' | 'all-except-deep' | 'legacy' | ICollector[];

export interface IProfilerProviderProps {
  children: JSX.Element;
  collectors?: IProfilerCollectorsOpt;
  reporters?: IReporter[];
  bus?: IMetricsBus;
  historySize?: number;
  showDashboard?: boolean;
}

function legacyCollectors(): ICollector[] {
  return [
    webVitalsCollector(),
    memoryCollector(),
    networkCollector(),
    navigationCollector(),
    connectionCollector(),
  ];
}

function allCollectors(includeDeep: boolean): ICollector[] {
  const base: ICollector[] = [
    ...legacyCollectors(),
    longTasksCollector(),
    loafCollector(),
    eventTimingCollector(),
    fpsCollector(),
    domStatsCollector(),
    errorsCollector(),
    userTimingCollector(),
  ];
  if (includeDeep) base.push(networkDeepCollector());
  return base;
}

function resolveCollectors(opt: IProfilerCollectorsOpt): ICollector[] {
  if (Array.isArray(opt)) return opt;
  if (opt === 'legacy') return legacyCollectors();
  return allCollectors(opt === 'all');
}

export function ProfilerProvider(props: IProfilerProviderProps) {
  const bus = props.bus ?? createMetricsBus({ historySize: props.historySize });

  onMount(() => {
    const collectorOpt = props.collectors ?? 'all-except-deep';
    const collectors = resolveCollectors(collectorOpt);
    const reporters = props.reporters ?? [];

    const cleanups: Array<() => void> = [];
    for (const c of collectors) cleanups.push(c.init(bus));
    for (const r of reporters) cleanups.push(r.init(bus));

    onCleanup(() => {
      for (const fn of cleanups) {
        try {
          fn();
        } catch {
          /* swallow — collector cleanup must not break the tree */
        }
      }
    });
  });

  return (
    <ProfilerContext.Provider value={bus}>
      {props.children}
      <Show when={props.showDashboard}>
        <ProfilerDashboard />
      </Show>
    </ProfilerContext.Provider>
  );
}
