---
tags: [meta, design-system, tokens]
updated: 2026-05-22
---

# Design tokens reference

Source of truth: `packages/web/style/src/index.css`. All tokens are CSS custom properties on `:root`. Themes (`src/themes/*.css`) provide color variables, `--radius`, `--spacing`, and `--tracking-normal` — everything else is theme-independent.

## Spacing

### Raw scale

Base unit: `0.25rem` (4px). Themes can override `--spacing` (Tailwind base unit) — most use `0.25rem`, pasteelement uses `0.27rem`.

| CSS property | Value | px |
|---|---|---|
| `--space-0` | 0 | 0 |
| `--space-1` | 0.25rem | 4 |
| `--space-2` | 0.5rem | 8 |
| `--space-3` | 0.75rem | 12 |
| `--space-4` | 1rem | 16 |
| `--space-5` | 1.5rem | 24 |
| `--space-6` | 2rem | 32 |
| `--space-7` | 3rem | 48 |
| `--space-8` | 4rem | 64 |

### Density system

`--density: 1` on `:root`. Classes on any ancestor element:

| Class | `--density` |
|---|---|
| (none) | 1 |
| `.compact` | 0.75 |
| `.comfortable` | 1.25 |

All semantic spacing tokens multiply by `--density` via `calc()`.

### Semantic spacing tokens (density-aware)

Components reference these, not the raw scale.

| Token | Raw base | Role |
|---|---|---|
| `--space-cell-tight` | `--space-2` | tight cell padding (tables, lists) |
| `--space-cell` | `--space-3` | default cell padding |
| `--space-cell-loose` | `--space-4` | loose cell padding |
| `--space-button-sm` | `--space-2` | small button padding |
| `--space-button` | `--space-3` | default button padding |
| `--space-button-lg` | `--space-4` | large button padding |
| `--space-input` | `--space-3` | input field padding |
| `--space-field` | `--space-2` | field label / helper gap |
| `--space-card` | `--space-5` | card padding |
| `--space-card-tight` | `--space-4` | tight card padding |
| `--space-section` | `--space-6` | section vertical spacing |
| `--space-layout` | `--space-4` | layout region padding |
| `--space-component` | `--space-3` | component internal padding |
| `--space-container` | `--space-3` | container padding |

### Tailwind spacing utilities

`p-1` = `1 × --spacing`. With `--spacing: 0.25rem`, `p-4` = `1rem`. Semantic spacing available as `p-cell`, `p-button`, `p-card`, etc. via `@theme inline`.

### Backward compat (until Phase 2)

`--spacing-base` → `--space-4`, `--spacing-layout` → `--space-layout`, `--spacing-component` → `--space-component`, `--spacing-container` → `--space-container`, `--layout-padding` → `--space-layout`, `--component-padding` → `--space-component`.

---

## Typography

### Font sizes

Named `--font-size-*` to avoid colliding with Tailwind's `@theme inline --text-*` namespace.

| CSS property | Value | px | Tailwind utility |
|---|---|---|---|
| `--font-size-xs` | 0.75rem | 12 | `text-xs` |
| `--font-size-sm` | 0.875rem | 14 | `text-sm` |
| `--font-size-base` | 1rem | 16 | `text-base` |
| `--font-size-lg` | 1.125rem | 18 | `text-lg` |
| `--font-size-xl` | 1.25rem | 20 | `text-xl` |
| `--font-size-2xl` | 1.5rem | 24 | `text-2xl` |
| `--font-size-3xl` | 1.875rem | 30 | `text-3xl` |
| `--font-size-4xl` | 2.25rem | 36 | `text-4xl` |
| `--font-size-5xl` | 3rem | 48 | `text-5xl` |

### Line heights

| CSS property | Value | Tailwind utility |
|---|---|---|
| `--leading-none` | 1 | `leading-none` |
| `--leading-tight` | 1.2 | `leading-tight` |
| `--leading-snug` | 1.375 | `leading-snug` |
| `--leading-normal` | 1.5 | `leading-normal` |
| `--leading-relaxed` | 1.7 | `leading-relaxed` |
| `--leading-loose` | 2 | `leading-loose` |

### Letter spacing

Relative to per-theme `--tracking-normal` (fallback: `0em`). Themes that use a non-zero base (e.g. zen: `0.01em`, deepPurple: `-0.02em`) shift the entire scale.

| CSS property | Offset | Tailwind utility |
|---|---|---|
| `--tracking-tighter` | `--tracking-normal - 0.05em` | `tracking-tighter` |
| `--tracking-tight` | `--tracking-normal - 0.025em` | `tracking-tight` |
| `--tracking-normal` | per-theme (default `0em`) | `tracking-normal` |
| `--tracking-wide` | `--tracking-normal + 0.025em` | `tracking-wide` |
| `--tracking-wider` | `--tracking-normal + 0.05em` | `tracking-wider` |
| `--tracking-widest` | `--tracking-normal + 0.1em` | `tracking-widest` |

### Backward compat (until Phase 2)

