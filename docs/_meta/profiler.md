---
tags: [meta, profiler, ai-context]
status: documented
type: ai-anchor
audience: claude
---

# 🤖 web-profiler — AI context anchor

> [!ai]
> Шпаргалка для Claude-инстансов. Без воды. Юзеру — [[../09-packages/profiler|profiler.md]].

## TL;DR

`@capsuletech/web-profiler` — performance-мониторинг для Solid-приложений на collector-pattern. Типизированный `MetricsBus` собирает данные из подключённых коллекторов и раздаёт их (а) виджет-Dashboard'у (kobalte Tabs, draggable, sparklines), (б) reporters'ам (console / sendBeacon / callback), (в) user-коду через `useProfiler()` / `usePerf()`.

С Phase 2c — 13 встроенных collector'ов, 3 reporters, новый Dashboard (`ProfilerDashboard`) с 5 вкладками (Vitals / Runtime / Network / Errors / Custom), draggable + collapsible + localStorage persistence. Подключается через `<ProfilerProvider showDashboard>` либо через `<BaseProviders vitals>` (legacy путь — теперь тоже показывает новый Dashboard).

Контракт «снаружи»: `<ProfilerProvider collectors="all-except-deep" reporters={[...]} showDashboard>` оборачивает app → метрики капают в bus → `useProfiler()` отдаёт типизированный bus → `usePerf()` — обёртка с `mark/measure/count/gauge/time`. Legacy `<VitalsMonitoringProvider>` остаётся как deprecated shim. Ноль breaking changes для существующих consumers.

## Где что лежит

После Phase 2b (2026-05-18) внутри пакета — типизированный `MetricsBus`, 13 collector'ов, 3 reporters, новый `ProfilerProvider` + public `useProfiler()`/`usePerf()` API. Legacy `VitalsMonitoringProvider` теперь thin deprecated shim над `<ProfilerProvider collectors="legacy">`. Снаружи (BaseProviders.vitals) — ноль breaking changes.

### Core
| Файл | Что |
|---|---|
| `src/core/schema.ts` | Типы: `IBuiltinMetricId` (22 встроенных), `ICustomMetricId` (`'custom.${string}'`), `IMetricId`, `IMetricKind`, `IMetricMeta`, `IMetricSample`, `IRating`, `IMetricsBus`, `ICollector`, `IReporter`, `IMetricsListener`, `IMetricsSnapshot`. **Источник правды для контракта.** |
| `src/core/bus.ts` | `createMetricsBus({ historySize? })` — Map-based bus с per-metric ring-buffer history, default-meta таблица по `id`, dedup-on-equal-value, subscribers. |
| `src/core/ringBuffer.ts` | `createRingBuffer<T>(capacity)`. |
| `src/core/ratings.ts` | `getRating(id, value)` — lookup-table по `IBuiltinMetricId`. `HIGHER_IS_BETTER['fps']`. `'info'` для unknown/string. |
| `src/core/env.ts` | `isBrowser`, `hasPO()`, `supportsEntryType(type)`. **Используется и collectors, и reporters'ами.** |
| `src/core/index.ts` | Barrel. |

