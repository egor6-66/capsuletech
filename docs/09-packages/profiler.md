---
tags: [09-packages, profiler]
status: documented
type: guide
---

# 📊 @capsuletech/web-profiler

> [!info]
> Performance-мониторинг для Solid-приложений. Типизированный `MetricsBus` + 13 коллекторов (Web Vitals, memory, network, long tasks, FPS, errors, user timing и т.д.) + reporters (console / sendBeacon / callback) + опциональный визуальный Dashboard. Подключается через `ProfilerProvider` (новый API) или через `BaseProviders vitals` (legacy, всё работает).

> [!ai]
> Для агентов и Claude-инстансов — полный AI-anchor с контрактами и gotchas: [[../_meta/profiler|docs/_meta/profiler.md]]. Если правишь пакет — читай его.

## Структура

```
packages/web/profiler/src/
├── core/                    типы, MetricsBus, ring-buffer, getRating, env-guards
│   ├── schema.ts            IMetricId, IMetricsBus, ICollector, IReporter, ...
│   ├── bus.ts               createMetricsBus
│   ├── ringBuffer.ts        createRingBuffer
│   ├── ratings.ts           getRating(id, value)
│   └── env.ts               isBrowser / hasPO / supportsEntryType
├── collectors/              13 collectors, каждый init(bus) => cleanup
│   ├── webVitals.ts         CLS/FCP/LCP/INP/TTFB
│   ├── memory.ts            performance.memory polling
│   ├── network.ts           getEntriesByType('resource') + PO
│   ├── navigation.ts        DOM ready
│   ├── connection.ts        navigator.connection
│   ├── longTasks.ts         entryTypes ['longtask']
│   ├── loaf.ts              entryTypes ['long-animation-frame']
│   ├── eventTiming.ts       entryTypes ['event']
│   ├── fps.ts               RAF-counter
│   ├── domStats.ts          document.* count
│   ├── errors.ts            window.onerror + unhandledrejection
│   ├── userTiming.ts        entryTypes ['mark', 'measure']
│   └── networkDeep.ts       monkey-patch fetch/XHR/WebSocket (opt-in)
├── reporters/
│   ├── console.ts           bus.subscribe → console.log
│   ├── beacon.ts            navigator.sendBeacon on visibilitychange/pagehide
│   └── callback.ts          bus.subscribe → user fn
├── providers/
│   ├── profiler.tsx         ProfilerProvider (новый API)
│   └── vitalsMonitor.tsx    VitalsMonitoringProvider (legacy shim)
├── api/
│   ├── useProfiler.ts       ProfilerContext + useProfiler / useProfilerSafe
│   └── usePerf.ts           createPerfApi + usePerf (mark/measure/count/gauge/time)
├── components/
│   └── dashboard.tsx        legacy overlay (будет переписан в Phase 2c)
└── utils.ts                 @deprecated helpers (legacy)
```

## Точки входа

```jsonc
{
  "exports": {
    ".":             ".../dist/index.mjs",          // всё
    "./providers":   ".../dist/providers.mjs",      // ProfilerProvider + legacy
    "./api":         ".../dist/api.mjs",            // useProfiler / usePerf
    "./core":        ".../dist/core.mjs",           // createMetricsBus, типы
    "./collectors":  ".../dist/collectors.mjs",
    "./reporters":   ".../dist/reporters.mjs",
    "./components":  ".../dist/components.mjs"      // legacy Dashboard
  }
}
```

## Использование

### Минимальный путь — через `BaseProviders` из web-core

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

`vitals?: boolean` (default — `false`, чтобы прод-бандлы не тянули профайлер). При `true` — внутри `<VitalsMonitoringProvider>` (legacy shim), 5 коллекторов + legacy Dashboard.

### Новый API — `ProfilerProvider`

Если нужны новые коллекторы (longTasks/fps/errors/...), reporters или read-API:

```tsx
import { ProfilerProvider } from '@capsuletech/web-profiler/providers';
import { consoleReporter, beaconReporter } from '@capsuletech/web-profiler/reporters';

export default function App() {
  return (
    <ProfilerProvider
      collectors="all-except-deep"  // default: 12 collectors, без networkDeep
      reporters={[
        consoleReporter({ prefix: '[perf]' }),
        beaconReporter({ url: '/api/metrics' }),
      ]}
    >
      <YourApp />
    </ProfilerProvider>
  );
}
```

