# @capsuletech/web-profiler

Performance monitoring and profiling utilities for SolidJS applications.

> Part of the [Capsule](https://github.com/egor6-66/capsule) framework. Full docs (humans): `docs/09-packages/profiler.md`. AI/agent anchor with contracts and gotchas: `docs/_meta/profiler.md`.

## Features

- Typed `MetricsBus` (no string keys, no `.includes()` matching)
- 13 built-in collectors: Web Vitals (CLS/FCP/LCP/INP/TTFB), memory, network (transfer/decoded/inflight/failed), navigation, connection, long tasks, LoAF, event timing, FPS, DOM stats, errors, user timing, deep network (monkey-patch fetch/XHR/WS — opt-in)
- 3 reporters: console, sendBeacon (on `visibilitychange='hidden'`/`pagehide`), callback
- Public read+write API: `useProfiler()`, `usePerf()` (`mark/measure/count/gauge/time`)
- Per-metric ring-buffer history (default 60 samples) for sparklines
- SSR-safe (no-ops on the server)
- RAF-batched updates, dedup on equal values
- Backwards-compatible legacy `VitalsMonitoringProvider` shim

## Installation

```bash
pnpm add @capsuletech/web-profiler
```

## Usage

### Quick start — new API

```tsx
import { ProfilerProvider } from '@capsuletech/web-profiler/providers';
import { consoleReporter, beaconReporter } from '@capsuletech/web-profiler/reporters';

export default function App() {
  return (
    <ProfilerProvider
      collectors="all-except-deep"
      reporters={[consoleReporter(), beaconReporter({ url: '/api/metrics' })]}
    >
      <YourApp />
    </ProfilerProvider>
  );
}
```

### Read metrics anywhere in the tree

```tsx
import { useProfiler } from '@capsuletech/web-profiler/api';

function Stats() {
  const bus = useProfiler();
  return <div>FPS: {bus.read('fps')?.value}</div>;
}
```

### Custom metrics with `usePerf`

```tsx
import { usePerf } from '@capsuletech/web-profiler/api';

function MyComponent() {
  const perf = usePerf();
  const handle = async () => {
    perf.count('button.clicks');
    const timer = perf.time('api.user.get');
    await api.user.get();
    timer.end();
  };
  return <button onClick={handle}>Buy</button>;
}
```

### Legacy compat (still works)

```tsx
import { BaseProviders } from '@capsuletech/web-core';
// or:
import { VitalsMonitoringProvider } from '@capsuletech/web-profiler/providers';
```

`<BaseProviders vitals>` and `<VitalsMonitoringProvider>` are kept as thin deprecated shims over `<ProfilerProvider collectors="legacy">`. See `docs/09-packages/profiler.md` for details.

## Monitored metrics

Web Vitals (`lcp`/`fcp`/`cls`/`inp`/`ttfb`), runtime (`memory`/`fps`/`dom.nodes`/`dom.ready`), network (`network.transfer`/`network.decoded`, plus `network.inflight`/`network.requests`/`network.failed` with `networkDeep`), `connection`, jank (`longtask`/`loaf`/`event`), errors (`error.js`/`error.promise`), user timing (`custom.mark.${name}`/`custom.measure.${name}`), and arbitrary `custom.${name}` from `usePerf`.

Each numeric metric is rated via `getRating(id, value)` (Web Vitals thresholds + inverse rating for `fps`).

## Dashboard

Enable with `showDashboard`:

```tsx
<ProfilerProvider showDashboard collectors="all-except-deep">
  <YourApp />
</ProfilerProvider>
```

Draggable, collapsible, 5 tabs (Vitals / Runtime / Network / Errors / Custom), sparklines from ring-buffer history. Position, collapsed state, and active tab persist to `localStorage` under `capsule:profiler:dashboard`. Built on `@kobalte/core` Tabs (peer dependency).

## Known limitations

- `dom.listeners` not implemented (would require monkey-patch of `addEventListener`)
- `networkDeep` monkey-patches `fetch`/`XHR`/`WebSocket` — opt-in; may conflict with other patching SDKs (Sentry, Datadog, GTM)
- Legacy `components/dashboard.tsx` and `utils.ts` kept for backward compat; will be removed in 0.2.x

See `docs/_meta/profiler.md` for the full gotcha list, file:line refs, and roadmap.

## License

MIT
