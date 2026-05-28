---
name: "@capsuletech/web-ui"
owner-agent: owner-web-ui
group: web_base
status: pre-1.0
last-updated: 2026-05-22
---

# @capsuletech/web-ui

Stateless UI-kit для capsule: ~15 primitives (Button, Input, Card, Field, Toggle, Typography, ...) + layout-namespace (`Layout.Grid`, `Layout.Flex`, `Layout.Matrix`). Polymorphic через Slot (Kobalte), CVA + createStyle (из web-style), themed tokens only.

## Зона ответственности

### Категории src/

| Категория | Что | Примеры |
|---|---|---|
| `primitives/` | Atoms — stateless semantic wrappers над HTML-элементами. Не знают о TanStack/Kobalte внутри. | Button, Input, Card, Table, Field, Layout/* |
| `composites/` | Higher-level assembled components с встроенным smart-flow. Инкапсулируют library deps (e.g. TanStack Table внутри DataTable). Stateful (createSignal внутри), но stateless в смысле бизнес-логики (только UI-state). | DataTable |
| `wrappers/` | Internal animation/status wrappers. | animate, status |

### Owns

- `packages/web/ui/src/primitives/` — все primitives: button, input, label, card, field, flex, grid, list, separator, slot, table, toggle, typography, matrix, wrappers/* (animate, resizable как internal `flex/_resize/`).
- `packages/web/ui/src/composites/` — assembled higher-level components: DataTable (инкапсулирует `@tanstack/solid-table`).
- `packages/web/ui/.storybook/` — Storybook config (`main.ts`, `vite.config.ts`, `preview.ts`).
- `packages/web/ui/.babelrc` — Babel config для CVA.
- `packages/web/ui/vite.config.mts` — build config (multi-entry, один subpath per primitive).
- `packages/web/ui/package.json` — exports / deps / peerDeps.
- Все `*.stories.tsx` рядом с primitives.

### Не трогает

- Theme tokens, createStyle, cn, merge — `owner-web-style`.
- `Ui` namespace registry — `web-core/src/ui-kit/imports.tsx` (`owner-web-core`). При добавлении нового primitive нужно **согласовать**: web-ui экспортит → web-core добавляет lazy-импорт в imports.tsx.
- Root-level `package.json`, `tsconfig.base.json`, `nx.json` (главный assistant).
- `apps/*/` (user / framework scope).

## Публичный API

Каждый primitive имеет собственный subpath export для tree-shaking:

```ts
// Main barrel (всё одной строкой, удобно для типов)
import { Button, Input, Card, Layout, Matrix, ... } from '@capsuletech/web-ui';

