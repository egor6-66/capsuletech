---
tags: [hca, adr, accepted]
status: accepted
date: 2026-05-23
---

# ADR 016 — Matrix v2: rows-engine + presets + DnD (swap/insert)

> [!info] Status: accepted
> Контракт для refactor'а `Layout.Matrix` в `@capsuletech/web-ui`. Имплементация — в PR #132, #135.

## Контекст

Текущий `Layout.Matrix` (`packages/web/ui/src/primitives/layout/matrix/`) предоставляет 5 жёстких именованных слотов: `header`, `sidebar`, `main`, `rightBar`, `footer`. Каждый слот имеет свою геометрию (header/footer — горизонтальные полосы, sidebar/rightBar — вертикальные колонки, main — центр). Резайз через corvu Flex/Panel. DnD отсутствует.

Использование сейчас (`apps/sandbox/src/pages/workspace.tsx`):

```tsx
<Ui.Layout.Matrix
  slots={{
    header: { children: <Widgets.Layout.Header /> },
    main: { children: <Widgets.Data.UsersTable />, resizable: true, initialSize: 0.8 },
    rightBar: { children: <Widgets.Layout.RightBar />, resizable: true, initialSize: 0.2 },
    footer: { children: <Widgets.Layout.Footer />, resizable: true, initialSize: 0.3 },
  }}
/>
```

## Проблема

**1. Жёсткие 5 слотов не покрывают реальные кейсы.** Пользователь хочет:
- N виджетов в произвольной расстановке: «2 в ряд, потом 1 во всю ширину, потом 3 в ряд».
- Менять местами слоты (rightBar ↔ footer) — например, виджет карты переехал из боковой колонки в нижнюю полосу. Виджет content-agnostic — рендерится одинаково в любом контейнере.
- Drag-and-drop виджетов как в react-grid-layout — N виджетов разных размеров, юзер расставляет.

**2. DnD не вписывается в текущую модель.** Текущие 5 слотов **асимметричны** по геометрии. Swap rightBar ↔ footer не определён: «footer становится колонкой 0.3 ширины»? «rightBar разворачивается в полосу»? Нативного решения нет.

**3. Нет переиспользования удачных layout'ов.** Каждая страница повторяет одну и ту же структуру с copy-paste. Если хочется единый «application-shell» — нужно либо обёртка-Widget, либо повторять `slots`-объект.

## Решение

### 1. Matrix становится rows-движком, имя сохраняется

`Layout.Matrix` остаётся именем компонента, но внутренне переписывается на **rows-of-cells** модель. Резайз и DnD работают единообразно по всему layout'у — не зависят от роли слота.

### 2. Два способа использования: raw rows и preset

```ts
type MatrixProps =
  | { rows: IRow[];  ... }                              // raw — N rows, N cells
  | { preset: P;     slots: LayoutPresets[P]; ... };    // preset — typed по имени

interface IRow {
  id?: string;
  height?: number | 'auto' | 'fr';   // 0.3 = corvu Panel basis, 'auto' = content-height, 'fr' = 1fr
  resizable?: boolean;                // выводимо из height ('auto' → false, default true)
  cells: ICell[];
}

interface ICell {
  id: string;                          // обязателен (для DnD)
  children: JSX.Element;
  tag?: 'div' | 'header' | 'aside' | 'main' | 'footer' | 'nav' | 'section';
  width?: number | 'auto' | 'fr';
  resizable?: boolean;
  draggable?: boolean;
  swapGroup?: string;                  // ограничение swap-зоны (default = row.id)
}
```

**Raw**:
```tsx
<Ui.Layout.Matrix rows={[
  { cells: [{ id: 'top', tag: 'header', children: <Header /> }] },
  { resizable: true, cells: [
    { id: 'a', children: <A />, width: 0.5, resizable: true, draggable: true, swapGroup: 'main-row' },
    { id: 'b', children: <B />, width: 0.5, resizable: true, draggable: true, swapGroup: 'main-row' },
  ]},
]} />
```

**Preset**:
```tsx
<Ui.Layout.Matrix preset="app-shell" slots={{
  header:   <Widgets.Layout.Header />,
  main:     <Widgets.Data.UsersTable />,
  rightBar: <Widgets.Layout.RightBar />,
  footer:   <Widgets.Layout.Footer />,
}} />
```

### 3. Preset registry — пока только built-in

