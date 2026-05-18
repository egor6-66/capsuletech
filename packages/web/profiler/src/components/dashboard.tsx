import { For, Show } from 'solid-js';
import { getRating } from '../utils';

interface DashboardProps {
  metrics: Record<string, number | string>;
}

export function Dashboard(props: DashboardProps) {
  const entries = () => Object.entries(props.metrics);

  return (
    <Show when={entries().length > 0}>
      <div
        style={{
          position: 'fixed',
          top: '15px',
          right: '15px',
          'background-color': 'rgba(15, 15, 15, 0.95)',
          color: '#fff',
          padding: '12px',
          'border-radius': '10px',
          'font-size': '11px',
          'z-index': '10000',
          'font-family': 'monospace',
          'min-width': '260px',
          border: '1px solid #333',
          'box-shadow': '0 10px 30px rgba(0,0,0,0.5)',
          'pointer-events': 'none',
        }}
      >
        <div
          style={{
            'font-weight': 'bold',
            'margin-bottom': '8px',
            'border-bottom': '1px solid #333',
            'padding-bottom': '5px',
            color: '#00d4ff',
          }}
        >
          🚀 PERFORMANCE MONITOR
        </div>
        <For each={entries()}>
          {(entry) => {
            const [key, val] = entry;
            const isNumeric = typeof val === 'number';
            const rating = isNumeric
              ? getRating(key, val)
              : { label: 'INFO' as const, color: '#3498db', unit: '' };
            const isFloat = key.includes('CLS') || key.includes('Load') || key.includes('Bundle');
            const formattedValue = isNumeric ? val.toFixed(isFloat ? 2 : 0) : val;

            return (
              <div
                style={{
                  display: 'flex',
                  'justify-content': 'space-between',
                  'margin-bottom': '6px',
                }}
              >
                <span style={{ color: '#aaa' }}>{key}:</span>
                <div style={{ 'text-align': 'right' }}>
                  <span style={{ color: rating.color, 'font-weight': 'bold' }}>
                    {formattedValue}
                    <span style={{ 'font-size': '9px', 'margin-left': '4px' }}>{rating.unit}</span>
                  </span>
                  <div style={{ 'font-size': '8px', opacity: 0.6 }}>{rating.label}</div>
                </div>
              </div>
            );
          }}
        </For>
      </div>
    </Show>
  );
}
