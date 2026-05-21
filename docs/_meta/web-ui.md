---
tags: [meta, web-ui]
updated: 2026-05-20
---

# web-ui AI anchor

Quick orientation for Claude instances working in `packages/web/ui/`.

## Owner prompt

Full context: `.claude/agents/owner-web-ui.md` (system prompt of owner agent).
Conventions canon: `docs/09-packages/ui/conventions.md`.
Storybook guide: `docs/09-packages/ui/storybook.md`.

## Changelog (notable breaks)

### 0.2.0 — Layout refactor (2026-05-20)

**Breaking: `variant` prop removed from `<Layout>`.**

Old API (4 variants):
```tsx
<Ui.Layout variant="holy-grail" slots={{ header, left, main, right, footer }} />
<Ui.Layout variant="dashboard"  slots={{ header?, sidebar, main, rightBar? }} />
<Ui.Layout variant="standard"   slots={{ header, main, footer }} />
<Ui.Layout variant="centroid"   slots={{ main }} />
```

New API (single component, 5 optional slots):
```tsx
<Ui.Layout
  slots={{
    main: <X />,         // REQUIRED
    header?: <Y />,
    sidebar?: <Y />,     // left column (replaces "left" from holy-grail)
    rightBar?: <Y />,    // right column (replaces "right" from holy-grail)
    footer?: <Y />,
  }}
/>
```

Migration guide:
- `centroid` → omit all optional slots (only `main`). Auto-centroid mode activates automatically.
- `standard` → `{ header, main, footer }` (same names).
- `dashboard` → `{ header?, sidebar, main, rightBar? }` (same names).
- `holy-grail` → `{ header, sidebar, main, rightBar, footer }` (`left` → `sidebar`, `right` → `rightBar`).

Resize behaviour is unchanged — `Layout.slot({ resizable: true, initialSize, minSize, maxSize })`.

Bug fixed: fixed (non-resizable) header/footer are no longer pushed into the corvu Resizable
group, so `fillInitialSizes` no longer steals height from them.

Deleted files: `standard.tsx`, `dashboard.tsx`, `holy-grail.tsx`, `switch.tsx`.

### 0.4.0 — List batch mode + DataTable infinite scroll (2026-05-21)

**New: `List` batch mode (opt-in, backward compat).**

Three modes now supported:

```tsx
// 1. Render-prop (existing — unchanged)
<List items={array} children={(item, idx) => <div>{item.label}</div>} />

// 2. Batch mode (new) — Shape-first, <For> inside
<List data={array} as={NavItem} itemProps={(item) => ({ label: item.label })} />

// 3. Semantic (new) — plain children, no iteration
<List><li>Home</li><li>Inbox</li></List>
```

Modes 1 & 3 render a `<div>` / `<ul>` respectively. Mode 2 renders `<ul>` with `<For>` iterating over `data`. `items + children` code is unchanged.

**New: `IColumn<TData>` typed column wrapper.**

```ts
import type { IColumn } from '@capsuletech/web-ui';

// accessorKey now constrained to keyof TData & string
const columns: IColumn<IUser>[] = [
  { accessorKey: 'id', header: 'ID' },      // valid
  // { accessorKey: 'unknown', header: 'X' }  ← TS error
];
<DataTable data={users} columns={columns} />
```

`IDataTableProps.columns` accepts `IColumn<TData>[]`. `ColumnDef<TData>[]` still accepted via structural compatibility.

**New: `DataTable` infinite scroll.**

```tsx
// Basic infinite (1000 rows, virtualizer)
<DataTable data={rows} columns={cols} infinite />

// Tuned options
<DataTable data={rows} columns={cols} infinite={{ itemHeight: 48, overscan: 10 }} />

// Server-side load-more
<DataTable
  data={rows()}
  columns={cols}
  infinite={{ threshold: 10 }}
  onLoadMore={handleLoadMore}
/>
```

