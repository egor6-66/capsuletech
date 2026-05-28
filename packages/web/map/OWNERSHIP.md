---
name: "@capsuletech/web-map"
owner-agent: owner-web-map
group: web-map
status: pre-1.0
last-updated: 2026-05-28
---

# @capsuletech/web-map

Низкоуровневый Solid-wrapper над MapLibre GL JS: монтирует карту, прокидывает instance через Context, реактивно синхронизирует props. Прямая интеграция с `maplibre-gl` без промежуточных обёрток (solid-map-gl удалён в пользу zero-leak implementation).

## Зона ответственности

### Owns
- `packages/web/map/src/` (полностью)
- `packages/web/map/vite.config.mts`
- `packages/web/map/package.json` exports / deps
- `packages/web/map/vitest.config.ts`
- `packages/web/map/README.md`
- `packages/web/map/CHANGELOG.md`

### Не трогает
- Содержимое других `@capsuletech/*` пакетов (делегировать главному).
- Root-level `package.json`, `tsconfig.base.json`, `nx.json` (главный assistant).
- `apps/*/` (user / framework-developer scope).
- `scripts/release-local.mjs` и shared infra (главный assistant).

## Публичный API

Единственный entrypoint `.` → `dist/index.mjs`:

**Core:**
- `MapView` — корневой компонент карты (`IMapViewProps`)
- `useMap()` — hook; возвращает `IMapContext` (обязательно внутри `<MapView>`)
- `MapContext` — Solid Context для прямого доступа (редко нужен)
- `IMapViewProps` — тип props компонента
- `IMapContext` — тип контекста (`{ map: Accessor<maplibregl.Map | undefined> }`)
- `IViewport` — тип viewport snapshot (center/zoom/bearing/pitch), передаётся в `onViewportChange`
- `POSITRON` — дефолтный светлый стиль (CARTO Positron)
- `DARK_MATTER` — дефолтный тёмный стиль (CARTO Dark Matter)

**Child components (Iter 1 / 3D features):**
- `Source` — добавляет `maplibre source` (`ISourceProps`: `id`, `spec: SourceSpecification`)
- `Layer` — добавляет `maplibre layer` (`ILayerProps`: `spec: LayerSpecification`, `beforeId?`)
- `Terrain` — включает 3D-рельеф (`ITerrainProps`: `source`, `exaggeration?`)
- `Sky` — добавляет атмосферное небо (`ISkyProps`: `spec?: SkySpecification`)

**Presets:**
- `TerrainPreset` — `<Source raster-dem>` + `<Terrain>` в одном (AWS Terrarium, без ключа). Props: `url?`, `tileSize?`, `exaggeration?`
- `BuildingsPreset` — `<Layer fill-extrusion>` для 3D-зданий из CARTO tiles. Props: `sourceId?` (default `"carto"`), `sourceLayer?`, `color?`, `opacity?`, `minZoom?`, `layerId?`

Изменение сигнатур — breaking change, координировать с главным.

### IMapViewProps

| Prop | Тип | Default | Реактивный |
|---|---|---|---|
| `style` | `string \| StyleSpecification` | POSITRON | да (тяжёлая замена, стирает layers) |
| `darkStyle` | `string \| StyleSpecification` | DARK_MATTER | нет (только init) |
| `attributionControl` | `boolean` | `false` | нет (только init) |
| `center` | `LngLatLike` | undefined | да (jump, без анимации) |
| `zoom` | `number` | undefined | да (jump) |
| `bearing` | `number` | undefined | да (jump) |
| `pitch` | `number` | undefined | да (jump) |
| `minZoom` | `number` | undefined | нет (только init) |
| `maxZoom` | `number` | undefined | нет (только init) |
| `maxBounds` | `LngLatBoundsLike` | undefined | нет (только init) |
| `class` | `string` | undefined | — |
| `classList` | `Record<string, bool>` | undefined | — |
| `style_container` | `JSX.CSSProperties` | undefined | — |
| `onLoad` | `(map) => void` | undefined | нет (once) |
| `onViewportChange` | `(viewport: IViewport) => void` | undefined | — |
| `children` | `JSX.Element` | undefined | — (child components here) |

## Quirks / gotchas