// Subpath (для tree-shake в bundler'е)
import { Button } from '@capsuletech/web-ui/button';
import { Matrix } from '@capsuletech/web-ui/matrix';
import { Flex } from '@capsuletech/web-ui/flex';
import { Grid } from '@capsuletech/web-ui/grid';
```

### Subpath exports (через `package.json.exports`)

`./button`, `./card`, `./field`, `./flex`, `./grid`, `./input`, `./label`, `./layout` (deprecated alias на matrix), `./list`, `./matrix`, `./separator`, `./slot`, `./table`, `./toggle`, `./typography`, `./wrappers`, `./dataTable`.

### Layout namespace

`Layout` экспортирован НЕ как single component — это **namespace через web-core**: `Ui.Layout.Grid`, `Ui.Layout.Flex`, `Ui.Layout.Matrix`. Сборка namespace происходит в `web-core/src/ui-kit/imports.tsx`.

### Matrix v2 — rows-engine + presets + DnD (BREAKING v0.7.0, 2026-05-23)

**API:** discriminated union `{ rows: IRow[] } | { preset: P; slots: LayoutPresets[P] }`.

**Two modes:**
1. **Preset mode:** `preset="app-shell"` + typed `slots={{ header?, sidebar?, main, rightBar?, footer? }}`
2. **Raw rows mode:** explicit `rows: IRow[]` for full control

**IRow/ICell structure:**
- Row: `id?`, `height?: number | 'auto' | 'fr'`, `resizable?: boolean`, `cells: ICell[]`
- Cell: `id`, `children`, `tag?`, `width?: number | 'auto' | 'fr'`, `resizable?`, `draggable?`, `swapGroup?`

**SlotValue (preset-mode):**
- Either `JSX.Element` or `{ children, initialSize?, minSize?, maxSize?, draggable?, swapGroup? }`

**DnD (swap mode, Phase 1.2 v2):**
- Badge-triggered UX: cell registered as `disabled: true` draggable, badge calls `dnd.startDrag()` programmatically
- 2-stage drop highlight (z-30 overlay): soft (canAccept) → strong (canDrop)
- **Badge visible only when 2+ draggable+resizable cells in same swapGroup** (no point swapping if 1 cell)
- Default swapGroups from preset: header/footer → `'band'`, sidebar/rightBar → `'aside'`, main → undefined
- `swapGroup` override in SlotValue expands zone to any cells with same group
- `onLayoutChange` fires `{ kind: 'swap', a, b }` after drop
- DnD integration via `@capsuletech/web-dnd` (createDraggable + createDroppable)

**Resize persist (session-only):**
- `sizesSnapshot` mutable object in `MatrixContent`, keyed by `"v"` (vertical) + `"h:<rowKey>"` (per-row horizontal)
- Guards against corvu cleanup-time calls where Panel unmount fires onSizesChange with shrinking arrays
- Guard: `if (prev !== undefined && sizes.length < prev.length) return;`

**Props:**
- `dndMode?: 'swap' | 'insert'` (default: `'swap'`)
- `layoutMode?: 'view' | 'edit'` (default: `'view'` — uncontrolled local signal also available)
- `onLayoutChange?: (e: LayoutChangeEvent) => void`
- `animated?: boolean | AnimateVariant`

**Preset `'app-shell'` (built-in):**
- Auto-centroid when only `main` slot provided
- Middle-row height auto-computed: `1 - footerInitialSize` or `'fr'` if no footer
- Sidebar/rightBar default width: 0.2
- Footer default height: 0.3
- Main width: remainder of `1 - sidebarWidth - rightBarWidth`

Migration from v0.3.0: `slots={{ header, main, rightBar, footer }}` → `preset="app-shell" slots={{ header, main, rightBar, footer }}`

**Это контракт.** Изменение API Matrix — breaking change для всех consumer'ов (currently только sandbox).

### List — три режима (2026-05-21)

`Ui.List` теперь поддерживает три режима:

1. **Render-prop (classic):** `items={array} children={(item, idx) => JSX}` — прежний render-prop паттерн. Рендерит `<div>`.
2. **Batch mode (новый):** `data={array} as={Component} itemProps?={(item) => propsObj}` — Shape-first; `<For>` внутри, рендерит `<ul>`.
3. **Semantic:** просто `children` (plain JSX) — рендерит `<ul>`.

Backward compat: существующий код с `items + children` продолжает работать.

### DataTable — infinite scroll + IColumn (2026-05-21)

**Новый prop `infinite`:**
- `infinite?: boolean | { itemHeight?, overscan?, threshold? }` — opt-in virtual scroll через `@tanstack/solid-virtual`.
- По умолчанию: `itemHeight: 36, overscan: 5, threshold: 5`.
- Когда включён — `pagination` игнорируется на уровне TanStack Table.

**Новый callback `onLoadMore?: () => void`:**
- Триггерится когда виртуализатор доходит до последних `threshold` строк.
- Server-side pagination / "load more" pattern.

**Новый тип `IColumn<TData>`:**
- `accessorKey` сужен до `keyof TData & string` (не просто `string`).
- `IDataTableProps.columns` принимает `IColumn<TData>[]` вместо `ColumnDef<TData>[]`.
- Экспортируется из barrel'я: `import type { IColumn } from '@capsuletech/web-ui'`.

**`pagination` — deprecated (не удалён):**
- Продолжает работать для маленьких датасетов когда `infinite` не задан.
- Для больших датасетов предпочитать `infinite`.

## Quirks / gotchas

- **Matrix v2 corvu shrinking-array guard** — when Panel unmounts during swap, corvu fires onSizesChange with decreasing array length. `MatrixContent.saveSizes()` rejects updates where `sizes.length < prev.length` to avoid overwriting valid state with partial data. See `matrix.tsx:343-349`.

- **Matrix v2 no setPointerCapture** — pointer capture redirects `document.elementFromPoint()` to always return the captured element, breaking droppable hit-test in `findDroppableAt`. Window-level `pointermove`/`pointerup` listeners only (`dnd/context.tsx:167-171`).

- **Matrix v2 canvas snapshot for overlay** — WebGL canvas (e.g. maps) doesn't copy pixel buffer via `cloneNode()`. Fallback: `toDataURL()` with try/catch; if `preserveDrawingBuffer: false`, produces empty/tainted canvas, fallback to slate placeholder (`#94a3b8`). See `dnd/context.tsx:277-309`.

