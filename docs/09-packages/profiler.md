---
tags: [09-packages, profiler]
status: documented
type: guide
---

# 📊 @capsuletech/web-profiler

> [!info]
> Performance-мониторинг для Solid-приложений: Web Vitals (CLS / FCP / INP / LCP / TTFB) + memory + network + connection-type + DOM-ready + визуальный Dashboard. Lightweight, оборачивает приложение одним провайдером. Под активной доработкой — см. [[#Known issues]] и [[#Roadmap]].

> [!ai]
> Для агентов и Claude-инстансов есть отдельная шпаргалка с контрактами и gotchas — [[../_meta/profiler|docs/_meta/profiler.md]]. Если правишь пакет — читай её.

## Структура

```
packages/web/profiler/src/
├── index.ts                 barrel: ./components + ./providers + ./utils + type MetricRating
├── providers/
│   ├── index.ts             VitalsMonitoringProvider / useVitalsContext / VitalsMonitoringContext + типы
│   └── vitalsMonitor.tsx    Solid Context-провайдер на createSignal, RAF-батчинг апдейтов
├── components/
│   ├── index.ts             Dashboard
│   └── dashboard.tsx        position:fixed overlay, inline-стили, pointer-events:none
└── utils.ts                 web-vitals setup + memory / network / connection / dom-ready helpers + getRating
```

## Точки входа

```jsonc
{
  "exports": {
    ".":             ".../dist/index.mjs",
    "./providers":   ".../dist/providers.mjs",
    "./components":  ".../dist/components.mjs"
  }
}
```

## Использование

### Канонический путь — через `BaseProviders` из web-core

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

`vitals?: boolean` (default — `false`, чтобы прод-бандлы apps/<app> не тянули overhead профайлера без необходимости). При `true` — оборачивает дерево в `VitalsMonitoringProvider` и показывает Dashboard.

> [!note]
> `BaseProviders` пока не пробрасывает `showDashboard` — Dashboard всегда `on` при `vitals={true}`. Если нужно метрики **без** UI — используй прямой импорт ниже.

### Прямой путь — для тонкой настройки

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

`VitalsMonitoringProviderProps`:
- `children: JSX.Element`
- `showDashboard?: boolean` — default `true`

### Доступ к контексту

```tsx
import { useVitalsContext } from '@capsuletech/web-profiler/providers';

function Component() {
  const ctx = useVitalsContext();
  ctx?.updateComponentMetric('🧩 My Metric', 42);
}
```

`IMonitoringContextType`:
- `updateComponentMetric(name: string, value: number | string): void` — пишет произвольную метрику в дашборд.

> [!warning]
> **Read-API пока нет.** `useVitalsContext()` отдаёт **только** `updateComponentMetric`. Прочитать накопленные значения метрик из пользовательского кода в текущей версии нельзя. См. [[#Known issues]] и [[#Roadmap]].

## Какие метрики собираются

| Метрика | Источник | Update-частота |
|---|---|---|
| **CLS** — Cumulative Layout Shift | `web-vitals.onCLS` (reportAllChanges) | per-change |
| **LCP** — Largest Contentful Paint | `web-vitals.onLCP` (reportAllChanges) | per-change |
| **FCP** — First Contentful Paint | `web-vitals.onFCP` (reportAllChanges) | per-change |
| **INP** — Interaction to Next Paint | `web-vitals.onINP` (reportAllChanges) | per-change |
| **TTFB** — Time to First Byte | `web-vitals.onTTFB` | финальное |
| **📡 Network Load** — суммарный transferSize ресурсов, MB | `PerformanceObserver('resource')` | initial + 2s + on new resource |
| **📦 Total Bundle** — суммарный decoded/encoded body, MB | same | same |
| **💻 Memory Usage** — used JS heap, MB | `performance.memory` (Chromium only) | `setInterval(2000)` |
| **⏱️ Dom Ready** — `domContentLoadedEventEnd`, ms | `performance.getEntriesByType('navigation')` | one-shot at mount |
| **🌐 Network** — `effectiveType` ('4g'/'3g'/...) | `navigator.connection` | one-shot at mount |

Каждая числовая метрика получает рейтинг через `getRating(name, value)`:

| Label | Значение |
|---|---|
| `'GOOD'` | зелёный (`#10b981`) |
| `'NEEDS_IMPROVEMENT'` | жёлтый (`#f59e0b`) |
| `'POOR'` | красный (`#ef4444`) |
| `'INFO'` | синий (`#3498db`) — для нечисловых / нераспознанных |

Пороги — стандартные Web Vitals (`web.dev/vitals`), для memory/network — захардкожены (см. [utils.ts:9](../../packages/web/profiler/src/utils.ts:9)).

## Dashboard

`<Dashboard metrics={Record<string, number>} />` — фиксированный overlay справа сверху. Показывается, если в `metrics` хоть один ключ.

Текущие ограничения:
- `position: fixed; top: 15px; right: 15px;` — позиция не настраивается
- `pointer-events: none` — нельзя кликать / перетащить / свернуть
- inline-стили, без интеграции с [[style|@capsuletech/web-style]]
- `z-index: 10000`

Если нужен полностью свой UI — импортируй и используй `useVitalsContext().updateComponentMetric(...)` чтобы писать туда метрики, либо подключай провайдер с `showDashboard={false}` и пиши собственный (read-API ограничено — см. ниже).

## SSR

Пакет **не SSR-safe** в текущей версии. `performance.memory`, `navigator.connection`, `PerformanceObserver`, `performance.getEntriesByType` вызываются без `typeof window` guard'ов. При SSR/prerender провайдер упадёт. Подключай только в client-only ветке (`Show when={isClient}` или динамический import).

## Known issues

Зафиксировано в [[../_meta/profiler#Gotchas]]. Кратко — что бьёт в глаза:

1. **Ключи метрик — display-строки с эмодзи** (`'📡 Network Load'`), а `getRating` матчит через `.includes()`. Любая локализация / опечатка молчаливо ломает рейтинг. Нет `MetricId`.
2. **`updateComponentMetric(name, value: number | string)` — `string` не сохраняется** в storage, только проходит в Dashboard через текущий апдейт (и там же отшивается обратно через `typeof val === 'number'`). Мёртвая ветка для строковых пользовательских метрик.
3. **`useVitalsContext()` возвращает только `updateComponentMetric`** — никакого read-API.
4. **SSR небезопасно** — см. выше.
5. **`BaseProviders.vitals`** — boolean, без проброса `showDashboard`. Тонкая настройка только через прямой импорт.
6. **Web Vitals идут с `reportAllChanges: true`** — годится для live-dashboard, плохо для analytics-репортов (промежуточные значения).
7. **Memory polling `setInterval(2000)`** без quiescence — постоянный re-render даже если значение стабильно.

## Roadmap

Под моей ownership (зафиксировано 2026-05-18). План согласован:

- **Фаза 1 (текущая):** документация. Этот файл + [[../_meta/profiler|AI-anchor]] + синхронизация README. Код не трогаем.
- **Фаза 2 (refactor):** перепиcать на collector pattern — типизированная схема метрик, MetricsBus (Solid store, history через ring-buffer), reporters (console / sendBeacon / callback). Dashboard — draggable / collapsible / tabbed (Vitals / Runtime / Network / Errors / Custom).
- **Фаза 3 (collectors):** Long Tasks + LoAF + Event Timing, FPS + DOM stats + errors, User Timing + публичное `profiler.count/gauge/time/mark/measure`, Network deep (monkey-patch fetch/XHR/WS, opt-in).

Подробности — [[../_meta/profiler#Roadmap]].

## Связанное

- [[core|@capsuletech/web-core]] — `BaseProviders.vitals` подключает провайдер.
- [[../_meta/profiler|profiler — AI anchor]] — для агентов: контракты, gotchas, чек-листы.
