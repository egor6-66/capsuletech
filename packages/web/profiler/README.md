# @capsuletech/web-profiler

Performance monitoring and profiling utilities for SolidJS applications.

> Part of the [Capsule](https://github.com/egor6-66/capsule) framework. Full docs (humans): `docs/09-packages/profiler.md`. AI/agent anchor with contracts and gotchas: `docs/_meta/profiler.md`.

## Features

- Web Vitals tracking (CLS / FCP / INP / LCP / TTFB) via `web-vitals` 5.x
- Memory usage (`performance.memory`, Chromium-only)
- Network / bundle size (`PerformanceObserver` on `resource` entries)
- Connection type (`navigator.connection`)
- DOM-ready timing
- Optional visual Dashboard overlay
- RAF-batched updates

## Installation

```bash
pnpm add @capsuletech/web-profiler
```

## Usage

### Canonical — via `BaseProviders` from `@capsuletech/web-core`

```tsx
import { BaseProviders } from '@capsuletech/web-core';

export default function App() {
  return (
    <BaseProviders vitals>
      <YourApp />
    </BaseProviders>
  );
}
```

`vitals` defaults to `false` so production bundles of `apps/<app>` don't pull profiler overhead.

### Direct — for fine-grained control (e.g. hide the dashboard)

```tsx
import { VitalsMonitoringProvider } from '@capsuletech/web-profiler/providers';

export default function App() {
  return (
    <VitalsMonitoringProvider showDashboard={false}>
      <YourApp />
    </VitalsMonitoringProvider>
  );
}
```

### Writing custom metrics into the dashboard

```tsx
import { useVitalsContext } from '@capsuletech/web-profiler/providers';

function MyComponent() {
  const ctx = useVitalsContext();
  ctx?.updateComponentMetric('🧩 My Metric', 42);
}
```

> **Note:** the context currently exposes **only** `updateComponentMetric`. There is no read-API for accumulated metrics yet. A typed read-API + collector pattern is on the roadmap — see `docs/_meta/profiler.md`.

## Monitored metrics

- **FCP** — First Contentful Paint
- **LCP** — Largest Contentful Paint
- **CLS** — Cumulative Layout Shift
- **INP** — Interaction to Next Paint
- **TTFB** — Time to First Byte
- **Memory Usage** — JavaScript heap (Chromium only)
- **Network Load** — total transferred resource bytes
- **Total Bundle** — total decoded resource bytes
- **Dom Ready** — `domContentLoadedEventEnd`
- **Network** — `effectiveType` from `navigator.connection`

Each numeric metric gets a `good` / `needs-improvement` / `poor` rating via standard Web Vitals thresholds.

## Known limitations

- Not SSR-safe (no `typeof window` guards yet)
- Dashboard is `position: fixed; pointer-events: none` — not draggable / collapsible (yet)
- Metric keys are display strings with emojis — string-matching via `.includes()` for ratings (planned: typed `MetricId`)
- `useVitalsContext()` write-only — no read-API yet

See `docs/_meta/profiler.md` for the full gotcha list and roadmap.

## License

MIT