В v1 прессеты живут внутри `@capsuletech/web-ui` (`packages/web/ui/src/primitives/layout/matrix/presets/`). User-defined прессеты из `capsule.app.ts` — отложено до v2 после обкатки контракта.

Built-in registry:

```ts
// packages/web/ui/src/primitives/layout/matrix/presets/index.ts
export interface LayoutPresets {
  'app-shell': {
    header?: SlotValue;
    sidebar?: SlotValue;
    main: SlotValue;
    rightBar?: SlotValue;
    footer?: SlotValue;
  };
  // позже: 'split-2', 'split-3', 'dashboard-grid', ...
}

type PresetResolver<P extends keyof LayoutPresets> = (slots: LayoutPresets[P]) => IRow[];

const PRESETS: { [P in keyof LayoutPresets]: PresetResolver<P> } = {
  'app-shell': appShellResolver,
};
```

`SlotValue` — либо `JSX.Element`, либо объект `{ children, initialSize?, minSize?, maxSize?, draggable? }`. Override `initialSize` юзером shallow-merge'ится с дефолтом прессета.

### 4. Built-in preset `'app-shell'` — replicates current Matrix

Полный 5-slot layout: header (top, auto), sidebar+main+rightBar (middle row, resizable), footer (bottom, resizable). main — обязательный. sidebar/rightBar — в одной `swapGroup`, header/footer — в другой. Это даёт корректные swap-зоны: aside↔aside, band↔band, остальное запрещено.

Дефолтные размеры взяты из текущего `apps/sandbox/src/pages/workspace.tsx`:
- main: width 0.8 (resizable)
- rightBar: width 0.2 (resizable)
- footer: height 0.3 (resizable)
- header: height 'auto'
- sidebar: width 'auto' (если присутствует)

### 5. DnD — два режима (Phase 1.2 v2+)

