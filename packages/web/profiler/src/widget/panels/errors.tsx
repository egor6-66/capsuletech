import { MetricRow } from '../primitives/row';

export function ErrorsPanel() {
  return (
    <div>
      <MetricRow id="error.js" />
      <MetricRow id="error.promise" />
    </div>
  );
}
