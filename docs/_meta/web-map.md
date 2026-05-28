---
tags: [meta, web-map, ai-context]
status: documented
type: ai-anchor
audience: claude
---

# @capsuletech/web-map — AI context anchor

> Шпаргалка для Claude-инстансов. Без воды.

## TL;DR

Низкоуровневый Solid-wrapper над `maplibre-gl`. Монтирует карту на `<div>`, управляет lifecycle, прокидывает instance через Solid Context. Прямая интеграция с `maplibre-gl` (без solid-map-gl, который течёт ~5 MB/цикл из-за orphaned matchMedia listener, owner-less effects и неполного onCleanup).

## Где что лежит

| Файл | Что |
|---|---|
| `packages/web/map/src/MapView.tsx` | Корневой компонент. ResizeObserver-gate, onMount/onCleanup lifecycle, reactive effects для center/zoom/bearing/pitch/style, theme switching |
| `packages/web/map/src/context.ts` | `MapContext` + `useMap()` hook |
| `packages/web/map/src/styles/index.ts` | `POSITRON` + `DARK_MATTER` экспорты |
| `packages/web/map/src/index.ts` | Barrel: `MapView`, `useMap`, `MapContext`, типы, стили |
| `packages/web/map/src/__tests__/map-view.test.tsx` | ResizeObserver gate + memory cleanup tests (14 тестов) |
| `packages/web/map/src/__tests__/props-passthrough.test.tsx` | Constructor options + reactive sync + useMap guard (19 тестов) |

## Public API

```ts
import { MapView, useMap, MapContext, IMapViewProps, IViewport, IMapContext, POSITRON, DARK_MATTER } from '@capsuletech/web-map';
import 'maplibre-gl/dist/maplibre-gl.css'; // обязателен у consumer'а

// MapView — основной компонент (IMapViewProps):
//   style?: string | StyleSpecification           — light стиль (default: POSITRON)
//   darkStyle?: string | StyleSpecification       — dark стиль (default: DARK_MATTER)
//   attributionControl?: boolean                  — default false
//   center?: LngLatLike                           — реактивный (jump)
//   zoom?: number                                 — реактивный (jump)
//   bearing?: number                              — реактивный (jump)
//   pitch?: number                                — реактивный (jump, 3D)
//   minZoom? / maxZoom? / maxBounds?              — только init, не реактивны
//   class? / classList? / style_container?        — CSS контейнера
//   onLoad?(map): void                            — один раз после 'load'
//   onViewportChange?(viewport: IViewport): void  — на moveend
//   children?: JSX.Element                        — дочерние слои через useMap()

// useMap() — Solid hook. Внутри <MapView> возвращает { map: Accessor<MaplibreMap | undefined> }.
//   undefined до первого 'load' event.
```

## Архитектурные решения

### Memory safety (почему нет solid-map-gl)

`solid-map-gl@1.13.0` имел три источника утечки:
1. `matchMedia('prefers-color-scheme: dark').addEventListener('change', ...)` без `removeEventListener` → +1 listener/mount.
2. `createEffect` внутри async `map.once('load', ...)` callback → owner-less effects, никогда не disposed.
3. Неполный `onCleanup` — только `resizeObserver.disconnect()` + `mutationObserver.disconnect()`.

Текущая реализация (`MapView.tsx`) устраняет все три:
- `matchMedia` listener снимается в `onCleanup` через `removeEventListener`.
- Нет `createEffect` внутри async callbacks — все effects на верхнем уровне компонента.
- `onCleanup` явно вызывает `instance.remove()`, `observer.disconnect()`, `mq.removeEventListener(...)`, `mutationObserver.disconnect()`.

### ResizeObserver-gate

`new maplibregl.Map()` вызывается ТОЛЬКО после первого ResizeObserver entry с `contentRect.width > 0 && height > 0`. Защищает от `"Invalid LngLat: (NaN, NaN)"` — maplibre вызывает `jumpTo` в конструкторе; при нулевом container размере projection matrix ещё не готова.

Дополнительно: `init(clientWidth, clientHeight)` вызывается сразу в onMount как optimistic path (если container уже имеет размер).

### NaN guard: center/zoom/pitch/bearing/maxBounds — не в конструктор

Эти props передаются через setters ПОСЛЕ `'load'` event. В конструктор — только `style`, `attributionControl`, `minZoom`, `maxZoom`.

### Theme switching

Два источника тёмной темы:
- `matchMedia('prefers-color-scheme: dark')` — media query.
- `MutationObserver` на `document.body` + `attributeFilter: ['class']` — для capsule `DarkModeToggle` который добавляет класс `.dark` на body.

При изменении любого из них — `m.setStyle(resolveStyle())`. setStyle — тяжёлая операция (пересоздаёт layers/sources).

### Reactive prop sync

| Prop | Метод | Когда |
|---|---|---|
| `style` | `m.setStyle(s)` | `createEffect` |
| `center` | `m.setCenter(c)` | `createEffect` |
| `zoom` | `m.setZoom(z)` | `createEffect` |
| `bearing` | `m.setBearing(b)` | `createEffect` |
| `pitch` | `m.setPitch(p)` | `createEffect` |

Все effects guard'ятся через `if (!map() || prop === undefined) return`.

## Gotchas для owner-агента

1. **`maplibre-gl.css` не auto-import** — consumer сам импортит.
2. **`attributionControl: true` → `{}`** — maplibre-gl 4 тип: `false | AttributionControlOptions`. `true` не принимается. Наш boolean `true` маппится на `{}`.
3. **`setStyle` стирает user layers** — Iter 1 (layers API) должен re-add через `'styledata'` event.
4. **`onLoad` = один раз** — после `setStyle` используй `'styledata'`.
5. **maxBounds/minZoom/maxZoom не реактивны** — только в constructor options.
6. **Тест ResizeObserver mock** — `vi.stubGlobal('ResizeObserver', vi.fn(function(...)))`. `function` keyword обязателен — arrow functions не могут быть конструкторами (`new ResizeObserver(...)`).

## Test strategy

Все тесты в jsdom + `vi.mock('maplibre-gl', ...)` + `vi.stubGlobal('ResizeObserver', ...)` + `vi.stubGlobal('matchMedia', ...)`. WebGL недоступен в jsdom — mock перехватывает конструктор `Map` и все его методы.

Запуск: `pnpm --filter @capsuletech/web-map test`.
