---
name: "@capsuletech/web-dnd"
owner-agent: owner-web-dnd
group: web_base
status: stable
last-updated: 2026-05-23
---

# @capsuletech/web-dnd

Pointer-based drag-and-drop для Solid.js. Лёгкий (без HTML5 native-флэйков), поддерживает mouse + touch, работает с window-level listeners (нет setPointerCapture).

## Зона ответственности

### Owns

- `packages/web/dnd/src/` — весь логик:
  - `context.tsx` — DnDProvider (activeId, pointer, droppables registry, findDroppableAt, DefaultDragOverlay)
  - `types.ts` — типы (DraggableId, DroppableId, DragData, IDraggableEntry, IDroppableEntry, IDnDProviderProps, IDragSnapshot)
  - `draggable.ts` — createDraggable (регистрация, disabled logic)
  - `droppable.ts` — createDroppable (регистрация, accepts, onDrop)
  - `sortable.ts` — createSortable (ordered-list pattern)
  - `overlay.tsx` — DragOverlay (render-prop, custom ghost)
  - `autoScroll.ts` — window-level scroll при drag близко к краю
  - `index.ts` — exports
- `packages/web/dnd/package.json` — deps / peerDeps / exports
- `packages/web/dnd/vite.config.mts` — build config

### Не трогает

- Theme tokens, createStyle — owner-web-style
- Другие пакеты web_base group — делегировать соответствующим owners
- Root-level infra (package.json, tsconfig.base.json, nx.json) — главный assistant

## Публичный API

| Export | Что |
|---|---|
| `DnDProvider` | Context-провайдер с props для overlay + callbacks |
| `useDnD()` | Читать state (activeId, pointer, overId, canDrop) + startDrag |
| `createDraggable(opts)` | Делает элемент перетаскиваемым |
| `createDroppable(opts)` | Делает элемент drop-зоной |
| `createSortable(opts)` | Sortable-pattern (items с reorder) |
| `DragOverlay` | Render-prop для кастомного ghost |
| Types: `IDnDProviderProps`, `IDraggableOptions`, `IDroppableOptions`, `DragData`, `IDropInfo`, `IDragEndResult`, `IDragSnapshot` | Типы |

**Это контракт.** Изменение публичного API = breaking change для всех потребителей ([[Matrix v2|web-ui]], future composables).

## Quirks / gotchas

- **No setPointerCapture** — При `setPointerCapture(pointerId)` на draggable элементе, `document.elementFromPoint(x, y)` перестаёт возвращать реальные drop-targets — всегда returns the captured element. Это ломает `findDroppableAt()` in `context.tsx:173-181`. Решение: window-level `pointermove/pointerup` listeners только (без capture). See ADR context in web-ui.

- **Canvas WebGL limitation** — `canvas.cloneNode()` не копирует pixel buffer. Fallback: `toDataURL()` с try/catch; если tainted/CORS/`preserveDrawingBuffer=false`, выдаём slate placeholder. See `context.tsx:277-309` (DefaultDragOverlay clone logic).

- **Window-level listeners reset** — `cleanup()` вызывается при штатном завершении drag (pointerup, Escape) и при unmount Provider'а через `onCleanup(cleanup)`. Закрывает edge case: route change во время активного drag → Provider unmount раньше pointerup → orphan listeners. See `context.tsx` (cleanup function + `onCleanup(cleanup)` call).

- **Pointer in Portal** — DefaultDragOverlay рендерится в `<Portal>`, но `pointer` signal реактивный в DnDProvider. Solid细致 reactive tracking здесь work'ает правильно.

## План рефакторинга / оптимизаций

- [ ] **HTML5 Drag and Drop spec alternative** — если когда-то переходить на native DragEvent API, это будет breaking change всего пакета. Текущая реализация — намеренно простая, не привязана к spec. (priority: низкая, только если появится конкретный кейс)
- [x] **Programmatic startDrag для badge-pattern (Phase 1.2 v2, 2026-05-23)** — Matrix DragBadge вызывает `dnd.startDrag()` напрямую, cell registered as disabled draggable. Window-level listeners обрабатывают это корректно.
- [x] **DefaultDragOverlay modes: clone/thumbnail/mini (Phase 1.2 v2, 2026-05-23)** — `showDefaultOverlay` + `overlayMode` + `overlayScale`. Clone = полноразмерный полупрозрачный, thumbnail = уменьшенный centered under cursor, mini = legacy 48×48 box.
- [x] **Canvas snapshot fallback (Phase 1.2 v2, 2026-05-23)** — WebGL canvas → toDataURL(); tainted/CORS → slate placeholder.

## Test coverage

| Тип | Где | Что покрывает |
|---|---|---|
| Stories | storybook (TBD) | visual smoke — DragOverlay modes, droppable highlighting |
| Unit | `src/__tests__/provider-cleanup.test.tsx` (5/5) | window listeners lifecycle: no listeners before drag; startDrag attaches 4; unmount during drag removes all 4; pointerup removes all 4; Escape removes all 4 |
| Integration | [[Matrix v2|web-ui]] swap tests | `src/primitives/layout/matrix/__tests__/swap-dnd.test.tsx` (47/47 passing) |
| E2E | `packages/cli/e2e/smoke.mjs` | косвенно через Matrix-using pages в sandbox |

**Перед изменением:** unit-tests должны быть green (`pnpm --filter @capsuletech/web-dnd test`).

**Перед release:** `pnpm test:e2e:cli` smoke fixture обязателен (тестит full Matrix+DnD scenario).

## Cross-package dependencies

| Зона | Owner |
|---|---|
| UI-kit примитивы, Layout | owner-web-ui |
| Theme tokens, createStyle | owner-web-style |
| Wrapper определения (Provider) | owner-web-core (если понадобится wrapper для DnDProvider) |

## Release group

`web_base` (fixed): web-core + web-dnd + web-ui + ... (12 пакетов, релизятся вместе).

После изменений web-dnd — координировать release через главного (`pnpm release:local:web` или `--group=web_base`).

## Связанные документы

- [[016-matrix-v2-rows-engine|ADR 016]] — Matrix v2 использует swap-mode DnD
- [[web-ui|web-ui.md]] — Matrix DnD implementation details
- README.md (этой же папки) — user-facing docs