`--text-base-size` → `--font-size-base`. `--font-size-h1` → `--font-size-base × 2.5`. `--font-size-h2` → `--font-size-base × 2`. `--font-size-p` → `--font-size-base`.

---

## Radii

Anchored to per-theme `--radius` (fallback: `0.5rem`). Adding a theme with a different base radius changes the whole scale automatically.

| CSS property | Formula | Tailwind utility |
|---|---|---|
| `--radius-xs` | `--radius - 6px` | `rounded-xs` |
| `--radius-sm` | `--radius - 4px` | `rounded-sm` |
| `--radius-md` | `--radius - 2px` | `rounded-md` |
| `--radius-lg` | `--radius` | `rounded-lg` |
| `--radius-xl` | `--radius + 4px` | `rounded-xl` |
| `--radius-2xl` | `--radius + 8px` | `rounded-2xl` |
| `--radius-3xl` | `--radius + 16px` | `rounded-3xl` |
| `--radius-full` | 9999px | `rounded-full` |

---

## Motion

### Duration

| CSS property | Value | Tailwind utility |
|---|---|---|
| `--motion-instant` | 75ms | `duration-instant` |
| `--motion-fast` | 150ms | `duration-fast` |
| `--motion-normal` | 250ms | `duration-normal` |
| `--motion-slow` | 400ms | `duration-slow` |
| `--motion-slower` | 600ms | `duration-slower` |

### Easing

| CSS property | Curve | Tailwind utility |
|---|---|---|
| `--ease-linear` | `linear` | `ease-linear` |
| `--ease-in` | `cubic-bezier(0.4, 0, 1, 1)` | `ease-in` |
| `--ease-out` | `cubic-bezier(0, 0, 0.2, 1)` | `ease-out` |
| `--ease-in-out` | `cubic-bezier(0.4, 0, 0.2, 1)` | `ease-in-out` |
| `--ease-spring` | `cubic-bezier(0.5, 1.25, 0.75, 1.25)` | `ease-spring` |
| `--ease-bounce` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | `ease-bounce` |

### Compound transitions

Pre-composed for common use cases. Reference as `transition: var(--transition-colors)` in component CSS or in `createStyle`.

| Token | Animates |
|---|---|
| `--transition-colors` | color + background-color + border-color @ fast/ease-out |
| `--transition-opacity` | opacity @ fast/ease-out |
| `--transition-transform` | transform @ normal/ease-out |
| `--transition-shadow` | box-shadow @ fast/ease-out |
| `--transition-all` | all @ normal/ease-out |

`--transition-ui` is a backward compat alias for `--transition-all`.

---

## Adding a new theme

1. Create `packages/web/style/src/themes/<name>.css`.
2. Define `[data-theme="<name>"] { ... }` with all color variables + `--radius`, `--font-*`, `--shadow-*`, `--tracking-normal`, `--spacing`.
3. Optionally add `[data-theme="<name>"].dark, [data-theme="<name>"] .dark { ... }`.
4. Add the same `@theme inline { ... }` block as in other theme files (colors + fonts + shadows + radii + optional tracking scale).
5. Add `@import "./<name>.css";` to `themes/index.css`.
6. Token scales (spacing, motion, line heights) are inherited from `index.css :root` — no duplication needed.

---

## Scrollbar

Defined in `index.css :root`. All scrollable elements get the global thin style automatically. For hover-reveal (hidden until hover), add `.scrollbar-hover` to the scrollable container.

| CSS property | Default value | Role |
|---|---|---|
| `--scrollbar-size` | `6px` | Width (vertical) and height (horizontal) of scrollbar |
| `--scrollbar-thumb` | `var(--border)` | Default thumb color |
| `--scrollbar-thumb-hover` | `var(--muted-foreground)` | Thumb color on `:hover` |
| `--scrollbar-track` | `transparent` | Track background |

### `.scrollbar-hover` utility class

Opt-in hover-reveal: scrollbar is invisible by default, fades in on `:hover` or `:focus-within` of the scrollable container. Uses `transition: background var(--motion-fast) var(--ease-out)` (WebKit) and `transition: scrollbar-color var(--motion-fast) var(--ease-out)` (Firefox).

`scrollbar-gutter: stable` is applied to prevent layout jump when the scrollbar appears.

**Cross-browser:** WebKit (`::-webkit-scrollbar*` pseudo-elements) + Firefox (`scrollbar-color`, `scrollbar-width: thin`).

**Applied by default in web-ui:** `Table` wrapper, `DataTable` infinite scroll container, Matrix `resizeMain/resizeSidebar/resizeAsideRight/resizeHeader/resizeFooter/gridLeft/gridRight` slots.

---

## Adding a new semantic spacing token

1. Add `--space-<name>: calc(var(--space-{n}) * var(--density));` to `:root` in `index.css`.
2. Add `--spacing-<name>: var(--space-<name>);` to `@theme inline` for the Tailwind utility.
3. If it's also needed as a Tailwind shorthand (e.g. `p-<name>`), the `@theme inline` entry handles that automatically.
