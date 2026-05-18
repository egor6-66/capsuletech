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

`@capsuletech/web-profiler` — performance-мониторинг для Solid-приложений. Сейчас собирает Web Vitals (CLS / FCP / INP / LCP / TTFB через `web-vitals` 5.x), memory (`performance.memory`, Chromium-only), network/bundle (`PerformanceObserver` + `getEntriesByType('resource')`), connection (`navigator.connection`), DOM ready (`PerformanceNavigationTiming`). Выдаёт Solid Context + опциональный визуальный Dashboard-оверлей. Подключается приложением через `<VitalsMonitoringProvider>` напрямую либо через `<BaseProviders vitals>` из `@capsuletech/web-core`.

Контракт «снаружи»: один провайдер оборачивает app → метрики сами начинают капать → Dashboard рисует overlay. Никаких хуков для чтения метрик из контекста потребитель пока **не имеет** (см. [[#Gotchas]]).

## Где что лежит

После Phase 2a (2026-05-18) внутри пакета — collector-pattern + типизированный `MetricsBus`. Снаружи API не изменилось: `VitalsMonitoringProvider` теперь thin orchestrator над bus'ом, сохраняет legacy Context-API.

| Файл | Что |
|---|---|
| `packages/web/profiler/src/index.ts` | Barrel — `./components` + `./providers` + `./core` + `./collectors` + type `MetricRating`. |
| **`packages/web/profiler/src/core/schema.ts`** | Типы: `IMetricId` (union `IBuiltinMetricId | 'custom.${string}'`), `IMetricKind`, `IMetricMeta`, `IMetricSample`, `IRating`, `IMetricsBus`, `ICollector`. **Источник правды для контракта метрик.** |
| **`packages/web/profiler/src/core/bus.ts`** | `createMetricsBus({ historySize? })` — Map-based bus с per-metric ring-buffer history, default-meta table по `id`, dedup-on-equal-value, subscribers. |
| **`packages/web/profiler/src/core/ringBuffer.ts`** | `createRingBuffer<T>(capacity)` — `{ push, toArray, last, length, capacity }`. |
| **`packages/web/profiler/src/core/ratings.ts`** | `getRating(id, value)` — таблица порогов по `IBuiltinMetricId`. Знает inverse-rating для `fps` (higher-is-better). Возвращает `'info'` для unknown/string. |
| **`packages/web/profiler/src/collectors/_ssr.ts`** | `isBrowser`, `hasPO()`, `supportsEntryType(type)`. |
| **`packages/web/profiler/src/collectors/webVitals.ts`** | `webVitalsCollector({ reportAllChanges? })`. Маппит `CLS/FCP/LCP/INP/TTFB` → `cls/fcp/lcp/inp/ttfb`. Disposed-flag gate. |
| **`packages/web/profiler/src/collectors/memory.ts`** | `memoryCollector({ intervalMs? = 2000 })`. SSR + Chromium-only guard. |
| **`packages/web/profiler/src/collectors/network.ts`** | `networkCollector({ secondPassDelayMs? = 2000 })` — initial pass + delayed pass + `PerformanceObserver('resource')`. Чистит и timeout, и observer. |
| **`packages/web/profiler/src/collectors/navigation.ts`** | One-shot `dom.ready` из `getEntriesByType('navigation')`. |
| **`packages/web/profiler/src/collectors/connection.ts`** | `connectionCollector()` — `navigator.connection.effectiveType` + listener на `change`. |
| `packages/web/profiler/src/providers/vitalsMonitor.tsx` | Orchestrator: создаёт `bus`, инициализирует 5 коллекторов, subscribe → проецирует на legacy `Record<string, number\|string>` для старого Dashboard. Сохраняет legacy Context-API (`IMonitoringContextType` с `updateComponentMetric` + `bus` под `@internal`). |
| `packages/web/profiler/src/providers/index.ts` | Реэкспорт `VitalsMonitoringProvider`, `useVitalsContext`, `VitalsMonitoringContext`, `IMonitoringContextType`, `VitalsMonitoringProviderProps`. |
| `packages/web/profiler/src/components/dashboard.tsx` | Старый overlay. Принимает `Record<string, number\|string>` (раньше — только number). `pointer-events: none`, hardcoded colors — будет переписан в Phase 2c. |
| `packages/web/profiler/src/utils.ts` | `setupWebVitalsTracking`, `getNetworkMetrics`, `getMemoryMetrics`, `getConnectionType`, `getDomReadyTime`, `getRating(name, value)`, `MetricRating` — все помечены `@deprecated` / `@internal`. Используются только legacy Dashboard. |
| `packages/web/profiler/src/__tests__/` | `bus.test.ts` (9 tests), `ratings.test.ts` (5), `ringBuffer.test.ts` (4). Всего 18 — `pnpm test` зелёный. |
| `packages/web/profiler/vite.config.mts` | `libConfig` с 5 entry: `index`, `providers`, `components`, `core`, `collectors`. |
| `packages/web/profiler/vitest.config.ts` | `environment: 'node'`, по образцу web-state. |
| `packages/web/profiler/package.json` | Subpath exports: `.`, `./providers`, `./components`, `./core`, `./collectors`. Dep: `web-vitals ^5.2.0`. PeerDep: `solid-js ^1.9.0`. |
| `packages/web/core/src/providers/base.tsx` | `BaseProviders.vitals?: boolean` — без изменений. `VitalsMonitoringProvider` внутри теперь Phase-2a-shim, но контракт снаружи прежний. |

## Точки входа

```jsonc
{
  "exports": {
    ".":             ".../dist/index.mjs",          // всё сразу
    "./providers":   ".../dist/providers.mjs",      // VitalsMonitoringProvider/Context (legacy)
    "./components":  ".../dist/components.mjs",     // Dashboard (legacy overlay)
    "./core":        ".../dist/core.mjs",           // createMetricsBus, getRating, createRingBuffer, типы
    "./collectors":  ".../dist/collectors.mjs"      // webVitals/memory/network/navigation/connection
  }
}
```

В Capsule-приложениях канонический путь — `BaseProviders vitals` из [[core|@capsuletech/web-core]]. Прямой импорт `@capsuletech/web-profiler/providers` используется только если нужен кастомный `showDashboard={false}` (через `BaseProviders` пока не пробрасывается).

## Контракт API

### Public (legacy, Phase 2a stable)

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

С Phase 2a — типизированный `IMetricId`. Все 5 первых collectors пишут в:

| `IMetricId` | Источник | Update-частота | Legacy display-key (для старого Dashboard) |
|---|---|---|---|
| `'cls'` | `web-vitals.onCLS({ reportAllChanges })` | per-change | `'CLS'` |
| `'lcp'` | `web-vitals.onLCP({ reportAllChanges })` | per-change | `'LCP'` |
| `'fcp'` | `web-vitals.onFCP({ reportAllChanges })` | per-change | `'FCP'` |
| `'inp'` | `web-vitals.onINP({ reportAllChanges })` | per-change | `'INP'` |
| `'ttfb'` | `web-vitals.onTTFB` | финальное | `'TTFB'` |
| `'memory'` | `(performance as any).memory.usedJSHeapSize` (MB) | `setInterval(2000)` | `'💻 Memory Usage'` |
| `'network.transfer'` | `getEntriesByType('resource')` → `transferSize` суммой (MB) | initial + 2s + PO | `'📡 Network Load'` |
| `'network.decoded'` | `decodedBodySize \|\| encodedBodySize \|\| transferSize` суммой (MB) | same | `'📦 Total Bundle'` |
| `'dom.ready'` | `getEntriesByType('navigation')[0].domContentLoadedEventEnd` (ms) | one-shot | `'⏱️ Dom Ready'` |
| `'connection'` | `navigator.connection.effectiveType` ('4g'/...) | initial + `'change'` listener | `'🌐 Network'` |

Legacy-mapping `IMetricId → display-key` живёт в [vitalsMonitor.tsx — `LEGACY_LABEL`](packages/web/profiler/src/providers/vitalsMonitor.tsx). Когда Phase 2c (Dashboard rewrite) приземлится, legacy-mapping уйдёт.

`getRating(id, value)` с Phase 2a — lookup по `IBuiltinMetricId` (`THRESHOLDS` table в [core/ratings.ts](packages/web/profiler/src/core/ratings.ts)), `HIGHER_IS_BETTER[id]` flag для fps. Не `.includes()`, не строки.

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

### Остаются (вынесено в Phase 2b/2c)
- **`useVitalsContext()` может вернуть `undefined`.** Нет throw-guard'а. Phase 2b добавит `useProfiler()` с throw-вариантом.
- **`useVitalsContext().bus` — `@internal`.** Прочитать метрики из user-кода через стабильное API пока нельзя — ждёт `useProfiler()` в Phase 2b.
- **`BaseProviders.vitals` — boolean без проброса.** `showDashboard` хардкодом `true`. Тонкая настройка — только прямой импорт `VitalsMonitoringProvider`. Останется до Phase 2c.
- **Web Vitals `reportAllChanges: true`** по умолчанию. Подходит для live-dashboard, плохо для analytics-reporter. `webVitalsCollector({ reportAllChanges: false })` доступен, но раздельных каналов (live vs final) пока нет. Phase 2b — reporters'ы.
- **Никакой связи с HCA-слоями.** Profiler не подключён к `data-meta`, нет `usePerf` для Feature-сервиса. Phase 2b — `services.profiler` инжект.
- **Dashboard всё ещё legacy** — `pointer-events: none`, inline-стили, hardcoded colors. Принимает `Record<string, number|string>` (расширено в Phase 2a), но визуально не изменился. Phase 2c — переписать на draggable/tabbed.

## Roadmap

Пакет под мою ownership ([[../../memory/project_profiler_ownership]]).

**Фаза 1 ✅ (2026-05-18).** Доки + AI-anchor.

**Фаза 2a ✅ (2026-05-18).** Foundations:
- `core/schema.ts` — типизированный контракт.
- `core/bus.ts` — `createMetricsBus` (Map + ring-buffer history + dedup + subscribers).
- `core/ratings.ts` — lookup-table.
- 5 collectors: `webVitals`, `memory`, `network`, `navigation`, `connection`.
- Legacy provider теперь thin orchestrator над bus'ом, сохраняет старый Context-API через shim.
- Subpath exports: `./core`, `./collectors`. 18 vitest-тестов (`bus`/`ratings`/`ringBuffer`) — зелёные.

**Фаза 2b ⏳ (next).** Collectors expansion + public API:
- Collectors: `longTasks`, `loaf`, `eventTiming`, `fps`, `domStats`, `errors`, `userTiming`, `networkDeep` (last — opt-in, monkey-patch).
- `ProfilerProvider` — новый Provider с `collectors`/`reporters`/`showDashboard` props. По умолчанию — все collectors кроме networkDeep.
- `reporters/{console,beacon,callback}` — каждый `init(bus, opts) => cleanup`.
- `api/useProfiler` — public read+write API.
- `api/usePerf` — `profiler.count/gauge/time/mark/measure`.
- `VitalsMonitoringProvider` остаётся как deprecated shim над `ProfilerProvider`.

**Фаза 2c ⏳.** Dashboard rewrite:
- `widget/dashboard.tsx` — draggable / collapsible / tabbed.
- `widget/panels/{vitals,runtime,network,errors,custom}.tsx`.
- `widget/primitives/{window,tabs,sparkline,gauge,bar}.tsx` — интеграция с [[style|@capsuletech/web-style]].
- Persistence (позиция/свёрнутость) в localStorage.
- `BaseProviders.vitals` — оставляем boolean; `showDashboard` proxy — отдельная мини-задача после 2c.

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
