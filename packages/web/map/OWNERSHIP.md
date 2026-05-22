---
name: "@capsuletech/web-map"
owner-agent: owner-web-map
group: web-map
status: pre-1.0
last-updated: 2026-05-22
---

# @capsuletech/web-map

Низкоуровневый Solid-wrapper над MapLibre GL JS: монтирует карту, прокидывает instance через Context, реактивно синхронизирует props.

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

- `MapView` — корневой компонент карты (`IMapViewProps`)
- `useMap()` — hook; возвращает `IMapContext` (обязательно внутри `<MapView>`)
- `MapContext` — Solid Context для прямого доступа (редко нужен)
- `IMapViewProps` — тип props компонента
- `IMapContext` — тип контекста (`{ map: Accessor<maplibregl.Map | undefined> }`)

Изменение сигнатур — breaking change, координировать с главным.

### IMapViewProps

| Prop | Тип | Default | Реактивный |
|---|---|---|---|
| `style` | `string \| StyleSpecification` | demotiles URL | да (тяжёлая замена) |
| `center` | `LngLatLike` | undefined | да (jump, без анимации) |
| `zoom` | `number` | undefined | да (jump) |
| `bearing` | `number` | undefined | да (jump) |
| `pitch` | `number` | undefined | да (jump) |
| `minZoom` | `number` | undefined | нет (только init) |
| `maxZoom` | `number` | undefined | нет (только init) |
| `maxBounds` | `LngLatBoundsLike` | undefined | нет (только init) |
| `class` | `string` | undefined | — |
| `classList` | `Record<string, bool>` | undefined | — |
| `onLoad` | `(map) => void` | undefined | нет (once) |
| `children` | `JSX.Element` | undefined | — |

## Quirks / gotchas

1. **0-size container crash** (`src/MapView.tsx:96–111`) — **IN-PROGRESS / этот PR**.
   MapLibre читает `container.clientWidth/clientHeight` синхронно в конструкторе `new Map(...)`. Если контейнер ещё не имеет размеров (resizable slot, CSS transition, Suspense), бросает `Invalid LngLat object: (NaN, NaN)`.
   Fix: `ResizeObserver`-gated mount — `new Map(...)` вызывается только когда `contentRect.width > 0 && height > 0`. Если размер уже есть на mount — инициализация синхронная. Если контейнер никогда не получит размеры — pending-state без ошибки.

2. **`maplibre-gl.css` не подключается автоматически** — consumer сам обязан сделать `import 'maplibre-gl/dist/maplibre-gl.css'`. Без этого карта рендерится, но без UI-контролов и стилей.

3. **`style` → `setStyle` стирает user-added layers/sources** — MapLibre пересоздаёт весь style pipeline. Layers из Iter 1+ должны будут переподписываться на `'styledata'`. Это design decision, документировать при реализации Iter 1.

4. **`onLoad` срабатывает один раз** — через `instance.once('load')`. После `setStyle` нужно слушать `'styledata'`. Сейчас не реализовано.

5. **`maxBounds`, `minZoom`, `maxZoom` не реактивны** — только в initial config конструктора. Добавление `createEffect` для них — отдельная задача Iter 0.x (низкий приоритет).

6. **center/zoom/bearing/pitch → jump без анимации** — `setCenter/Zoom/Bearing/Pitch()`. Для `flyTo`/`easeTo` — императивно через `useMap()`.

7. **WebGL недоступен в jsdom** — тесты, которые реально монтируют MapLibre, упадут. Необходим mock или разнос pure-логики. Текущий план: тестировать ResizeObserver-gate через mock `maplibregl.Map` со spy на конструктор.

## Plan рефакторинга / roadmap

- [x] **Iter 0 — skeleton** — `MapView` + `useMap()` + `MapContext`. (2026-05-19)
- [x] **0-size container fix** — ResizeObserver-gated mount, устраняет NaN crash в resizable slots. (2026-05-22)
- [ ] **Iter 1 — layers API** — `<RasterLayer>`, `<VectorLayer>`, `<GeoJSONLayer>`. Каждый: `useMap` + `onCleanup` для `removeLayer`/`removeSource`. Re-add на `'styledata'`. (priority: high)
- [ ] **Iter 2 — markers / custom HTML** — через Solid `render(() => ..., el)` для HTML-маркеров. (priority: high)
- [ ] **Iter 3 — measurement / route tools** (priority: medium)
- [ ] **Iter 4 — clusters + spiderfier** (priority: low)
- [ ] **maxBounds реактивность** — добавить `createEffect` для `setMaxBounds`. (priority: low)
- [ ] **`onLoad` после style-swap** — подписка на `'styledata'` дополнительно к `'load'`. (priority: medium, нужно в Iter 1)
- [ ] **docs/09-packages/map.md** — user-guide с примерами. (priority: P1 перед stable release)
- [ ] **docs/_meta/map.md** — AI-anchor для других агентов. (priority: P1 перед stable release)

## Test coverage

| Тип | Где | Что покрывает |
|---|---|---|
| Unit | `src/__tests__/map-view.test.tsx` | 7 тестов: 0-size → Map не создаётся; size > 0 → Map создаётся; deferred init после resize; no double-init; cleanup (remove + disconnect); observer disconnect без init; zero-size entries ignored |
| Unit | — (TODO Iter 1) | Layer mount/cleanup, source registration |
| Integration | — | нет, WebGL требует реального браузера |
| E2E | — | нет (пакет не в smoke fixture пока) |

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

После стабилизации (минимум после Iter 2 markers) — обсудить с главным включение в `web_base` (fixed-versioning). Соседи группы тогда: `web-core`, `web-dnd`, `web-editor`, `web-profiler`, `web-query`, `web-renderer`, `web-router`, `web-state`, `web-style`, `web-ui`, `shared-zod`.