1. **0-size container crash / `jumpTo` NaN** (`src/MapView.tsx`) — maplibre 4+ вызывает `jumpTo({center})` прямо в конструкторе `new Map(...)`. Если container имеет transient 0-size — projection matrix ещё не инициализирована → `_calcMatrices` → `"Invalid LngLat object: (NaN, NaN)"`.
   **DO NOT pass `center`, `zoom`, `pitch`, `bearing`, `maxBounds` to the maplibre constructor.** Выставлять ТОЛЬКО после `'load'` через setters. ResizeObserver-gate в `onMount` защищает от вызова конструктора до появления размера контейнера.

2. **`maplibre-gl.css` не подключается автоматически** — consumer сам обязан сделать `import 'maplibre-gl/dist/maplibre-gl.css'`. Без этого карта рендерится, но без UI-контролов и стилей.

3. **`setStyle` и styledata re-add** — `map.setStyle()` стирает все user-added sources/layers/terrain/sky. Все child components (`Source`, `Layer`, `Terrain`, `Sky`) слушают `'styledata'` и автоматически пере-применяют себя когда `isStyleLoaded() === true`. Listener регистрируется на mount, снимается на unmount. Гарантирует persistent presence через theme switches.

4. **`onLoad` срабатывает один раз** — через `instance.once('load')`. После `setStyle` нужно слушать `'styledata'`. Child components это делают автоматически.

5. **`attributionControl: true` маппится на `{}`** — maplibre-gl 4 тип принимает `false | AttributionControlOptions`, не `boolean`. `props.attributionControl ? {} : false` в конструкторе.

6. **`maxBounds`, `minZoom`, `maxZoom` не реактивны** — только в initial config конструктора. Добавление `createEffect` — отдельная задача (низкий приоритет).

7. **center/zoom/bearing/pitch → jump без анимации** — `setCenter/Zoom/Bearing/Pitch()`. Для `flyTo`/`easeTo` — императивно через `useMap()`.

8. **WebGL недоступен в jsdom** — тесты используют `vi.mock('maplibre-gl', ...)` + `vi.stubGlobal('ResizeObserver', ...)` + `vi.stubGlobal('MutationObserver', ...)` + `vi.stubGlobal('matchMedia', ...)` для полного контроля.

9. **Тёмная тема — единый `isDark` signal** (`src/MapView.tsx`): matchMedia + MutationObserver обновляют signal, один `createEffect` делает `setStyle`. Нет race conditions. `isDark` инициализируется синхронно через `readDarkMode()` — map сразу получает правильный стиль, включая dark, при mount.

10. **`BuildingsPreset` работает только со стилями, содержащими source `"carto"`** (POSITRON, DARK_MATTER). Для кастомных стилей — использовать `<Layer>` напрямую с нужным `source` и `source-layer`.

11. **`TerrainPreset` использует внутренний source id `__terrain-preset-dem__`** — не используй этот id вручную если TerrainPreset уже в дереве.

12. **GeoJSON `spec.data` реактивен через `setData`** — когда `spec.type === 'geojson'` и меняется `spec.data`, компонент вызывает `(map.getSource(id) as GeoJSONSource).setData(newData)`. Source не пересоздаётся. Это работает через `createEffect<boolean>` с "first run" флагом — начальный mount обрабатывается mount-effect'ом, последующие изменения — setData-effect'ом.

13. **Non-GeoJSON spec reactive через removeSource+addSource** — для raster, vector, raster-dem изменение `spec` после mount вызывает `removeSource` + `addSource`. Это безопасно только без зависимых слоёв. С зависимыми слоями MapLibre может выбросить ошибку — используй conditional render.

14. **Layer: `paint`, `layout`, `filter`, `minzoom/maxzoom` реактивны** — `setPaintProperty`/`setLayoutProperty`/`setFilter`/`setLayerZoomRange` вызываются при изменении соответствующих полей spec. Структурные поля (`type`, `source`, `source-layer`) требуют full removeLayer+addLayer (выполняется автоматически при изменении spec).

15. **Terrain/Sky реактивны** — любое изменение props → повторный `setTerrain`/`setSky`. Это идемпотентные операции в MapLibre, быстрые.

16. **`untrack` в Source mount-effect** — mount-effect читает `props.spec` через `untrack()` чтобы не re-run на каждое изменение spec. Изменения spec обрабатываются отдельными effects. Это намеренный дизайн — не убирать.

## Plan рефакторинга / roadmap