### Collectors (13)
| Файл | Что |
|---|---|
| `collectors/webVitals.ts` | CLS/FCP/LCP/INP/TTFB через `web-vitals` 5.x. `{ reportAllChanges? = true }`. Disposed-flag gate. |
| `collectors/memory.ts` | `(performance as any).memory.usedJSHeapSize`, MB. `{ intervalMs? = 2000 }`. Chromium-only. |
| `collectors/network.ts` | `getEntriesByType('resource')` → `network.transfer` / `network.decoded`. `{ secondPassDelayMs? = 2000 }`. |
| `collectors/navigation.ts` | `getEntriesByType('navigation')[0].domContentLoadedEventEnd` → `dom.ready`. One-shot. |
| `collectors/connection.ts` | `navigator.connection.effectiveType` → `connection` + listener на `'change'`. |
| `collectors/longTasks.ts` | `entryTypes: ['longtask']`, threshold-фильтр (default 50ms) → `longtask`. |
| `collectors/loaf.ts` | `entryTypes: ['long-animation-frame']`, threshold (default 50ms) → `loaf`. |
| `collectors/eventTiming.ts` | `type: 'event', buffered: true, durationThreshold: 40` → `event`. |
| `collectors/fps.ts` | RAF-counter + setInterval (default 1000ms) → `fps` (округлённый). Cleanup чистит и RAF, и interval. |
| `collectors/domStats.ts` | `document.getElementsByTagName('*').length` каждые 5s → `dom.nodes`. `dom.listeners` пока не реализован (нужен monkey-patch addEventListener). |
| `collectors/errors.ts` | `window.addEventListener('error' / 'unhandledrejection')` → `error.js` / `error.promise` (running counters). |
| `collectors/userTiming.ts` | `entryTypes: ['mark', 'measure']` → `custom.mark.${name}` / `custom.measure.${name}` (per-name, kind=event/timing). |
| `collectors/networkDeep.ts` | **opt-in.** Monkey-patches `fetch`, `XMLHttpRequest.prototype.send`, `WebSocket`. Counters: `network.inflight`, `network.requests`, `network.failed`. `{ patchFetch?, patchXHR?, patchWebSocket? }`. |
| `collectors/_ssr.ts` | Реэкспорт из `core/env.ts` для legacy-импортов. |
| `collectors/index.ts` | Barrel. |

### Reporters (3)
| Файл | Что |
|---|---|
| `reporters/console.ts` | `consoleReporter({ prefix?, filter? })`. Логирует каждый `bus.subscribe`-tick. |
| `reporters/beacon.ts` | `beaconReporter({ url, on?: ('hidden' \| 'pagehide')[], serializer? })`. `navigator.sendBeacon` на `visibilitychange='hidden'` и/или `pagehide`. Best-effort, ошибки глушит. |
| `reporters/callback.ts` | `callbackReporter(fn)` — generic-форма поверх `bus.subscribe`. |
| `reporters/index.ts` | Barrel. |

