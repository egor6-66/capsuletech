export type IBuiltinMetricId =
  | 'lcp'
  | 'fcp'
  | 'cls'
  | 'inp'
  | 'ttfb'
  | 'memory'
  | 'network.transfer'
  | 'network.decoded'
  | 'network.inflight'
  | 'network.requests'
  | 'network.failed'
  | 'dom.ready'
  | 'connection'
  | 'longtask'
  | 'loaf'
  | 'event'
  | 'fps'
  | 'dom.nodes'
  | 'dom.listeners'
  | 'error.js'
  | 'error.promise'
  | 'user.measure'
  | 'user.mark';

export type ICustomMetricId = `custom.${string}`;

export type IMetricId = IBuiltinMetricId | ICustomMetricId;

export type IMetricKind = 'gauge' | 'counter' | 'timing' | 'event' | 'info';

export interface IMetricMeta {
  id: IMetricId;
  kind: IMetricKind;
  label: string;
  unit: string;
}

export interface IMetricSample {
  value: number | string;
  ts: number;
}

export type IRatingLabel = 'good' | 'needs-improvement' | 'poor' | 'info';

export interface IRating {
  label: IRatingLabel;
  color: string;
}

export interface IMetricsSnapshot {
  [id: string]: IMetricSample;
}

export type IMetricsListener = (id: IMetricId, sample: IMetricSample, meta: IMetricMeta) => void;

export interface IMetricsBus {
  write(id: IMetricId, value: number | string, meta?: Partial<IMetricMeta>): void;
  read(id: IMetricId): IMetricSample | undefined;
  meta(id: IMetricId): IMetricMeta | undefined;
  history(id: IMetricId): readonly IMetricSample[];
  ids(): readonly IMetricId[];
  subscribe(fn: IMetricsListener): () => void;
  snapshot(): IMetricsSnapshot;
}

export interface ICollector {
  readonly name: string;
  init(bus: IMetricsBus): () => void;
}

export interface IReporter {
  readonly name: string;
  init(bus: IMetricsBus): () => void;
}