- [x] **Iter 0 — skeleton** — `MapView` + `useMap()` + `MapContext`. (2026-05-19)
- [x] **0-size container fix** — ResizeObserver-gated mount, устраняет NaN crash в resizable slots. (2026-05-22)
- [x] **Drop solid-map-gl** — прямая интеграция с maplibre-gl, устранены 3 memory leak источника из solid-map-gl@1.13.0. Добавлены 33 unit-тесты. (2026-05-28)
- [x] **Theme bug fix + 3D features** — единый `isDark` signal, устранены init bug + subsequent switch bug. Child components: `Source`, `Layer`, `Terrain`, `Sky`. Presets: `TerrainPreset`, `BuildingsPreset`. Итого 79 unit-тестов. (2026-05-28)
- [x] **Reactive layers API + styledata preservation** — все 4 child components реактивны по props + пере-применяют себя после `setStyle` через `'styledata'` event. 126 unit-тестов. (2026-05-28)
- [ ] **Iter 2 — markers / custom HTML** — через Solid `render(() => ..., el)` для HTML-маркеров. (priority: high)
- [ ] **Iter 3 — measurement / route tools** (priority: medium)
- [ ] **Iter 4 — clusters + spiderfier** (priority: low)
- [ ] **maxBounds реактивность** — добавить `createEffect` для `setMaxBounds`. (priority: low)
- [ ] **`onLoad` после style-swap** — подписка на `'styledata'` дополнительно к `'load'`. (priority: medium)
- [ ] **docs/09-packages/map.md** — user-guide с примерами. (priority: P1 перед stable release)

## Test coverage

| Тип | Где | Что покрывает |
|---|---|---|
| Unit | `src/__tests__/map-view.test.tsx` | ResizeObserver-gated mount (5), camera props after load (3), memory cleanup (5), onViewportChange (1) — 14 тестов |
| Unit | `src/__tests__/props-passthrough.test.tsx` | Constructor options (9), reactive prop sync (5), dark theme constants, useMap guard, container class/style (3) — 19 тестов |
| Unit | `src/__tests__/theme-switching.test.tsx` | Init dark (4), body.classList switching (5), matchMedia switching (3), style prop + theme (2), listener cleanup (2) — 16 тестов |
| Unit | `src/__tests__/child-components.test.tsx` | Source lifecycle (6), Layer lifecycle (6), Terrain lifecycle (5), Sky lifecycle (5) — 22 тестов |
| Unit | `src/__tests__/presets.test.tsx` | TerrainPreset (5), BuildingsPreset (8) — 13 тестов |
| Unit | `src/__tests__/theme-preservation.test.tsx` | Source styledata (3), Layer styledata (3), Terrain styledata (3), Sky styledata (3), combined (1) — 13 тестов |
| Unit | `src/__tests__/reactive-source.test.tsx` | GeoJSON setData (5), non-GeoJSON remove+add (2) — 7 тестов |
| Unit | `src/__tests__/reactive-layer.test.tsx` | paint (4), layout (2), filter (2), zoom range (4), structural (1) — 13 тестов |
| Unit | `src/__tests__/reactive-terrain.test.tsx` | exaggeration (3), source (1), combined (1) — 5 тестов |
| Unit | `src/__tests__/reactive-sky.test.tsx` | spec (5) — 5 тестов |
| Integration | — | нет, WebGL требует реального браузера |
| E2E | — | нет (пакет не в smoke fixture пока) |

**Всего: 126 unit-тестов, все проходят.**

**Перед изменением:** `pnpm --filter @capsuletech/web-map test` должен быть green.
**При breaking change в IMapViewProps:** обновить тесты + README.
**Перед release:** координировать с главным (`pnpm test:e2e:cli` не покрывает map напрямую).

## Cross-package dependencies

| Зона | Owner |
|---|---|
| Theme variables, createStyle | owner-web-style |
| UI primitives, Layout (Matrix slot) | owner-web-ui |
| HCA wrappers, providers | owner-web-core |
| Vite plugins / lib-builder | owner-builders |

## Release group

`@capsuletech/web-map` **не входит** в группу `web_base`. Релизится отдельно как `@capsuletech/web-map@0.0.x`.

После стабилизации (минимум после Iter 2 markers) — обсудить с главным включение в `web_base` (fixed-versioning). Соседи группы тогда: `web-core`, `web-dnd`, `web-ui-creator`, `web-profiler`, `web-query`, `web-renderer`, `web-router`, `web-state`, `web-style`, `web-ui`, `shared-zod`.
