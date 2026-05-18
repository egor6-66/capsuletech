import { createRingBuffer, type IRingBuffer } from './ringBuffer';
import type {
  IMetricId,
  IMetricMeta,
  IMetricSample,
  IMetricsBus,
  IMetricsListener,
  IMetricsSnapshot,
} from './schema';

export interface ICreateBusOpts {
  historySize?: number;
}

const DEFAULT_HISTORY = 60;

const DEFAULT_META: Partial<Record<IMetricId, Pick<IMetricMeta, 'kind' | 'label' | 'unit'>>> = {
  lcp: { kind: 'timing', label: 'LCP', unit: 'ms' },
  fcp: { kind: 'timing', label: 'FCP', unit: 'ms' },
  cls: { kind: 'gauge', label: 'CLS', unit: '' },
  inp: { kind: 'timing', label: 'INP', unit: 'ms' },
  ttfb: { kind: 'timing', label: 'TTFB', unit: 'ms' },
  memory: { kind: 'gauge', label: 'Memory', unit: 'MB' },
  'network.transfer': { kind: 'gauge', label: 'Network Load', unit: 'MB' },
  'network.decoded': { kind: 'gauge', label: 'Total Bundle', unit: 'MB' },
  'network.inflight': { kind: 'gauge', label: 'In-flight Requests', unit: '' },
  'network.requests': { kind: 'counter', label: 'Total Requests', unit: '' },
  'network.failed': { kind: 'counter', label: 'Failed Requests', unit: '' },
  'dom.ready': { kind: 'timing', label: 'DOM Ready', unit: 'ms' },
  connection: { kind: 'info', label: 'Connection', unit: '' },
  longtask: { kind: 'event', label: 'Long Task', unit: 'ms' },
  loaf: { kind: 'event', label: 'Long Anim Frame', unit: 'ms' },
  event: { kind: 'event', label: 'Event Timing', unit: 'ms' },
  fps: { kind: 'gauge', label: 'FPS', unit: 'fps' },
  'dom.nodes': { kind: 'gauge', label: 'DOM Nodes', unit: '' },
  'dom.listeners': { kind: 'gauge', label: 'Listeners', unit: '' },
  'error.js': { kind: 'counter', label: 'JS Errors', unit: '' },
  'error.promise': { kind: 'counter', label: 'Promise Rejections', unit: '' },
  'user.measure': { kind: 'timing', label: 'User Measure', unit: 'ms' },
  'user.mark': { kind: 'event', label: 'User Mark', unit: '' },
};

function defaultMeta(id: IMetricId): IMetricMeta {
  const fromTable = DEFAULT_META[id];
  if (fromTable) return { id, ...fromTable };
  if (id.startsWith('custom.')) {
    const label = id.slice('custom.'.length) || 'Custom';
    return { id, kind: 'gauge', label, unit: '' };
  }
  return { id, kind: 'info', label: String(id), unit: '' };
}

export function createMetricsBus(opts: ICreateBusOpts = {}): IMetricsBus {
  const historySize = opts.historySize ?? DEFAULT_HISTORY;
  const samples = new Map<IMetricId, IMetricSample>();
  const histories = new Map<IMetricId, IRingBuffer<IMetricSample>>();
  const metas = new Map<IMetricId, IMetricMeta>();
  const listeners = new Set<IMetricsListener>();

  return {
    write(id, value, metaOverride) {
      const prev = samples.get(id);
      if (prev !== undefined && prev.value === value) return;

      const sample: IMetricSample = { value, ts: Date.now() };
      samples.set(id, sample);

      let ring = histories.get(id);
      if (!ring) {
        ring = createRingBuffer<IMetricSample>(historySize);
        histories.set(id, ring);
      }
      ring.push(sample);

      let meta = metas.get(id);
      if (!meta || metaOverride) {
        meta = metaOverride ? { ...defaultMeta(id), ...metaOverride, id } : defaultMeta(id);
        metas.set(id, meta);
      }

      for (const fn of listeners) fn(id, sample, meta);
    },
    read(id) {
      return samples.get(id);
    },
    meta(id) {
      return metas.get(id);
    },
    history(id) {
      const ring = histories.get(id);
      return ring ? ring.toArray() : [];
    },
    ids() {
      return [...samples.keys()];
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    snapshot() {
      const out: IMetricsSnapshot = {};
      for (const [id, sample] of samples) out[id] = sample;
      return out;
    },
  };
}
