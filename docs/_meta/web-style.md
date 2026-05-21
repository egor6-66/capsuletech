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
| `src/index.ts` | Barrel: createStyle, cn, merge, STATUS_VARIABLES, ThemeSwitcher |
| `src/createStyle.ts` | CVA wrapper (reactive, getter-based) |
| `src/constants.ts` | STATUS_VARIABLES (success/warning/error/info) |
| `src/utils.ts` | cn (clsx+tailwind-merge), merge (deep style merger) |
| `src/switcher/` | ThemeSwitcher component |
| `src/editor/` | ThemeEditor (subpath /editor, separate bundle) |
| `src/themes/` | CSS theme files (CSS vars, OKLCH palette) — colors + fonts + radius anchor + `--spacing` + `--tracking-normal` |

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

## Changelog

### 0.1.1 — @source pnpm fix (2026-05-20)

Changed `@source` directives in `src/index.css`:
- Replaced `src/**/*.{ts,tsx}` paths (source files, not available after publish) with `dist/**/*.mjs` paths.
- Added dual-depth paths: npm-flat (2 levels) + pnpm-store (6 levels) for each sibling package.
- Added previously missing siblings: web-profiler, web-renderer, web-dnd, web-editor, web-query, web-remote, web-router, web-state.
- Added dual-depth paths for app source scanning: npm (4 levels) + pnpm (7 levels).

Root cause: Tailwind v4 follows symlinks when resolving `@source` base paths. The old relative paths (like `../../ui/src/`) were written for the monorepo layout but pointed to non-existent directories inside pnpm's isolated store, so all framework utilities were silently dropped from the final CSS.
