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

Child components (`Source`, `Layer`, `Terrain`, `Sky`) полностью реактивны и автоматически пере-применяют себя после `map.setStyle()` через `'styledata'` event.

## Где что лежит

| Файл | Что |
|---|---|
| `packages/web/map/src/MapView.tsx` | Корневой компонент. ResizeObserver-gate, onMount/onCleanup lifecycle, reactive effects, unified `isDark` signal для theme switching |
| `packages/web/map/src/context.ts` | `MapContext` + `useMap()` hook |
| `packages/web/map/src/styles/index.ts` | `POSITRON` + `DARK_MATTER` экспорты (URL strings, OpenFreeMap) |
| `packages/web/map/src/Source.tsx` | `<Source>` — declarative addSource/removeSource, reactive GeoJSON setData, non-GeoJSON remove+add, styledata re-add |
| `packages/web/map/src/Layer.tsx` | `<Layer>` — declarative addLayer/removeLayer, reactive paint/layout/filter/zoom-range, styledata re-add |
| `packages/web/map/src/Terrain.tsx` | `<Terrain>` — setTerrain/setTerrain(null), reactive source+exaggeration, styledata re-apply |
| `packages/web/map/src/Sky.tsx` | `<Sky>` — setSky/setSky({}), reactive spec, styledata re-apply |
| `packages/web/map/src/TerrainPreset.tsx` | `<TerrainPreset>` — Source+Terrain bundle, AWS Terrarium |
| `packages/web/map/src/BuildingsPreset.tsx` | `<BuildingsPreset>` — fill-extrusion layer, OpenMapTiles source |
| `packages/web/map/src/Marker.tsx` | `<Marker<T>>` — DOM pin marker, reactive lng/lat/anchor/data, onClick with typed data |
| `packages/web/map/src/index.ts` | Barrel: все экспорты |
| `packages/web/map/src/__tests__/map-view.test.tsx` | ResizeObserver gate + memory cleanup tests (14 тестов) |
| `packages/web/map/src/__tests__/props-passthrough.test.tsx` | Constructor options + reactive sync + useMap guard (19 тестов) |
| `packages/web/map/src/__tests__/theme-switching.test.tsx` | Unified isDark signal, init dark, cycles (16 тестов) |
| `packages/web/map/src/__tests__/child-components.test.tsx` | Source/Layer/Terrain/Sky lifecycle + styledata listener (22 тестов) |
| `packages/web/map/src/__tests__/presets.test.tsx` | TerrainPreset + BuildingsPreset (13 тестов) |
| `packages/web/map/src/__tests__/theme-preservation.test.tsx` | Styledata re-add for all 4 components (13 тестов) |
| `packages/web/map/src/__tests__/reactive-source.test.tsx` | GeoJSON setData + non-GeoJSON remove+add (7 тестов) |
| `packages/web/map/src/__tests__/reactive-layer.test.tsx` | paint/layout/filter/zoom-range/structural (13 тестов) |
| `packages/web/map/src/__tests__/reactive-terrain.test.tsx` | exaggeration/source reactive (5 тестов) |
| `packages/web/map/src/__tests__/reactive-sky.test.tsx` | spec reactive (5 тестов) |
| `packages/web/map/src/__tests__/marker.test.tsx` | lifecycle, reactive lng/lat, anchor recreate, click handler, multiple markers (16 тестов) |

## Public API

```ts
import {
  MapView, useMap, MapContext,
  Source, Layer, Terrain, Sky,
  Marker,
  TerrainPreset, BuildingsPreset,
  IMapViewProps, IViewport, IMapContext,
  ISourceProps, ILayerProps, ITerrainProps, ISkyProps,
  IMarkerProps,
  ITerrainPresetProps, IBuildingsPresetProps,
  POSITRON, DARK_MATTER,
} from '@capsuletech/web-map';
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
//   children?: JSX.Element                        — child components: Source/Layer/Terrain/Sky/Marker/…

// useMap() — Solid hook. Внутри <MapView> возвращает { map: Accessor<MaplibreMap | undefined> }.
//   undefined до первого 'load' event.

// Child components (использовать внутри <MapView>):
//   <Source id="my-src" spec={{ type: 'geojson', data: '...' }} />
//   <Layer spec={{ id: 'my-layer', type: 'fill', source: 'my-src', paint: {...} }} beforeId="..." />
//   <Terrain source="terrain-dem" exaggeration={1.5} />
//   <Sky /> или <Sky spec={{ 'sky-color': '#199EF3', ... }} />

// Markers (Iter 2):
//   <Marker lng={30.315} lat={59.939} />
//   <Marker<IEmergencyCall> lng={call.lng} lat={call.lat} data={call}
//     onClick={(call, e) => openPanel(call)} />
//   — data typed via generic T; onClick receives (data: T, event: MouseEvent)
//   — anchor?: 'center' | 'top' | 'bottom' | ... (default 'center')
//   — NOT affected by map.setStyle() — DOM element above canvas, no styledata listener needed

// Presets:
//   <TerrainPreset exaggeration={1.5} />    — AWS Terrarium DEM, без API-ключа
//   <BuildingsPreset color="#aaa" />        — OpenMapTiles tiles (работает с POSITRON/DARK_MATTER)
```

