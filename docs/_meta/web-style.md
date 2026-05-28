---
tags: [meta, web-style]
updated: 2026-05-22
---

# web-style AI anchor

Quick orientation for Claude instances working in `packages/web/style/`.

## Owner prompt

Full context: `.claude/agents/owner-web-style.md` (system prompt of owner agent).

## Key files

| File | Role |
|---|---|
| `src/index.css` | Design token scales (spacing, typography, radii, motion) + `@theme inline` Tailwind mappings + base styles |
| `src/index.ts` | Barrel: createStyle, cn, merge, STATUS_VARIABLES + state-stores (v0.2.0+: useTheme, useDarkMode, useLayoutMode, setters, DISCOVERED_THEMES, DENSITY_PRESETS) |
| `src/createStyle.ts` | CVA wrapper (reactive, getter-based) |
| `src/constants.ts` | STATUS_VARIABLES (success/warning/error/info) |
| `src/utils.ts` | cn (clsx+tailwind-merge), merge (deep style merger) |
| `src/theme-store.ts` | State-only stores (useTheme, useDarkMode, useLayoutMode, setters, constants). Module-level apply on import. |
| `src/editor/` | ThemeEditor (subpath /editor, separate bundle) |
| `src/themes/` | CSS theme files (CSS vars, OKLCH palette) — colors + fonts + radius anchor + `--spacing` + `--tracking-normal` |
| ~~`src/switcher/`~~ | ThemeSwitcher component **moved to web-ui** (v0.2.0+, PR #176) |

## Design token architecture (Phase 1, 2026-05-22)

All non-color tokens live in `src/index.css :root`. Themes set color variables + `--radius` + `--spacing` + `--tracking-normal` only.

### Naming conventions

- Raw spacing scale: `--space-{0..8}` (geometric, 0.25rem base)
- Semantic spacing: `--space-cell`, `--space-button`, `--space-input`, `--space-field`, `--space-card`, `--space-section`, `--space-layout`, `--space-component`, `--space-container`
- Font sizes: `--font-size-{xs|sm|base|lg|xl|2xl|3xl|4xl|5xl}` — named `--font-size-*` (not `--text-*`) to avoid collision with Tailwind `@theme inline --text-*`
- Line heights: `--leading-{none|tight|snug|normal|relaxed|loose}`
- Radii: `--radius-{xs|sm|md|lg|xl|2xl|3xl|full}` — calculated from per-theme `--radius` anchor
- Motion durations: `--motion-{instant|fast|normal|slow|slower}`
- Motion easings: `--ease-{linear|in|out|in-out|spring|bounce}`
- Compound transitions: `--transition-{colors|opacity|transform|shadow|all}`

### Density system

`--density: 1` in `:root`. `.compact` sets `--density: 0.75`, `.comfortable` sets `--density: 1.25`. All semantic spacing tokens are `calc(--space-{n} * var(--density))`.

### Backward compat aliases (Phase 2 migration pending)

Old names still resolve: `--spacing-base/layout/component/container`, `--layout-padding`, `--component-padding`, `--text-base-size`, `--font-size-h1/h2/p`, `--transition-ui`.

## @source path design (pnpm-aware)

`src/index.css` ships raw to `dist/index.css` (no Tailwind processing at build time). Apps process it via `@tailwindcss/vite` at app build time.

**Critical**: Tailwind v4 resolves `@source` paths relative to the **real (symlink-followed) path** of the CSS file. With pnpm isolated node_modules, the real path is:

```
.pnpm/@capsuletech+web-style@X.Y.Z_<hash>/node_modules/@capsuletech/web-style/dist/
```

This is 6 directories deep inside `node_modules/`. The `@source` entries use two depth variants:

- `../../<pkg>/dist/**/*.mjs` — npm flat node_modules (2 levels up → `node_modules/@capsuletech/`)
- `../../../../../../@capsuletech/<pkg>/dist/**/*.mjs` — pnpm store (6 levels up → root `node_modules/`)

For app source files:
- `../../../../apps/*/src/**/*.{ts,tsx}` — npm (4 levels up → project root)
- `../../../../../../../apps/*/src/**/*.{ts,tsx}` — pnpm (7 levels up → project root)

The Scanner silently ignores non-existent paths, so both variants are safe.

**Why dist/*.mjs not src/*.tsx**: `src/` is not available in published packages. Only `dist/` ships. The `.mjs` built files retain class name strings that Tailwind's scanner can extract.

## Known gotchas

1. `createStyle` takes **getters** (`() => props.variant`), not values. Direct values read only once at render and never update reactively.
2. `/editor` subpath — separate bundle (~50kb gzip). Do NOT import in main barrel.
3. `cn` = clsx + tailwind-merge — deduplicates conflicting utilities.
4. All `@source` paths scan `dist/**/*.mjs`, not `src/**/*.{ts,tsx}` — src is not published.
5. Adding a new `@capsuletech/web-*` sibling → add both npm and pnpm `@source` paths in `index.css`.

## Font assets

Fonts are loaded via `@fontsource-variable/*` runtime deps — 7 packages, one per font family. They are `@import`-ed at the top of `src/index.css` before any `@theme` directives.

`@layer base` in `src/index.css` sets:

```css
body { font-family: var(--font-sans, ui-sans-serif, system-ui, sans-serif); }
```

Themes set `--font-sans` using the `Variable` suffix name so the variable font is picked up:

```css
--font-sans: 'Inter Variable', 'Inter', ui-sans-serif, system-ui, sans-serif;
```

**To add a new font:**
1. `pnpm add @fontsource-variable/<name> --filter @capsuletech/web-style`
2. Add `@import '@fontsource-variable/<name>';` at the top of `src/index.css`
3. Set `--font-sans: '<Name> Variable', '<Name>', <fallback>;` in the target theme CSS

The 7 current fonts: Inter, Geist, DM Sans, Nunito, Plus Jakarta Sans, Bricolage Grotesque, Montserrat. See `OWNERSHIP.md` for the theme-to-font mapping.

## State stores (v0.2.0+, PR #176)

Module-level reactive state (Solid signals). Applied on import, no onMount flicker.

```ts
import { useTheme, setTheme, useDarkMode, toggleDarkMode, useLayoutMode, setLayoutMode, toggleLayoutMode, DISCOVERED_THEMES, DENSITY_PRESETS } from '@capsuletech/web-style';

// In Feature/Controller/Widget
const theme = useTheme();            // signal: current theme name
setTheme('dark');                    // Solid Batch: updates theme + data-theme on <html>

const dark = useDarkMode();          // signal: boolean
toggleDarkMode();                    // Solid Batch: toggles + updates data-theme

const mode = useLayoutMode();        // signal: 'view' | 'edit'
setLayoutMode('edit');               // Solid Batch: updates mode (used for Matrix DnD gating)

// Constants
DISCOVERED_THEMES;   // { theme-name: { colors: {...}, fonts: {...} }, ... }
DENSITY_PRESETS;     // { compact: 0.75, comfortable: 1.25 }
```

**Why module-level:** Themes apply globally to `<html>` via CSS variables. Solid signals ensure reactive updates without re-render of entire app. No Provider needed — side effect of `import`.

## Changelog

### 0.2.1 — Motion tokens tuned (2026-05-28)

**`--motion-fast`** 150ms → **200ms**, **`--motion-normal`** 250ms → **320ms**. Reasoning:
- `--motion-fast` feeds Tailwind `duration-fast` utility (List items hover, Toggle, Input border, Table rows hover, Typography hover).
- `--motion-normal` feeds `--transition-all` → `--transition-ui` → **global rule `button, input, a { transition: var(--transition-ui) !important; }` in `index.css`** (line ~395). Main knob for smoothness of all interactive elements.
- Component `transition-colors duration-fast` in CVA **does not work** on button/input/a (`!important` overrides). Tune `--motion-normal` to affect them.

Precedent: ewc nav hover feedback ("transitions too snappy"). File: `packages/web/style/src/index.css`.

### 0.2.0 — Switcher state vs UI split (2026-05-27)

**Breaking: Visual components moved to web-ui.**

Old: `ThemeSwitcher` + `DarkModeToggle` in web-style.
New: Composites (`DarkModeToggle`, `LayoutModeToggle`, `ThemePicker`) in web-ui; state-stores (`useTheme`, `useDarkMode`, `useLayoutMode`, setters) remain in web-style.

Migration:
```ts
// Before
import { ThemeSwitcher } from '@capsuletech/web-style';
<Ui.ThemeSwitcher />

// After
import type { useTheme, setTheme } from '@capsuletech/web-style';  // for state access if needed
// Use UI from web-ui:
<Ui.DarkModeToggle />
<Ui.LayoutModeToggle />
<Ui.ThemePicker mode='standalone' />  // or mode='sub' for nested
```

Module-level apply on import ensures theme data-attribute is set before first render — no flicker.

### 0.1.1 — @source pnpm fix (2026-05-20)

Changed `@source` directives in `src/index.css`:
- Replaced `src/**/*.{ts,tsx}` paths (source files, not available after publish) with `dist/**/*.mjs` paths.
- Added dual-depth paths: npm-flat (2 levels) + pnpm-store (6 levels) for each sibling package.
- Added previously missing siblings: web-profiler, web-renderer, web-dnd, web-ui-creator, web-query, web-remote, web-router, web-state.
- Added dual-depth paths for app source scanning: npm (4 levels) + pnpm (7 levels).

Root cause: Tailwind v4 follows symlinks when resolving `@source` base paths. The old relative paths (like `../../ui/src/`) were written for the monorepo layout but pointed to non-existent directories inside pnpm's isolated store, so all framework utilities were silently dropped from the final CSS.
