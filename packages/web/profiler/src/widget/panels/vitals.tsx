import { MetricRow } from '../primitives/row';

export function VitalsPanel() {
  return (
    <div>
      <MetricRow id="lcp" />
      <MetricRow id="fcp" />
      <MetricRow id="cls" />
      <MetricRow id="inp" />
      <MetricRow id="ttfb" />
    </div>
  );
}