#### `dndMode="swap"` (Phase 1.2 v2, реализовано)
- Каждый `draggable: true` cell — одновременно draggable и droppable (через `web-dnd` `createDraggable` + `createDroppable`).
- Drag **напрямую в Badge** (top-right угол cell'а) — cell surface registered as disabled draggable, badge вызывает `dnd.startDrag()` программно.
- При drop'е — обмен **children** между source и target. Размеры (`cells[].width`, `row.height`) остаются за позицией.
- **2-stage highlight** (overlay, z-30):
  - `canAccept`: drag active + cell в той же swapGroup + не source → светло-синий border + bg-primary/5
  - `canDrop`: canAccept + pointer over → primary border + bg-primary/15
  - `isOver` (чужая group): нейтральный border
- `swapGroup` ограничивает зону. Default `swapGroup` от preset (header/footer → `'band'`, sidebar/rightBar → `'aside'`, main → undefined). Явный — расширение на любые cells с тем же group-id.
- **Badge видна только при 2+ draggable cells** в одной swapGroup (иначе нечего свапить).
- `onLayoutChange` fires `{ kind: 'swap', a, b }` после успешного swap'а.
- **Resize persist (session-only):** `sizesSnapshot` mutable object, keyed by `"v"` (vertical) + `"h:<rowKey>"` (per-row), охраняется от corvu cleanup-time shrinking arrays.

#### `dndMode="insert"` (Phase 1.2+, заложено, not yet runtime)
- Cells становятся ordered list внутри row (через `web-dnd` `createSortable`).
- Drop в верхнюю/нижнюю половину target'а → insert before/after (как уже работает `createSortable`).
- Cell несёт свой `width` с собой.
- Cross-row insert — через `createDroppable` на самой row с accept-предикатом.
- НЕ freeform (нет x/y/w/h). Это всё ещё rows-of-cells, только cells можно переставлять и переносить между rows.

`dndMode` — глобальный prop на Matrix, не per-row.

### 6. Edit-mode badge (Phase 1.2+, заложено)

```ts
layoutMode?: 'view' | 'edit'   // default 'view'
```

- **`view`** — DnD выключен. Внутри слотов обычные кликабельные виджеты работают без вмешательства.
- **`edit`** — все `draggable: true` cells получают outline + drag-cursor. В Phase 1.2 v2 edit-mode управляется только через `layoutMode` prop (controlled); badge виден когда 2+ draggable cells.

### 7. `onLayoutChange` — event-based payload

Matrix не хранит layout state. При drop'е эмиттит **событие**:

```ts
type LayoutChangeEvent =
  | { kind: 'swap';   a: string; b: string }
  | { kind: 'insert'; id: string; toRow: number; toIndex: number };

onLayoutChange?: (event: LayoutChangeEvent) => void;
```

Потребитель решает что хранить (XState context, localStorage, URL search, ничего).

Это каноничнее для HCA-паттерна: layer state управляется Controller/Feature, View/UI-kit просто эмиттит.

## Реализационные детали

### Order of work

1. **owner-web-ui** (этот worktree):
   - Новые типы в `interfaces.ts`
   - Rows-engine (replace `matrix.tsx`)
   - Preset resolver (`presets/index.ts` + built-in `'app-shell'`)
   - Swap-mode DnD
   - Insert-mode DnD
   - Edit-mode badge + `layoutMode` prop
   - Event-based `onLayoutChange`
   - Storybook stories: raw rows, preset, swap, insert, edit-mode, controlled
   - Переписать tests
   - Мигрировать `apps/sandbox/src/pages/workspace.tsx` → `preset="app-shell"`

2. **owner-tests**: `pnpm test:e2e:cli` после merge.

3. **Architect** (я): финальный bump web_base + tag.

### Backwards compatibility

**Hard breaking change.** Текущий API `<Matrix slots={{...}} />` исчезает. На замену — `<Matrix preset="app-shell" slots={...} />`. Миграция тривиальная: одна строка `preset="app-shell"`.

### Auto-centroid режим

Сохраняется как поведение прессета `'app-shell'`: если в `slots` передан только `main` — preset resolver возвращает single-row с одним cell, centroid-стиль.

### Animate

Сохраняется `animated?: boolean | AnimateVariant` prop. Применяется к cell с `id === 'main'` (или первой найденной).

### Router-soft-dep

Сохраняется интеграция с `RouterContext`: если router доступен — `<Animate keyed={router.current()} />`.

### Не делаем сейчас

- **User-defined presets через `capsule.app.ts`.** Phase 2.
- **Freeform grid-layout (x/y/w/h, collision detection, empty cells).**
- **Per-row `dndMode`.**
- **Matrix-inside-Matrix nesting** — технически работает, но без гарантий v1.

## Альтернативы, которые мы НЕ взяли

### A. Отдельный `Layout.Dashboard` — Matrix не трогаем
Дублирование примитивов. Engine один — лучше один компонент с разными режимами.

### B. Hardcoded slots, добавить DnD только в asymmetric swap
Не закрывает «N виджетов в произвольной расстановке». Полумера.

### C. Rows-only, без прессетов
Boilerplate. Прессет даёт friendly API + типизацию + reuse.

### D. `onLayoutChange` возвращает full state
Подталкивает Matrix к владению state. Event-based — каноничнее для HCA.

### E. Freeform grid-layout
Слишком большой scope для v1. Rows-engine покрывает 90% реальных кейсов.

## Последствия

### Положительные

- Один движок (Matrix) покрывает «app-shell», «split-2», «dashboard-rows», «N виджетов в произвольной расстановке».
- DnD унифицирован — swap для structural, insert для ordered lists. Оба строятся на `web-dnd` без расширений.
- Preset registry даёт friendly API + type-safety + reuse.
- HCA-инверсия сохранена: Matrix эмиттит events, Controller/Feature владеют state.

### Отрицательные

- **Breaking change** в `Layout.Matrix` API — все потребители мигрируют (только sandbox).
- Release web_base group bump — координируется архитектором.
- v1 без user-defined presets.

### Migration / Roadmap

**Phase 0 — ADR (этот файл)**: status proposed.

**Phase 1 — Matrix v2 implementation (этот worktree)**:
- rows-engine, preset, swap+insert DnD, edit-mode, Storybook, tests, миграция sandbox.

**Phase 2 — User-defined presets**: отдельный ADR + PR.

**Phase 3 — Дополнительные built-in presets**: по запросу.

**Phase 4 — Freeform (опционально)**: только если появится конкретный кейс.

ADR переходит в `status: implemented` после Phase 1.

## Связанное

- [[004-compliance-linter|ADR 004]] — Compliance (Matrix не нарушает HCA-rules, View-слой stateless через event-emission)
- [[013-explicit-define-app-config|ADR 013]] — `defineAppConfig` (Phase 2 — расширение IAppConfig для user-defined presets)
- `packages/web/dnd/` — DnD-движок, на котором строится swap/insert
- `packages/web/ui/src/primitives/layout/matrix/` — текущая реализация Matrix (будет переписана)