## Реактивность child components

### Source

| Изменение | Поведение |
|---|---|
| `spec.data` (GeoJSON) | `(getSource(id) as GeoJSONSource).setData(newData)` — инкрементально |
| `spec` (non-GeoJSON) | `removeSource(id)` → `addSource(id, newSpec)` |
| `map.setStyle()` wiped source | `addSource(id, currentSpec)` после `isStyleLoaded()` = true |

Реализация: три раздельных `createEffect` — mount (с `untrack` на spec), GeoJSON-data, non-GeoJSON-spec. "First run" флаг через `createEffect<boolean>` предотвращает вызов setData/removeSource на начальный mount.

### Layer

| Изменение | Поведение |
|---|---|
| `spec.paint` | `setPaintProperty(layerId, key, value)` для каждого ключа |
| `spec.layout` | `setLayoutProperty(layerId, key, value)` для каждого ключа |
| `spec.filter` | `setFilter(layerId, filter)` — включая `undefined` для снятия |
| `spec.minzoom` / `spec.maxzoom` | `setLayerZoomRange(layerId, min, max)` |
| `spec.type`/`source`/`source-layer` (структурные) | `removeLayer` + `addLayer` (полное пересоздание) |
| `map.setStyle()` wiped layer | `addLayer(spec, beforeId)` после `isStyleLoaded()` = true |

Реализация: отдельные `createEffect` для каждой группы. Каждый guard'ит `if (!m.getLayer(layerId)) return`.

### Terrain

| Изменение | Поведение |
|---|---|
| `source` или `exaggeration` | `setTerrain({ source, exaggeration })` — идемпотентно |
| `map.setStyle()` | `setTerrain({ source, exaggeration })` после `isStyleLoaded()` = true |
| unmount | `setTerrain(null)` |

### Sky

| Изменение | Поведение |
|---|---|
| `spec` | `setSky(newSpec)` — идемпотентно |
| `spec → undefined` | `setSky(DEFAULT_SKY)` |
| `map.setStyle()` | `setSky(spec)` после `isStyleLoaded()` = true |
| unmount | `setSky({})` |

### Marker

| Изменение | Поведение |
|---|---|
| `lng` или `lat` | `marker.setLngLat([lng, lat])` — без пересоздания маркера |
| `anchor` | `marker.remove()` + `new Marker({ anchor })` + `addTo(map)` — recreate (constructor-only param) |
| `data` | нет DOM-изменений — click handler читает актуальное `props.data` в момент вызова |
| `map.setStyle()` | никаких действий — маркер DOM-элемент поверх canvas, style не стирает его |
| unmount | `el.removeEventListener('click', ...)` + `marker.remove()` |

Реализация: два `createEffect`:
1. **Lifecycle effect** — tracks `map()` + `anchor`. Читает `lng`/`lat` через `untrack` (начальная позиция). Создаёт marker, навешивает click listener, пишет `markerRef`, cleanup через `onCleanup`.
2. **Position effect** — `createEffect<boolean>` с first-run flag (как в `Source.tsx`). Tracks `lng`, `lat`. При initialized=true → `markerRef?.setLngLat([lng, lat])`.

`markerRef` — мутируемая переменная на уровне компонента, координирует два эффекта.

## Архитектурные решения

### Memory safety (почему нет solid-map-gl)

`solid-map-gl@1.13.0` имел три источника утечки:
1. `matchMedia('prefers-color-scheme: dark').addEventListener('change', ...)` без `removeEventListener` → +1 listener/mount.
2. `createEffect` внутри async `map.once('load', ...)` callback → owner-less effects, никогда не disposed.
3. Неполный `onCleanup` — только `resizeObserver.disconnect()` + `mutationObserver.disconnect()`.

Текущая реализация (`MapView.tsx`) устраняет все три:
- `matchMedia` listener более не регистрируется вообще (удалён by design — см. раздел Theme switching ниже).
- Нет `createEffect` внутри async callbacks — все effects на верхнем уровне компонента.
- `onCleanup` явно вызывает `instance.remove()`, `observer.disconnect()`, `mutationObserver.disconnect()`.