- **Storybook требует свои devDeps** — `@tailwindcss/vite`, `vite-tsconfig-paths`, `storybook`, `storybook-solidjs-vite`. Если `pnpm storybook:ui` падает на `Cannot find package` — добавь missing dep в `devDependencies`, **не** quick-fix через global install.

- **Matrix middle row `style={{height: '100%', width: '100%'}}`** — не `flex-1` / `h-full`. corvu Panel parent имеет `display: block`, поэтому `flex-1` collapses до content size. Inline-style надёжнее. Если будет рефактор — сохрани этот паттерн.

- **`class-variance-authority`** — в **direct dependencies**, не peer. cva вызывается на runtime внутри primitives, поэтому запекаем в каждый user'ский bundle. Это **dual-package hazard** на чистом ESM, но cva stateless — два экземпляра не конфликтуют.

- **`@kobalte/core`, `@tanstack/solid-virtual`, `@tanstack/solid-table`** — **peer dependencies** (singleton runtime). User должен иметь их в node_modules через CLI app template (`auto-install-peers=true`). `@tanstack/solid-table` также добавлен в devDependencies для Storybook stories (примеры с `createSolidTable`, sorting, pagination, row-selection).

- **`@corvu/resizable`** — в dependencies (запекается в dist). Внутреннее использование в Flex resize режиме (`flex/_resize/primitives.tsx`).

- **`lucide-solid`** — devDependency only. Используется в `_mocks.tsx` для storybook icons. НЕ в production dist.

- **Все primitives stateless.** Никаких signal'ов или effect'ов в самих компонентах. State держится в Controller через UiProxy (web-core).

- **Polymorphic через Slot.** Через Kobalte's Polymorphic system. `<Button as="a" href="...">` валиден если CVA-настройки совпадают. Не делаем custom Slot — используем Kobalte.

- **Resizable namespace deprecated.** Раньше был `wrappers/resizable/`. Сейчас в `flex/_resize/` (internal). Public — через `<Flex resizable items={...}>` или `Ui.Layout.Matrix`. `Ui.Resizable` остался alias на `Flex` для backwards compat.

## План рефакторинга / оптимизаций

- [ ] **Завести `docs/_meta/web-ui.md` AI anchor** — без него Claude-инстансы перечитывают весь README. (priority: high)
- [ ] **Покрытие unit-тестами** — сейчас опираемся на Storybook visual + capsule-test smoke. Unit-тестов для CVA variants практически нет. (priority: medium)
- [ ] **Vitest Solid transform** — `vitest.config.ts` не конфигурирует `vite-plugin-solid`, поэтому `.tsx` файлы (JSX) нельзя импортировать в тестах. Нужно добавить `plugins: [solidPlugin()]` в vitest config чтобы разблокировать DOM-рендер тесты для Table (createSolidTable smoke) и других compound primitives. (priority: medium)
- [ ] **Visual regression через Chromatic / Playwright** — Storybook есть, но visual diff'ы не запускаются. (priority: low)
- [ ] **A11y audit primitives** — Kobalte даёт базу, но Card / Field / Layout — наши, требуют проверки. (priority: medium)
- [x] **Layout → Matrix rename + namespace** — Grid/Flex/Matrix объединены под `Ui.Layout` (2026-05-20).
- [x] **Flex получил resize mode** — corvu wrapped, deprecate'нул отдельный Resizable (2026-05-20).
- [x] **Matrix.slot() helper удалён** — symbol-brand discriminator на inline objects (2026-05-20).
- [x] **Matrix.SlotValue → только IResizableSlotConfig** — JSX-shorthand удалён, union убран, IDE-autocomplete исправлен (2026-05-21).
- [x] **List batch mode** — `data + as + itemProps` opt-in; backward compat сохранён (2026-05-21).
- [x] **DataTable infinite scroll** — `@tanstack/solid-virtual` virtualizer, `onLoadMore` callback, `IColumn<TData>` typed wrapper (2026-05-21).
- [x] **Table scroll context removed (BREAKING v0.5.0, 2026-05-22)** — `overflow-auto scrollbar-hover` убраны из wrapper'а `Table` primitive. Scroll context теперь ответственность parent'а. Standalone `<Table>` без outer scroll container — оберни в `<div class="overflow-auto">`. `DataTable` infinite mode (`InfiniteTable`) имеет собственный `overflow-auto` для виртуализации — не затронут.
- [x] **Navigation primitive removed (BREAKING v0.6.0, 2026-05-22)** — `Ui.Navigation`, `Ui.NavigationList`, `Ui.NavigationItem` удалены. Используй `Ui.List` batch mode (`data + as + itemProps`) с `as: Ui.Button` для навигационных flows. Subpath `./navigation` удалён из `package.json`. Parallel: owner-web-core unregister'ит `Ui.Navigation` из imports.tsx.
- [x] **Design tokens migration (Phase 2)** — все primitives + composites переведены на design-system tokens (2026-05-22).
  - Button: `px-button py-1.5` (sm: `px-button-sm py-cell-tight`, lg: `px-button-lg py-button`) — default vertical padding tightened from `py-button-sm` (8px) to `py-1.5` (6px) for more compact UI rhythm. 2026-05-28.
  - Input: `px-input py-input` — density-aware, убрано `h-9` fixed height.
  - Card parts: `px-card pb-card / py-card-tight` — density-aware card padding.
  - Table.Head / Table.Cell: `px-cell py-cell-tight` — плотность стола управляется density.
  - Navigation item: `px-button py-cell` (sm) / `px-button-lg py-cell-loose` (lg).
  - List items: `px-cell py-cell-tight`.
  - Matrix slots: `px-layout py-component` / `p-component` / `p-layout` — убраны `px-[--layout-padding]` arbitrary.
  - DataTable toolbar/pagination gaps: `mb-component` / `mt-component`.
  - Typography: текстовые классы `text-4xl/3xl/base/xl` + `leading-tight/normal/relaxed`.
  - Transitions: везде `transition-colors duration-fast` (= `--motion-fast: 150ms`), убрано `duration-200` и `transition-all`.
  - Radii: унифицированы — Button = `rounded-md`, Card = `rounded-lg` (раньше `rounded-xl`).
  - Storybook: добавлен **density toolbar** (`default / compact / comfortable`) — переключает `.compact`/`.comfortable` на `<html>`.
  - Typography variants: мигрированы с `--font-size-h1/h2/p` старых aliases на `text-4xl/3xl/base` Tailwind.

