import { type Accessor, Show, createMemo } from 'solid-js';
import { getRating } from '../../core/ratings';
import type { IMetricId, IMetricMeta, IMetricSample } from '../../core/schema';
import { useProfiler } from '../../api/useProfiler';
import { Sparkline } from './sparkline';

export interface IMetricRowProps {
  id: IMetricId;
  showSparkline?: boolean;
  labelOverride?: string;
}

function formatValue(value: number | string, id: IMetricId): string {
  if (typeof value !== 'number') return String(value);
  const isFloat = id === 'cls' || id.startsWith('network.') || id === 'memory';
  return value.toFixed(isFloat ? 2 : 0);
}

export function MetricRow(props: IMetricRowProps) {
  const bus = useProfiler();
  const sample: Accessor<IMetricSample | undefined> = () => bus.read(props.id);
  const meta: Accessor<IMetricMeta | undefined> = () => bus.meta(props.id);
  const history = () => bus.history(props.id);

  const rating = createMemo(() => {
    const s = sample();
    if (!s) return undefined;
    return getRating(props.id, s.value);
  });

  return (
    <Show when={sample()}>
      {(s) => (
        <div
          style={{
            display: 'flex',
            'align-items': 'center',
            'justify-content': 'space-between',
            gap: '8px',
            'margin-bottom': '6px',
          }}
        >
          <span style={{ color: '#aaa', 'flex-shrink': 0 }}>
            {props.labelOverride ?? meta()?.label ?? props.id}:
          </span>
          <Show when={props.showSparkline !== false && history().length > 1}>
            <Sparkline samples={history} color={rating()?.color} width={60} height={14} />
          </Show>
          <span
            style={{
              color: rating()?.color ?? '#3498db',
              'font-weight': 'bold',
              'text-align': 'right',
              'flex-shrink': 0,
            }}
          >
            {formatValue(s().value, props.id)}
            <Show when={meta()?.unit}>
              <span style={{ 'font-size': '9px', 'margin-left': '4px', opacity: 0.7 }}>
                {meta()?.unit}
              </span>
            </Show>
          </span>
        </div>
      )}
    </Show>
  );
}