### ResizeObserver-gate

`new maplibregl.Map()` вызывается ТОЛЬКО после первого ResizeObserver entry с `contentRect.width > 0 && height > 0`. Защищает от `"Invalid LngLat: (NaN, NaN)"` — maplibre вызывает `jumpTo` в конструкторе; при нулевом container размере projection matrix ещё не готова.

Дополнительно: `init(clientWidth, clientHeight)` вызывается сразу в onMount как optimistic path (если container уже имеет размер).

### NaN guard: center/zoom/pitch/bearing/maxBounds — не в конструктор

Эти props передаются через setters ПОСЛЕ `'load'` event. В конструктор — только `style`, `attributionControl`, `minZoom`, `maxZoom`.

### Theme switching — единый reactive signal, body.dark как источник истины

Единый Solid signal + MutationObserver:

```ts
const [isDark, setIsDark] = createSignal(readDarkMode()); // init-time snapshot
```

- `MutationObserver` на `body.classList` → `setIsDark(document.body.classList.contains('dark'))`
- `createEffect(() => { m.setStyle(resolveStyle()); })` — tracks `isDark()` + `props.style` + `props.darkStyle`, единственный вызов `setStyle`.

**`prefers-color-scheme` (matchMedia) намеренно НЕ используется.** Design decision: capsule app управляет `body.dark` классом через ThemeSwitcher — это единственная точка истины. OS system preference не должна переопределять явный выбор пользователя в интерфейсе. Смешивание двух сигналов (`body.dark || matchMedia.matches`) приводит к неустранимому bug: на Windows/macOS с OS prefers-dark после переключения app'а на light map оставалась dark навсегда (`false || true = true`).

**Bug-fix (2026-05-28):** `onColorSchemeChange` функция и `mq.addEventListener/removeEventListener` удалены. MutationObserver callback теперь делает только `setIsDark(document.body.classList.contains('dark'))`.

**Результат:** нет race conditions, нет duplicate setStyle, init-time значение корректно, theme switch детерминирован.

### Style preservation — styledata event pattern

Каждый child component (`Source`, `Layer`, `Terrain`, `Sky`) регистрирует `'styledata'` listener на mount и снимает его на unmount:

```ts
const onStyleData = () => {
  if (!m.isStyleLoaded()) return;  // ждём полной загрузки стиля
  // re-apply logic — addSource / addLayer / setTerrain / setSky
};
m.on('styledata', onStyleData);
onCleanup(() => m.off('styledata', onStyleData));
```

`isStyleLoaded()` guard важен — `'styledata'` событие fires многократно (для каждого sub-resource), нужно дождаться полной загрузки.

### Reactive prop sync (MapView)

| Prop | Метод | Когда |
|---|---|---|
| `style` | `m.setStyle(s)` | `createEffect` |
| `center` | `m.setCenter(c)` | `createEffect` |
| `zoom` | `m.setZoom(z)` | `createEffect` |
| `bearing` | `m.setBearing(b)` | `createEffect` |
| `pitch` | `m.setPitch(p)` | `createEffect` |

Все effects guard'ятся через `if (!map() || prop === undefined) return`.

### Source — "first run" flag pattern

GeoJSON `setData` и non-GeoJSON `removeSource+addSource` используют `createEffect<boolean>`:

```ts
createEffect<boolean>((initialized) => {
  // ...
  if (!initialized) return true;  // initial run — skip update, just track dependencies
  // subsequent runs — apply reactive update
  return initialized;
}, false);
```

Это предотвращает вызов `setData`/`removeSource` на начальный mount (когда source ещё не добавлен через mount-effect).

## Gotchas для owner-агента

