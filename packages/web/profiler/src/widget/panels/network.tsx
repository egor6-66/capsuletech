import { MetricRow } from '../primitives/row';

export function NetworkPanel() {
  return (
    <div>
      <MetricRow id="network.transfer" />
      <MetricRow id="network.decoded" />
      <MetricRow id="network.inflight" />
      <MetricRow id="network.requests" />
      <MetricRow id="network.failed" />
      <MetricRow id="connection" showSparkline={false} />
    </div>
  );
}
