import { type Accessor, createMemo, Show } from 'solid-js';
import type { IMetricSample } from '../../core/schema';

export interface ISparklineProps {
  samples: Accessor<readonly IMetricSample[]>;
  width?: number;
  height?: number;
  color?: string;
}

export function Sparkline(props: ISparklineProps) {
  const width = () => props.width ?? 80;
  const height = () => props.height ?? 20;
  const color = () => props.color ?? '#00d4ff';

  const path = createMemo(() => {
    const data = props.samples();
    if (data.length < 2) return null;

    const values = data
      .map((s) => (typeof s.value === 'number' ? s.value : Number.NaN))
      .filter((v) => Number.isFinite(v));
    if (values.length < 2) return null;

    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const w = width();
    const h = height();
    const step = w / (values.length - 1);

    let d = '';
    for (let i = 0; i < values.length; i++) {
      const x = i * step;
      const y = h - ((values[i] - min) / range) * h;
      d += `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)} `;
    }
    return d.trim();
  });

  return (
    <Show when={path()} fallback={<span style={{ opacity: 0.3, 'font-size': '9px' }}>—</span>}>
      {(d) => (
        <svg
          width={width()}
          height={height()}
          viewBox={`0 0 ${width()} ${height()}`}
          style={{ display: 'block' }}
          role="img"
          aria-label="Metric sparkline"
        >
          <title>Metric sparkline</title>
          <path d={d()} fill="none" stroke={color()} stroke-width="1.5" />
        </svg>
      )}
    </Show>
  );
}