1. **`maplibre-gl.css` не auto-import** — consumer сам импортит.
2. **`attributionControl: true` → `{}`** — maplibre-gl 4 тип: `false | AttributionControlOptions`. `true` не принимается. Наш boolean `true` маппится на `{}`.
3. **`onLoad` = один раз** — после `setStyle` используй `'styledata'`. Child components делают это автоматически.
4. **maxBounds/minZoom/maxZoom не реактивны** — только в constructor options.
5. **Тест ResizeObserver/MutationObserver mock** — `vi.stubGlobal('X', vi.fn(function(...)))`. `function` keyword обязателен — arrow functions не могут быть конструкторами (`new X(...)`).
6. **jsdom MutationObserver fires async (microtask)** — в тестах используй `vi.stubGlobal('MutationObserver', ...)` чтобы контролировать когда callback вызывается синхронно.
7. **`BuildingsPreset` — рассчитан на OpenMapTiles styles** — source `"openmaptiles"` с `render_height`. OpenFreeMap POSITRON и DARK_MATTER (дефолты) содержат его. CARTO-стили НЕ содержат `render_height` → плоские здания. Для кастомных стилей — задать `sourceId`/`sourceLayer` явно или `<Layer>` напрямую.
8. **`TerrainPreset` использует AWS Terrarium** — бесплатно, без ключа, покрытие глобальное. Можно переопределить через `url` prop.
9. **Capsule theme = `body.dark` class, matchMedia игнорируется by design** — `prefers-color-scheme` не читается. Mixing `body.dark || matchMedia.matches` ломает toggle: на системах с OS prefers-dark карта застревает в dark после app-level switch на light (`false || true = true`). Если нужна react-на-OS, capsule ThemeSwitcher должен сам читать matchMedia и проставлять `body.dark` — это его зона ответственности, не MapView.
10. **Non-GeoJSON source с зависимыми layers** — reactive spec change делает `removeSource`+`addSource`, но если Layer зависит от этого Source в момент смены — MapLibre может выбросить ошибку. Используй conditional render для безопасной смены.
11. **`styledata` fires многократно** — только при `isStyleLoaded() === true` делаем re-apply. Предыдущие срабатывания (isStyleLoaded = false) игнорируются.
12. **Source mount-effect читает spec через `untrack`** — намеренно, чтобы не перезапускаться при изменении spec (это handled отдельными effects). Не убирать.

13. **`Marker` — DOM-элемент, не render pipeline** — `map.setStyle()` не удаляет маркеры. `'styledata'` listener не нужен и не регистрируется. Это ключевое архитектурное отличие от `Source`/`Layer`/`Terrain`/`Sky`.

14. **`Marker.onClick` — нативный `click` listener** — `addEventListener('click', ...)` на `marker.getElement()`, не `marker.on('click', ...)` (MapLibre API). Нативный вариант даёт `MouseEvent`, MapLibre-вариант даёт `MapMouseEvent`. Сигнатура `IMarkerProps.onClick = (data: T, event: MouseEvent)` требует нативного.

15. **`Marker.data` реактивен через closure** — DOM не трогается при изменении `data`. Click handler читает `props.data` в момент вызова. Новый объект `data` виден при следующем клике без пересоздания маркера.

16. **`Marker.anchor` recreate — `markerRef` паттерн** — два эффекта координируются через `let markerRef` на уровне компонента. Lifecycle-effect (tracks anchor) пишет ref, position-effect читает его для `setLngLat`. При anchor-change lifecycle-effect запускается заново: cleanup старого маркера (`remove()`, `markerRef = undefined`), затем создание нового (`markerRef = marker`).

## Test strategy

Все тесты в jsdom + `vi.mock('maplibre-gl', ...)` + `vi.stubGlobal('ResizeObserver', ...)` + `vi.stubGlobal('MutationObserver', ...)` + `vi.stubGlobal('matchMedia', ...)`. WebGL недоступен в jsdom — mock перехватывает конструктор `Map` и все его методы. `matchMedia` стаббируется чтобы тесты могли явно проверить что `addEventListener` на него НЕ вызывается (регрессионная гарантия).

Всего 143 unit-тестов (11 test files). Marker-mock расширяет существующий паттерн:

```ts
const MockMarker = vi.fn(function (this, options = {}) {
  this._constructorOptions = options;
  const el = document.createElement('div');
  this._element = el;
  this.setLngLat = vi.fn().mockReturnThis();
  this.addTo = vi.fn().mockReturnThis();
  this.remove = vi.fn();
  this.getElement = vi.fn(() => el);
  markerInstances.push(this);
});
// export as { default: { Map: MockMap, Marker: MockMarker }, Map: MockMap, Marker: MockMarker }
```

`el.dispatchEvent(new MouseEvent('click'))` используется для тестирования click handler (нативный listener).

Расширенный mock для reactive tests включает:
- `off(event, handler)` — убирает listener из внутренних arrays (load/styledata).
- `_triggerStyleData()` — вызывает все styledata handlers.
- `_wipeUserState()` — очищает addedSources/addedLayers sets (симулирует `setStyle`).
- `setPaintProperty`, `setLayoutProperty`, `setFilter`, `setLayerZoomRange` — spy fns.
- `setSky` — spy fn (maplibre-gl 5+, раньше отсутствовал в v4 → был источником TypeError).
- GeoJSON source mock с `{ setData: vi.fn() }` объектом для проверки setData calls.

Запуск: `pnpm --filter @capsuletech/web-map test`.