### Provider + Public API
| Файл | Что |
|---|---|
| `providers/profiler.tsx` | `ProfilerProvider`: создаёт bus (или принимает `bus` prop), запускает выбранные `collectors` и `reporters` через `onMount`, чистит через `onCleanup`. `collectors`: `'all'` (с networkDeep) \| `'all-except-deep'` (default, 12 коллекторов) \| `'legacy'` (5) \| `ICollector[]`. Cleanup'ы каждого коллектора в `try/catch` — один битый не валит дерево. |
| `api/useProfiler.ts` | `ProfilerContext = createContext<IMetricsBus \| undefined>(undefined)`. `useProfiler()` — **throws** если нет провайдера. `useProfilerSafe()` — undefined-safe. |
| `api/usePerf.ts` | `createPerfApi(bus)` → `{ mark, measure, count, gauge, time }`. `usePerf()` = `createPerfApi(useProfiler())`. `count` хранит running total в локальном Map, пишет в bus как counter. `time(name)` возвращает `{ end() }` через `performance.now`/`Date.now` fallback. `mark`/`measure` — no-throw обёртки над Performance API (захватываются `userTimingCollector`'ом). |
| `api/index.ts` | Barrel. |

### Widget (Phase 2c)
| Файл | Что |
|---|---|
| `widget/dashboard.tsx` | `ProfilerDashboard` — корневой draggable виджет. Kobalte `<Tabs>` с 5 вкладками. Persistence активной вкладки через `localStorage`. |
| `widget/primitives/window.tsx` | `ProfilerWindow` — draggable + collapsible контейнер с pointer-event handlers, viewport clamp на `resize`. `localStorage` key `capsule:profiler:dashboard` хранит `{x,y,collapsed,tab}`. Заголовок — drag handle (`data-profiler-drag-handle="true"`). Кнопка `▾/▸` для свёртки. |
| `widget/primitives/sparkline.tsx` | `Sparkline` — SVG-полилиния из `bus.history(id)` (ring-buffer). Reactive через `createMemo`. Min 2 точки. Auto-scale. |
| `widget/primitives/row.tsx` | `MetricRow id={IMetricId}` — `bus.read` + `bus.history` + `getRating`. Цвет числа = rating.color. Sparkline можно отключить `showSparkline={false}`. |
| `widget/panels/{vitals,runtime,network,errors,custom}.tsx` | 5 панелей. `custom.tsx` — реактивно слушает bus, фильтрует `id.startsWith('custom.')`, рендерит каждую как row. |
| `widget/index.ts` | Barrel. |

### Legacy + utils
| Файл | Что |
|---|---|
| `providers/vitalsMonitor.tsx` | `VitalsMonitoringProvider` = `<ProfilerProvider collectors="legacy" showDashboard>` + `LegacyVitalsBridge` (просто экспонирует `IMonitoringContextType.updateComponentMetric` через `VitalsMonitoringContext`). Все символы — `@deprecated`. С 2c больше НЕ проецирует на display-keys и НЕ рендерит legacy Dashboard — новый Dashboard приходит через `ProfilerProvider.showDashboard`. |
| `providers/index.ts` | Barrel: `ProfilerProvider` + legacy `VitalsMonitoringProvider` / `useVitalsContext` / `VitalsMonitoringContext` / `IMonitoringContextType`. |
| `components/dashboard.tsx` | Legacy overlay. **Никем не используется автоматически.** Доступен через `@capsuletech/web-profiler/components` для тех кто рендерит руками с `Record<string, number\|string>` prop'ом. Удалить в 0.2.x. |
| `utils.ts` | Все helpers (`setupWebVitalsTracking`, `getRating` legacy, ...) — `@deprecated`/`@internal`. Используются только legacy `components/dashboard.tsx`. |

### Конфиг + тесты
| Файл | Что |
|---|---|
| `src/__tests__/` | `bus.test.ts` (9), `ratings.test.ts` (5), `ringBuffer.test.ts` (4), `perfApi.test.ts` (6), `reporters.test.ts` (5). **29 тестов, все зелёные.** |
| `vite.config.mts` | `libConfig` с 7 entry: `index`, `providers`, `components`, `core`, `collectors`, `reporters`, `api`. |
| `vitest.config.ts` | `environment: 'node'`. |
| `package.json` | Subpath exports: `.`, `./providers`, `./components`, `./core`, `./collectors`, `./reporters`, `./api`. Dep: `web-vitals ^5.2.0`. PeerDep: `solid-js ^1.9.0`. |
| `packages/web/core/src/providers/base.tsx` | `BaseProviders.vitals?: boolean` — без изменений. Под капотом `VitalsMonitoringProvider` теперь shim над `ProfilerProvider`. |

## Точки входа

```jsonc
{
  "exports": {
    ".":             ".../dist/index.mjs",          // всё сразу
    "./providers":   ".../dist/providers.mjs",      // ProfilerProvider + legacy VitalsMonitoringProvider
    "./api":         ".../dist/api.mjs",            // useProfiler / useProfilerSafe / usePerf / createPerfApi
    "./core":        ".../dist/core.mjs",           // createMetricsBus, getRating, createRingBuffer, env, типы
    "./collectors":  ".../dist/collectors.mjs",     // 13 коллекторов
    "./reporters":   ".../dist/reporters.mjs",      // console / beacon / callback
    "./components":  ".../dist/components.mjs"      // legacy Dashboard
  }
}
```

В Capsule-приложениях канонический путь — `BaseProviders vitals` из [[core|@capsuletech/web-core]]. Прямой импорт `@capsuletech/web-profiler/providers` используется только если нужен кастомный `showDashboard={false}` (через `BaseProviders` пока не пробрасывается).

## Контракт API

### Public (Phase 2b — new API)

```ts
// providers/profiler.tsx
type IProfilerCollectorsOpt = 'all' | 'all-except-deep' | 'legacy' | ICollector[];

interface IProfilerProviderProps {
  children: JSX.Element;
  collectors?: IProfilerCollectorsOpt;   // default 'all-except-deep' (12 collectors, no networkDeep)
  reporters?: IReporter[];
  bus?: IMetricsBus;                     // inject (e.g. tests)
  historySize?: number;                  // default 60
  showDashboard?: boolean;               // default false; renders <ProfilerDashboard /> as sibling
}

function ProfilerProvider(props): JSX.Element;

// api/useProfiler.ts
function useProfiler(): IMetricsBus;       // throws if outside <ProfilerProvider>
function useProfilerSafe(): IMetricsBus | undefined;
const ProfilerContext: Context<IMetricsBus | undefined>;

// api/usePerf.ts
interface IPerfApi {
  mark(name: string): void;                                // → performance.mark → userTimingCollector
  measure(name: string, start?: string, end?: string): number | undefined;
  count(name: string, n?: number): void;                   // running total, kind=counter
  gauge(name: string, value: number, unit?: string): void; // verbatim, kind=gauge
  time(name: string): { end(): number };                   // returns elapsed ms, kind=timing
}
function createPerfApi(bus: IMetricsBus): IPerfApi;
function usePerf(): IPerfApi;
```

Все custom-метрики из `usePerf` пишутся под id `custom.${name}`. Imeena Counter и `count` (`count('clicks')` → `custom.clicks` с running total — НЕ delta).

### Public (legacy, Phase 2a stable, deprecated)

```ts
interface VitalsMonitoringProviderProps {
  children: JSX.Element;
  showDashboard?: boolean;  // default true
}

interface IMonitoringContextType {
  updateComponentMetric: (name: string, value: number | string) => void;
  /** @internal — typed bus is exposed for Phase 2b read-API; do NOT use externally yet. */
  bus: IMetricsBus;
}

const VitalsMonitoringContext: Context<IMonitoringContextType | undefined>;
function useVitalsContext(): IMonitoringContextType | undefined;
```

`updateComponentMetric(name, value)` теперь пишет в bus под `id = \`custom.${name}\`` с `meta.label = name`. То есть строковые значения **сохраняются** (раньше — мёртвая ветка).

### Internal (core, экспортируется из `./core`)

```ts
interface IMetricsBus {
  write(id: IMetricId, value: number | string, meta?: Partial<IMetricMeta>): void;
  read(id: IMetricId): IMetricSample | undefined;
  meta(id: IMetricId): IMetricMeta | undefined;
  history(id: IMetricId): readonly IMetricSample[];
  ids(): readonly IMetricId[];
  subscribe(fn: IMetricsListener): () => void;
  snapshot(): IMetricsSnapshot;
}

interface ICollector {
  readonly name: string;
  init(bus: IMetricsBus): () => void;   // returns cleanup
}

function createMetricsBus(opts?: { historySize?: number }): IMetricsBus;  // default 60
function getRating(id: IMetricId, value: number | string): IRating;
```

> [!warning]
> Public `useProfiler()` read+write API ещё не выкачен — это Phase 2b. До тех пор `useVitalsContext().bus` помечен `@internal` и не реэкспортируется как стабильное API. README и старый user-doc до Phase 2a врали что `useVitalsContext()` отдаёт метрики (отдавало только `updateComponentMetric`) — починено в Phase 1 (docs) и Phase 2a (bus добавлен в context как `@internal`).

## Что хранится в bus'е

С Phase 2b — 22 встроенных `IBuiltinMetricId` + `custom.${string}`. Сводка по коллекторам:

| `IMetricId` | Источник | Update-частота | Legacy display-key |
|---|---|---|---|
| `'cls'` / `'fcp'` / `'lcp'` / `'inp'` / `'ttfb'` | `web-vitals` 5.x | per-change (TTFB — final) | `CLS`/`FCP`/`LCP`/`INP`/`TTFB` |
| `'memory'` | `performance.memory.usedJSHeapSize` (MB) | `setInterval(2000)` | `💻 Memory Usage` |
| `'network.transfer'` / `'network.decoded'` | `getEntriesByType('resource')` (MB) | initial + 2s + PO | `📡 Network Load` / `📦 Total Bundle` |
| `'network.inflight'` | monkey-patch fetch/XHR/WS (gauge) | per-request — only with `networkDeep` | — |
| `'network.requests'` / `'network.failed'` | monkey-patch fetch/XHR/WS (counters) | per-request — only with `networkDeep` | — |
| `'dom.ready'` | navigation entry (ms) | one-shot | `⏱️ Dom Ready` |
| `'connection'` | `navigator.connection.effectiveType` | initial + listener | `🌐 Network` |
| `'longtask'` | PO `'longtask'`, > 50ms (ms) | per-task | — |
| `'loaf'` | PO `'long-animation-frame'`, > 50ms (ms) | per-frame | — |
| `'event'` | PO `'event'`, > 40ms (ms) | per-event | — |
| `'fps'` | RAF-counter (frames/sec) | каждую секунду | — |
| `'dom.nodes'` | `getElementsByTagName('*').length` | каждые 5s | — |
| `'dom.listeners'` | (не реализован) | — | — |
| `'error.js'` / `'error.promise'` | `window.onerror` / `unhandledrejection` (counters) | per-error | — |
| `'user.measure'` / `'user.mark'` | aggregate-id'ы (не используются коллектором) | — | — |
| `'custom.mark.${name}'` | `performance.mark` через `userTimingCollector` | per-mark | — |
| `'custom.measure.${name}'` | `performance.measure` через `userTimingCollector` | per-measure | — |
| `'custom.${name}'` (произвольное) | `usePerf().count/gauge/time` | per-call | label из meta |

Legacy-mapping `IMetricId → display-key` живёт в [vitalsMonitor.tsx — `LEGACY_LABEL`](packages/web/profiler/src/providers/vitalsMonitor.tsx). Уйдёт когда Phase 2c приземлится.

`getRating(id, value)` — lookup-table по `IBuiltinMetricId` (`THRESHOLDS` в [core/ratings.ts](packages/web/profiler/src/core/ratings.ts)), `HIGHER_IS_BETTER` flag для fps. Возвращает `'info'` для unknown id / string value.

## Lifecycle и cleanup

Provider использует `onMount` (с Phase 2a, до этого был `createEffect` без deps). При unmount:
- subscribe bus → display-projection отписывается (`onCleanup`)
- 5 collectors возвращают cleanup-функции — все вызываются
- внутри `networkCollector`: и `setTimeout`, и `PerformanceObserver.disconnect()` — оба чистятся (раньше timeout утекал — теперь нет)
- web-vitals callback gate-флаг `disposed` — после unmount поздние per-change прилёты молча игнорируются (web-vitals 5.x не даёт unsubscribe)
- RAF-pending — `cancelAnimationFrame` в `onCleanup`

## Dashboard

`<Dashboard metrics={Record<string, number>} />`. Inline-стили:
- `position: fixed; top: 15px; right: 15px;`
- `pointer-events: none` — нельзя кликать, перетащить, свернуть
- `z-index: 10000`, hardcoded цвета (`#10b981` / `#f59e0b` / `#ef4444` / `#3498db`)
- `min-width: 260px`

`getRating(key, val).color` определяет цвет числа; `getRating(...).label` — подпись (`'GOOD'`/`'NEEDS_IMPROVEMENT'`/`'POOR'`/`'INFO'`). `isFloat` определяется через `.includes('CLS' | 'Load' | 'Bundle')` — формат `toFixed(2)` vs `toFixed(0)`.

## Gotchas

### Закрыто в Phase 2a (2026-05-18)
- ✅ **`MetricId` теперь типизированный union.** `getRating` — lookup table по `IBuiltinMetricId`, не `.includes()`. Custom-метрики живут под `'custom.${name}'`.
- ✅ **Строковые custom-метрики сохраняются.** Bus принимает `value: number | string`, dedup-guard по `===` отлично работает.
- ✅ **`createEffect` → `onMount`** в orchestrator-провайдере.
- ✅ **`setTimeout` cleanup** — `networkCollector` чистит и timeout, и observer.
- ✅ **SSR-guards** — все collectors проверяют `isBrowser`/`hasPO`/`supportsEntryType`. Provider тоже не упадёт: collectors сами no-op'нут.
- ✅ **Memory polling dedup** — `bus.write` сравнивает по `===`, при стабильном значении listeners НЕ вызываются → нет re-render'ов.

### Закрыто в Phase 2b (2026-05-18)
- ✅ **Public read+write API.** `useProfiler()` (throws), `useProfilerSafe()`, `usePerf()` — `mark/measure/count/gauge/time`.
- ✅ **Reporters'ы** — `console` / `beacon` (sendBeacon on `visibilitychange='hidden'`/`pagehide`) / `callback`. Раздельный канал от UI.
- ✅ **8 новых коллекторов** — longTasks, loaf, eventTiming, fps, domStats, errors, userTiming, networkDeep (opt-in).
- ✅ **`web-vitals` opt-out** — `webVitalsCollector({ reportAllChanges: false })` даёт final-only. Live vs analytics — теперь раздельные каналы.
- ✅ **Collector cleanup в `try/catch`** — один битый cleanup не валит дерево при unmount.

### Закрыто в Phase 2c (2026-05-18)
- ✅ **Dashboard переписан.** `widget/dashboard.tsx` через kobalte Tabs (Vitals / Runtime / Network / Errors / Custom). Draggable + collapsible window с localStorage persistence (`capsule:profiler:dashboard` хранит `{x,y,collapsed,tab}`). Sparklines из ring-buffer истории. `pointer-events` НЕ disabled — можно кликать, drag за заголовок.
- ✅ **`BaseProviders.showDashboard`** — пробрасывается до `VitalsMonitoringProvider` → `ProfilerProvider`. Default true когда `vitals=true`. Тонкая настройка: `<BaseProviders vitals showDashboard={false}>` или прямой `<ProfilerProvider>`.
- ✅ **Legacy Dashboard больше не автоматический.** `VitalsMonitoringProvider` рендерит новый Dashboard через `ProfilerProvider.showDashboard`. Старый `components/dashboard.tsx` остаётся доступным через subpath `./components` для manual rendering.

### Остаётся (Phase 3+ / 0.2.x)
- **`dom.listeners` не реализован** — требует monkey-patch `addEventListener` (как `networkDeep`). Рассмотреть отдельной задачей.
- **`networkDeep` — monkey-patch globals**, потенциальный конфликт с другими SDK что патчат fetch/XHR (Sentry, Datadog, GTM). Opt-in. Задокументирован в user-doc.
- **Никакой связи с HCA-слоями.** Profiler не подключён к `data-meta`, нет `services.profiler` инжекта в Feature. Сделать отдельной задачей через web-core (расширить `createLogicWrapper` чтобы инжектил `useProfilerSafe()`).
- **Legacy `components/dashboard.tsx` + `utils.ts`** — удалить в 0.2.x. Сейчас оставлены для zero-breaking compat.
- **`MetricRow` использует `useProfiler()` напрямую** — каждая row подписана на `bus.read`/`bus.history` через `createMemo`/`bus.subscribe` (Solid коллапсирует реакции). Если станет тяжело при высокочастотных метриках — мемоизировать через `createResource` или вынести в shared store. Пока ок.
- **Sparkline без axis-labels** — minimalist, только полилиния. Кнопка zoom/timewindow — на будущее.
- **`ProfilerWindow` drag clamp'ает на viewport-resize**, но не на initial mount если localStorage хранит `x/y` за пределами текущего viewport. Edge-case, минорно.

## Roadmap

Пакет под мою ownership ([[../../memory/project_profiler_ownership]]).

**Фаза 1 ✅ (2026-05-18).** Доки + AI-anchor.

**Фаза 2a ✅ (2026-05-18).** Foundations: schema + bus + ringBuffer + ratings + 5 collectors (webVitals/memory/network/navigation/connection). Legacy provider — thin orchestrator над bus'ом.

**Фаза 2b ✅ (2026-05-18).** Collectors expansion + public API:
- 8 новых collectors: `longTasks`, `loaf`, `eventTiming`, `fps`, `domStats`, `errors`, `userTiming`, `networkDeep` (opt-in).
- 3 reporters: `console` / `beacon` / `callback`.
- `ProfilerProvider` (collectors `'all'`/`'all-except-deep'`/`'legacy'`/`ICollector[]`, reporters, optional bus injection, historySize). Default — `'all-except-deep'`.
- `useProfiler()` / `useProfilerSafe()` + `usePerf()` / `createPerfApi()` через subpath `./api`.
- `VitalsMonitoringProvider` стал thin deprecated shim над `<ProfilerProvider collectors="legacy">` + `LegacyVitalsBridge`.
- Move `_ssr.ts` → `core/env.ts` (shared между collectors и reporters).
- 29 vitest-тестов: bus(9)/ratings(5)/ringBuffer(4)/perfApi(6)/reporters(5) — все зелёные.

**Фаза 2c ✅ (2026-05-18).** Dashboard rewrite:
- `widget/dashboard.tsx` — kobalte Tabs (Vitals / Runtime / Network / Errors / Custom).
- `widget/primitives/window.tsx` — draggable + collapsible с localStorage persistence (`capsule:profiler:dashboard`).
- `widget/primitives/sparkline.tsx` — SVG-полилиния из ring-buffer истории.
- `widget/primitives/row.tsx` — реактивная строка метрики (label + sparkline + value + rating-color).
- `widget/panels/{vitals,runtime,network,errors,custom}.tsx` — 5 панелей. CustomPanel реактивно подписывается на bus и фильтрует `custom.*`.
- `ProfilerProvider.showDashboard` prop — рендерит `<ProfilerDashboard />` как sibling детей.
- `BaseProviders.showDashboard` prop (web-core) — пробрасывается до `VitalsMonitoringProvider`.
- `VitalsMonitoringProvider` теперь use `ProfilerProvider showDashboard` — больше не рендерит legacy Dashboard. LegacyVitalsBridge ужал до простого `IMonitoringContextType` proxy.
- `@kobalte/core` добавлен в peerDependencies.

**Phase 3 / 0.2.x — потенциально.** Удалить deprecated (`components/dashboard.tsx`, `utils.ts`, `VitalsMonitoringProvider`); HCA-интеграция (`services.profiler` инжект); `dom.listeners` monkey-patch.

## Чек-листы

### Когда правишь профайлер
- [ ] Если меняешь публичный API провайдера/контекста — обнови `IMonitoringContextType` в [providers/vitalsMonitor.tsx](packages/web/profiler/src/providers/vitalsMonitor.tsx) **и** реэкспорт в [providers/index.ts](packages/web/profiler/src/providers/index.ts) **и** [README.md](packages/web/profiler/README.md) **и** [[../09-packages/profiler|user-doc]] **и** этот anchor.
- [ ] Если добавляешь метрику — проверь что `getRating` её распознаёт (или добавь ветку). Помни: матчинг через `.includes()`, конфликты подстрок реальны.
- [ ] Если касаешься `BaseProviders.vitals` в [packages/web/core/src/providers/base.tsx](packages/web/core/src/providers/base.tsx) — обнови [[core]] anchor (если появится) и user-doc.
- [ ] Любой `performance.*` / `navigator.connection` / `PerformanceObserver` доступ — оберни в `typeof window !== 'undefined' && '...' in window`. SSR.
- [ ] Тип ключа метрики не должен быть просто `string` — заведи `MetricId` union (Фаза 2).

### Когда пишешь user-doc
- [ ] AI-anchor (этот файл) — единственный источник правды по контрактам. User-doc ссылается сюда.
- [ ] Не выдумывай API. Пример кода — копируй из тестов / актуального кода, не пиши «по аналогии».
- [ ] Покажи и канонический путь (`BaseProviders vitals`), и прямой (`VitalsMonitoringProvider`).
- [ ] Раздел «Known issues» — обязателен пока пакет в активной доработке.

## Связанное

- [[core|@capsuletech/web-core]] — `BaseProviders.vitals` подключает провайдер.
- [[../09-packages/profiler|profiler]] — user-doc.
- [[../../memory/project_profiler_ownership]] — текущий бэклог и owner.
