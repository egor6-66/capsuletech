import { createSignal, For, onCleanup, onMount, Show } from 'solid-js';
import { useProfiler } from '../../api/useProfiler';
import type { IMetricId } from '../../core/schema';
import { MetricRow } from '../primitives/row';

export function CustomPanel() {
  const bus = useProfiler();
  const [ids, setIds] = createSignal<IMetricId[]>(
    bus.ids().filter((id) => id.startsWith('custom.')),
  );

  onMount(() => {
    const seen = new Set(ids());
    const unsubscribe = bus.subscribe((id) => {
      if (!id.startsWith('custom.')) return;
      if (seen.has(id)) return;
      seen.add(id);
      setIds([...seen]);
    });
    onCleanup(unsubscribe);
  });

  return (
    <Show
      when={ids().length > 0}
      fallback={
        <div style={{ opacity: 0.5, 'font-size': '10px', padding: '4px 0' }}>
          No custom metrics yet. Use{' '}
          <code style={{ color: '#00d4ff' }}>usePerf().count/gauge/time(name)</code> to add some.
        </div>
      }
    >
      <For each={ids()}>{(id) => <MetricRow id={id} />}</For>
    </Show>
  );
}
