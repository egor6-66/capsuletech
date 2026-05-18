import { MetricRow } from '../primitives/row';

export function RuntimePanel() {
  return (
    <div>
      <MetricRow id="fps" />
      <MetricRow id="memory" />
      <MetricRow id="dom.nodes" />
      <MetricRow id="dom.ready" />
      <MetricRow id="longtask" />
      <MetricRow id="loaf" />
      <MetricRow id="event" />
    </div>
  );
}
