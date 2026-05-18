import type { IBuiltinMetricId, IMetricId, IRating } from './schema';

const GOOD: IRating = { label: 'good', color: '#10b981' };
const NI: IRating = { label: 'needs-improvement', color: '#f59e0b' };
const POOR: IRating = { label: 'poor', color: '#ef4444' };
const INFO: IRating = { label: 'info', color: '#3498db' };

type Thresholds = readonly [niLow: number, poorLow: number];

const THRESHOLDS: Partial<Record<IBuiltinMetricId, Thresholds>> = {
  lcp: [2500, 4000],
  fcp: [1800, 3000],
  cls: [0.1, 0.25],
  inp: [200, 500],
  ttfb: [800, 1800],
  memory: [50, 100],
  'network.transfer': [1, 3],
  'network.decoded': [1, 3],
  'dom.ready': [1500, 3000],
  longtask: [50, 100],
  loaf: [50, 100],
  event: [40, 100],
  fps: [55, 30],
  'dom.nodes': [1500, 3000],
  'dom.listeners': [500, 1500],
};

const HIGHER_IS_BETTER: Partial<Record<IBuiltinMetricId, true>> = {
  fps: true,
};

export function getRating(id: IMetricId, value: number | string): IRating {
  if (typeof value !== 'number') return INFO;
  const t = THRESHOLDS[id as IBuiltinMetricId];
  if (!t) return INFO;
  const [ni, poor] = t;
  if (HIGHER_IS_BETTER[id as IBuiltinMetricId]) {
    if (value >= ni) return GOOD;
    if (value >= poor) return NI;
    return POOR;
  }
  if (value < ni) return GOOD;
  if (value < poor) return NI;
  return POOR;
}