`collectors`:
- `'all'` — все 13 (включая `networkDeep`, который monkey-patch'ит fetch/XHR/WS)
- `'all-except-deep'` (default) — 12 коллекторов без `networkDeep`
- `'legacy'` — 5 коллекторов Phase 2a (используется legacy `VitalsMonitoringProvider` shim'ом)
- `ICollector[]` — твой список, например `[webVitalsCollector(), fpsCollector(), errorsCollector()]`

`reporters?: IReporter[]` — список репортеров (см. ниже).

Дополнительно: `bus?: IMetricsBus` (для тестов / DI), `historySize?: number` (default 60, размер ring-buffer истории).

### Доступ к метрикам — `useProfiler()`

```tsx
import { useProfiler } from '@capsuletech/web-profiler/api';

function Stats() {
  const bus = useProfiler();  // throws if outside <ProfilerProvider>
  return (
    <div>
      <p>LCP: {bus.read('lcp')?.value} ms</p>
      <p>FPS: {bus.read('fps')?.value}</p>
      <p>Memory: {bus.read('memory')?.value} MB</p>
    </div>
  );
}
```

`useProfilerSafe()` — undefined-safe вариант (для опциональной зависимости).

`IMetricsBus` API:
- `bus.read(id)` → `{ value, ts } | undefined`
- `bus.meta(id)` → `{ id, kind, label, unit } | undefined`
- `bus.history(id)` → `readonly IMetricSample[]` (для sparkline)
- `bus.ids()` → `readonly IMetricId[]`
- `bus.subscribe(fn)` → unsubscribe (для своих reporter'ов)
- `bus.snapshot()` → `Record<IMetricId, IMetricSample>` (для serialize)
- `bus.write(id, value, meta?)` — обычно дёргается из collectors, но и user-кодом тоже можно

### Custom-метрики — `usePerf()`

```tsx
import { usePerf } from '@capsuletech/web-profiler/api';

function MyComponent() {
  const perf = usePerf();

  const handleClick = async () => {
    perf.count('button.clicks');                    // counter, running total

    const timer = perf.time('api.user.get');
    const user = await api.user.get(id);
    timer.end();                                     // → custom.api.user.get, kind=timing

    perf.gauge('cart.items', cart.length, 'items'); // gauge, verbatim
  };

  return <button onClick={handleClick}>Buy</button>;
}
```

Полный API:

```ts
interface IPerfApi {
  mark(name: string): void;                                 // performance.mark
  measure(name: string, start?: string, end?: string): number | undefined;
  count(name: string, n?: number): void;                    // running total → counter
  gauge(name: string, value: number, unit?: string): void;  // verbatim → gauge
  time(name: string): { end(): number };                    // elapsed ms → timing
}
```

Все custom-метрики пишутся как `custom.${name}` в bus.

`mark`/`measure` идут через `performance.mark`/`performance.measure` — их подхватывает `userTimingCollector` и пишет в bus как `custom.mark.${name}` / `custom.measure.${name}`. Это даёт пересечение с DevTools Performance tab — твои marks видны там, и в профайлере одновременно.

## Reporters

Каждый reporter — `IReporter = { name, init(bus) => cleanup }`. Запускается через `<ProfilerProvider reporters={[...]}>`.

### `consoleReporter`

```ts
consoleReporter({ prefix?: string; filter?: (id: string) => boolean })
```

Логирует каждый bus.write через `bus.subscribe`. По умолчанию `prefix = '[profiler]'`. `filter` — пред-фильтр по id (например `(id) => id.startsWith('error.')`).

### `beaconReporter`

```ts
beaconReporter({
  url: string;
  on?: Array<'hidden' | 'pagehide'>;       // default обе
  serializer?: (snapshot) => BodyInit;     // default JSON.stringify(snapshot)
})
```

При `visibilitychange='hidden'` и/или `pagehide` шлёт `bus.snapshot()` через `navigator.sendBeacon`. Ошибки глушит (best-effort). Идеально для отправки метрик в свой analytics-endpoint при закрытии вкладки.

### `callbackReporter`

```ts
callbackReporter((id, sample, meta) => { /* ... */ })
```

Тонкая обёртка над `bus.subscribe`. Используй когда нужно стримить метрики в произвольный sink (Sentry, Datadog, GA).

## Какие метрики собираются

С Phase 2b — 22 встроенных id'а + custom-namespace:

**Web Vitals:** `lcp`, `fcp`, `cls`, `inp`, `ttfb`.
**Runtime:** `memory`, `fps`, `dom.nodes`, `dom.ready`.
**Network:** `network.transfer`, `network.decoded`. С `networkDeep` — ещё `network.inflight` / `network.requests` / `network.failed`.
**Connection:** `connection` (effectiveType — '4g'/'3g'/...).
**Jank/responsiveness:** `longtask`, `loaf`, `event`.
**Errors:** `error.js`, `error.promise`.
**User Timing:** `custom.mark.${name}`, `custom.measure.${name}`.
**Custom:** `custom.${name}` через `usePerf().count/gauge/time`.

Каждой числовой метрике `getRating(id, value)` возвращает рейтинг:

| Label | Цвет |
|---|---|
| `'good'` | зелёный (`#10b981`) |
| `'needs-improvement'` | жёлтый (`#f59e0b`) |
| `'poor'` | красный (`#ef4444`) |
| `'info'` | синий (`#3498db`) — для unknown id / string value |

Пороги — стандартные Web Vitals (`web.dev/vitals`), для остальных — захардкожены в [core/ratings.ts](../../packages/web/profiler/src/core/ratings.ts). `fps` — единственная метрика с inverse-rating (higher-is-better).

## networkDeep (opt-in)

Monkey-patches `fetch`, `XMLHttpRequest.prototype.send`, `WebSocket`. Считает in-flight + total + failed запросов. Включается явно:

```tsx
<ProfilerProvider collectors="all">  {/* или */}
<ProfilerProvider collectors={[webVitalsCollector(), networkDeepCollector()]}>
```

> [!warning]
> `networkDeep` патчит глобалы — потенциальный конфликт с другими SDK что делают то же (Sentry, Datadog, GTM). Если используешь такие — либо отключи там, либо не включай `networkDeep`. Cleanup восстанавливает оригиналы при unmount.

## Dashboard

Встроенный виджет с 5 вкладками (Vitals / Runtime / Network / Errors / Custom), draggable, collapsible. Sparkline'ы из ring-buffer истории. Позиция, свёрнутость и активная вкладка сохраняются в `localStorage` под ключом `capsule:profiler:dashboard`.

Включается через `showDashboard`:

```tsx
<ProfilerProvider showDashboard collectors="all-except-deep">
  <YourApp />
</ProfilerProvider>
```

Через `BaseProviders` — тоже:

```tsx
<BaseProviders vitals>             {/* showDashboard default = true */}
<BaseProviders vitals showDashboard={false}>   {/* метрики без UI */}
```

Реализация на `@kobalte/core` (Tabs), inline-стили. Зависит от `@kobalte/core` через peerDependencies — все Capsule-app'ы уже его тащат через `@capsuletech/web-ui`. Если ставишь профайлер в чужой проект — добавь `@kobalte/core@^0.13` в свои зависимости.

### Свой UI вместо встроенного

Если нужен полностью свой Dashboard — не передавай `showDashboard`, и собирай через `useProfiler()` либо примитивы из `@capsuletech/web-profiler` main entry:

```tsx
import { useProfiler } from '@capsuletech/web-profiler/api';
import { MetricRow, Sparkline } from '@capsuletech/web-profiler';

function MyDashboard() {
  const bus = useProfiler();
  return (
    <div>
      <MetricRow id="fps" />
      <MetricRow id="memory" showSparkline={false} />
      <Sparkline samples={() => bus.history('lcp')} width={120} height={30} />
    </div>
  );
}
```

Доступные примитивы из `widget/`:
- `ProfilerDashboard` — корневой виджет
- `ProfilerWindow` — draggable контейнер
- `MetricRow` — строка метрики
- `Sparkline` — SVG-полилиния
- `VitalsPanel` / `RuntimePanel` / `NetworkPanel` / `ErrorsPanel` / `CustomPanel`

## SSR

Все коллекторы и reporters внутри проверяют `isBrowser` / `hasPO` / `supportsEntryType` и no-op'ят в node-окружении. `ProfilerProvider` запускается через `onMount` — на сервере collectors не стартуют. Тем не менее: если делаешь явную предсборку — оборачивай в `<Show when={isClient}>` или используй `useProfilerSafe()`.

## Тесты

В `src/__tests__/` — 29 vitest-тестов (`environment: 'node'`):
- `bus.test.ts` (9) — write/read/history/meta/snapshot/subscribers
- `ratings.test.ts` (5) — Web Vitals thresholds + inverse-rating для fps
- `ringBuffer.test.ts` (4) — capacity/overwrite/last/edge cases
- `perfApi.test.ts` (6) — count/gauge/time/mark/measure
- `reporters.test.ts` (5) — callback + console (с моком)

`pnpm --filter @capsuletech/web-profiler test`. Все зелёные.

## Roadmap

- **Phase 1 ✅** docs + AI-anchor
- **Phase 2a ✅** core + 5 collectors
- **Phase 2b ✅** 8 новых collectors + reporters + ProfilerProvider + useProfiler/usePerf
- **Phase 2c ✅** Dashboard rewrite (draggable + tabbed + sparklines, kobalte Tabs, localStorage persistence)
- **Phase 3 / 0.2.x ⏳** удаление deprecated (`VitalsMonitoringProvider`, `components/dashboard.tsx`, `utils.ts`); HCA-интеграция (`services.profiler` инжект в Feature); `dom.listeners` monkey-patch.

Подробности — [[../_meta/profiler#Roadmap]].

## Связанное

- [[core|@capsuletech/web-core]] — `BaseProviders.vitals` подключает legacy провайдер.
- [[../_meta/profiler|profiler — AI anchor]] — для агентов: контракты, gotchas, чек-листы.