When `infinite` is active:
- `@tanstack/solid-virtual` `createVirtualizer` renders only visible rows.
- Sticky `<thead>` at top of scroll container.
- `onLoadMore` fires when within `threshold` rows of the end.
- `pagination` prop is ignored (TanStack `getPaginationRowModel` not wired).

Defaults: `itemHeight: 36`, `overscan: 5`, `threshold: 5`.

`pagination` remains working for small datasets (non-deprecated in API; deprecated in JSDoc only).

### 0.5.0 — Table scroll context removed (2026-05-22)

**Breaking: `Table` primitive no longer owns its scroll context.**

Old behaviour: `TableImpl` rendered `<div class="relative w-full overflow-auto scrollbar-hover">` — always created a scroll container.

New behaviour: `<div class="relative w-full">` — no overflow. Scroll is parent responsibility.

Migration for standalone `<Table>` usage (without an outer scrollable parent):
```tsx
// Before (Table self-scrolled)
<Table>...</Table>

// After — wrap in explicit scroll container
<div class="overflow-auto">
  <Table>...</Table>
</div>
```

No change needed when `<Table>` is inside `<Ui.Layout.Matrix>` main slot (already `overflow-auto`), `InfiniteTable` scroll div (its own `overflow-auto`), or any other established scroll container.

`DataTable` non-infinite mode: scroll provided by parent (Matrix main slot / story decorator).
`DataTable` infinite mode (`InfiniteTable`): has its own `overflow-auto` wrapper for virtualizer — unchanged.

Storybook stories updated: `table.stories.tsx` and `dataTable.stories.tsx` decorators now use `<div class="overflow-auto p-4">`.

### 0.3.0 — composites/ category + DataTable (2026-05-21)

**New: `src/composites/` category.** Third category alongside `primitives/` and `wrappers/`.

Purpose: higher-level assembled components with built-in smart-flow (internal `createSignal`).
They encapsulate library deps so Widget code stays clean (no `@tanstack/solid-table` import in Widget).

```
src/
  primitives/   atoms — stateless semantic wrappers
  composites/   assembled higher-level, encapsulate deps (TanStack etc.)
  lib/          internal helpers
```

**New: `DataTable` composite.**

```ts
import { DataTable } from '@capsuletech/web-ui';
import type { ColumnDef } from '@capsuletech/web-ui'; // re-exported from @tanstack/solid-table

<DataTable
  data={users}
  columns={columns}
  sorting                      // opt-in: getSortedRowModel + ↑/↓/↕ icons
  pagination={{ pageSize: 5 }} // opt-in: getPaginationRowModel + Prev/Next controls
  selection                    // opt-in: getFilteredSelectedRowModel
  filtering                    // opt-in: getFilteredRowModel (global filter)
  emptyMessage="No users."     // shown when data.length === 0
  toolbar={<Input ... />}      // rendered above table (consumer controls signal)
/>
```

All opt-in features default off. Each feature is an independent prop — adding future props (column resizing, virtualization, group/expand rows) won't break existing API.

Subpath export: `@capsuletech/web-ui/dataTable`.

### 0.3.0 — Matrix SlotValue union removed (2026-05-21)

**Breaking: JSX-shorthand slot form removed.**

Old API (union — JSX shorthand worked):
```tsx
slots={{ main: <X />, header: <Y /> }}
```

New API (only object form):
```tsx
slots={{ main: { children: <X /> }, header: { children: <Y /> } }}
```

Migration: wrap every bare JSX slot in `{ children: ... }`.

Why: `SlotValue = IResizableSlotConfig | JSX.Element` broke TS narrowing — IDE offered `Node.children` (HTMLCollection) instead of `resizable`/`initialSize`/etc. Removing the union fixes autocomplete without a factory helper.

Also removed: `declare const __slotConfigBrand: unique symbol` + `readonly [__slotConfigBrand]?: true` from `IResizableSlotConfig` (symbol-brand was invisible in autocomplete and optional — it didn't actually discriminate).

`normalizeSlot` in `utils.ts` is now a simple identity-with-default: no `typeof slot === 'object'` branch needed.