## Test coverage

| Тип | Где | Что покрывает |
|---|---|---|
| Stories | `src/primitives/**/*.stories.tsx` | visual + interactive по всем primitives и variants |
| Stories | `src/composites/dataTable/dataTable.stories.tsx` | Basic / WithSorting / WithPagination / WithPaginationCustomSize / WithSelection / WithToolbar / Full / EmptyState / EmptyStateDefault / WithInfinite / WithInfiniteCustomHeight / WithInfiniteLoading |
| Unit | `src/primitives/layout/matrix/__tests__/normalizeSlot.test.ts` | normalizeSlot: undefined/null/object-form/resizable/type-level |
| Unit | `src/primitives/table/__tests__/table.test.ts` | interface structural contracts, data-state sentinel documentation (7 tests). Full DOM/render coverage pending vitest Solid transform (see backlog). |
| Unit | `src/primitives/list/__tests__/list.test.ts` | IListRenderProps / IListBatchProps / IListSemanticProps / IListProps union / IVirtualListProps structural contracts (18 tests). |
| Unit | `src/composites/dataTable/__tests__/dataTable.test.ts` | IDataTableProps structural contracts, IColumn typed wrapper, ColumnDef re-export, infinite options, onLoadMore callback, pagination defaults (18 tests). Full DOM/render coverage pending vitest Solid transform. |
| E2E (косвенно) | `packages/cli/e2e/smoke.mjs` | bootstrap + базовый рендер через capsule-test |

**Перед изменением primitive contract'а:**
1. `pnpm storybook:ui` — open `http://localhost:6006/`, visual smoke.
2. `pnpm --filter @capsuletech/web-ui build` — green.
3. Capsule-test app (e.g. `ewc-client`) рендерит без 503/runtime-error.

## Cross-package dependencies

| Зона | Owner |
|---|---|
| Theme tokens, createStyle, cn, merge | owner-web-style |
| `Ui.*` namespace registry (lazy imports) | owner-web-core |
| Slot Polymorphic (Kobalte adapter) | owner-web-style |
| Wrapper definitions (Entity/Widget/Page) | owner-web-core |
| Storybook viewerFinal config | owner-builders (если использует vite-builder plugins) |

## Release group

`web_base` (fixed): web-core + web-dnd + web-ui-creator + web-profiler + web-query + web-remote + web-renderer + web-router + web-state + web-style + web-ui + shared-zod.

После изменений web-ui — координировать release через главного (`pnpm release:local:web` или `--group=all`).

Связанные:
- `docs/_meta/web-ui.md` — AI-anchor (когда заведём).
- Storybook на `http://localhost:6006/` — live доки.
