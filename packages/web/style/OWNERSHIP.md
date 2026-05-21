---
name: "@capsuletech/web-style"
owner-agent: owner-web-style
group: web_base
status: pre-1.0
last-updated: 2026-05-22
---

# @capsuletech/web-style

Styling-слой capsule: 11 design-system theme'ов (CSS-variables), полная система design tokens (spacing, typography, radii, motion), runtime helpers (createStyle, cn, merge), ThemeSwitcher/ThemeEditor компоненты. **Не** Tailwind entry-point — entry живёт в app's `.capsule/styles.css` (builders scaffold).

## Зона ответственности

### Owns

- `packages/web/style/src/themes/*.css` — 11 themes (black, damon, deepPurple, lightGreen, minimalNeutral, openprofile, pasteelement, shopifyRed, tiesen, vescrow, zen) + `themes/index.css` barrel.
- `packages/web/style/src/index.css` — design token scales + `@theme inline` Tailwind mappings. Главный CSS entry.
- `packages/web/style/src/createStyle.ts` — CVA wrapper.
- `packages/web/style/src/cn.ts`, `merge.ts` — class-name utilities.
- `packages/web/style/src/constants.ts` — STATUS_VARIABLES и подобные tokens.
- `packages/web/style/src/editor/` — ThemeSwitcher, ThemeEditor компоненты (subpath `./editor`).
- **Scrollbar styling** — global thin WebKit/Firefox scrollbar + `.scrollbar-hover` opt-in hover-reveal utility (defined in `src/index.css`). Tokens: `--scrollbar-size`, `--scrollbar-thumb`, `--scrollbar-thumb-hover`, `--scrollbar-track`.
- `packages/web/style/vite.config.mts` — build config + `copy-css` plugin.
- `packages/web/style/package.json` — exports.

## Design tokens (Phase 1 — 2026-05-22)

Все токены живут в `src/index.css`. Структура:

### Spacing scale (`--space-{n}`)

Geometric scale, base `0.25rem` (4px). Компоненты **не используют** raw scale напрямую — используют semantic tokens.

| Token | Value | px |
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

`--density: 1` (default). Все semantic spacing tokens умножаются на `--density`.

| Class | `--density` | Effect |
|---|---|---|
| (none) | 1 | default |
| `.compact` | 0.75 | 25% tighter |
| `.comfortable` | 1.25 | 25% looser |

### Semantic spacing tokens (density-aware)

Компоненты ссылаются на эти токены. `--space-cell`, `--space-button`, `--space-input`, `--space-field`, `--space-card`, `--space-section`, `--space-layout`, `--space-component`, `--space-container`.

### Typography scale (`--font-size-{n}`)

Named `--font-size-*` (not `--text-*`) to avoid collision with Tailwind's `@theme inline --text-*` namespace.

| Token | Value | px |
|---|---|---|
| `--font-size-xs` | 0.75rem | 12 |
| `--font-size-sm` | 0.875rem | 14 |
| `--font-size-base` | 1rem | 16 |
| `--font-size-lg` | 1.125rem | 18 |
| `--font-size-xl` | 1.25rem | 20 |
| `--font-size-2xl` | 1.5rem | 24 |
| `--font-size-3xl` | 1.875rem | 30 |
| `--font-size-4xl` | 2.25rem | 36 |
| `--font-size-5xl` | 3rem | 48 |

Line heights: `--leading-none/tight/snug/normal/relaxed/loose`.

### Radii scale

Anchored to per-theme `--radius`. Full scale: `--radius-xs` through `--radius-3xl` + `--radius-full: 9999px`.

### Motion tokens

Duration: `--motion-instant(75ms)`, `--motion-fast(150ms)`, `--motion-normal(250ms)`, `--motion-slow(400ms)`, `--motion-slower(600ms)`.

Easing: `--ease-linear/in/out/in-out/spring/bounce`.

Compound: `--transition-colors`, `--transition-opacity`, `--transition-transform`, `--transition-shadow`, `--transition-all`.

### Tailwind v4 `@theme inline` mappings

| Tailwind utility | Maps via `@theme inline` to |
|---|---|
| `p-1`, `m-2`, `gap-3`, etc. | `--spacing: var(--spacing)` (per-theme, default 0.25rem) |
| `p-cell`, `p-button`, etc. | semantic `--spacing-cell`, `--spacing-button`, etc. |
| `text-xs` … `text-5xl` | `--text-{n}: var(--font-size-{n})` |
| `leading-tight` … `leading-loose` | `--leading-{n}: var(--leading-{n})` |
| `tracking-tight` … `tracking-widest` | relative to per-theme `--tracking-normal` |
| `rounded-xs` … `rounded-full` | `--radius-{n}: var(--radius-{n})` |
| `duration-instant` … `duration-slower` | `--duration-{n}: var(--motion-{n})` |
| `ease-in`, `ease-spring`, etc. | `--ease-{n}: var(--ease-{n})` |

### Backward compat aliases (until Phase 2 migration)

These stay in `:root` so existing primitives don't break:
- `--spacing-base`, `--spacing-layout`, `--spacing-component`, `--spacing-container` → new space tokens
- `--layout-padding`, `--component-padding` → `--space-layout` / `--space-component` (used by matrix variants)
- `--text-base-size`, `--font-size-h1`, `--font-size-h2`, `--font-size-p` → new font-size tokens
- `--transition-ui` → `--transition-all`

### Не трогает

- Tailwind entry-point (`@import "tailwindcss"`) — живёт в app's `.capsule/styles.css.template` (builders scaffold). Owner: `owner-builders`.
- UI primitives — `owner-web-ui`.
- Root-level configs (главный assistant).
- `apps/*/` (user scope).

## Публичный API

```ts
// Runtime helpers
import { createStyle, cn, merge, STATUS_VARIABLES } from '@capsuletech/web-style';

// Theme editor / switcher
import { ThemeSwitcher, ThemeEditor } from '@capsuletech/web-style/editor';
```

### Subpath exports

- `.` — main runtime helpers + types.
- `./editor` — Theme components.
- `./css` — **deprecated stub**. Пустой файл для backwards compat. NEW projects не должны импортить.
- `./themes` — bundled barrel (`themes/index.css` → импортит все 11 individual files).
- `./themes/*` — individual theme CSS files (e.g. `./themes/black.css`).

**Это контракт.** Изменение themes API (variable names) или createStyle сигнатуры — breaking change для всех primitives и user-themes.

## Quirks / gotchas

- **Themes должны быть БЕЗ Tailwind directives.** Никаких `@import "tailwindcss"` или `@layer base { @apply ... }` блоков в `themes/*.css`. **Только** `:root[data-theme="..."] { --background: ...; ... }` variables. Если случайно вернётся — будут duplicate base rules в bundled CSS (~100 копий box-sizing rule). Этот баг **уже** ловили (2026-05-20).

- **`themes/index.css` — barrel imports.** `@import "./black.css"; @import "./damon.css"; ...` Любой новый theme — добавь сюда.

- **vite.config.mts `copy-css` plugin.** Копирует raw CSS файлы в dist **без Tailwind processing**. Tailwind processит уже на стороне app's vite-builder. Это правильно — single Tailwind context на всё приложение.

- **`createStyle` — CVA wrapper.** Возвращает `{ className, style }` сигнатуру. Не плющим как `String` (теряем style attr для inline overrides).

- **`./css` subpath deprecated.** Остался как пустой stub. Раньше там жил Tailwind entry-point со всеми `@source` directives — переехало в app's `.capsule/styles.css`. Когда CI smoke fixture стабилизируется, можно удалить subpath полностью.

- **`@source` paths больше не наша зона.** Раньше web-style/src/index.css имел паутину relative paths типа `../../web-ui/dist/**/*.mjs` × 3 layout-варианта. Все удалены в 2026-05-20 refactor. Если что-то нужно сканить — это **builders scaffold's** styles.css.template.

- **ThemeSwitcher/ThemeEditor — opt-in.** Не импортируются автоматически в web-core'е. App включает явно через `import { ThemeSwitcher } from '@capsuletech/web-style/editor'` если нужно.

- **Solid-Motion / animation tokens** — пока нет (есть `pulse-subtle` keyframe но это для status-indicator). Анимации делаются через `solid-motionone` в web-ui (Animate primitive).

## План рефакторинга / оптимизаций

- [ ] **Завести `docs/_meta/web-style.md` AI anchor** — нет пока. (priority: high)
- [ ] **Удалить deprecated `./css` subpath** — после стабилизации e2e fixture, чтобы убедиться никто не зависит. (priority: low)
- [ ] **Theme generator script** — генерация новой темы из base hue (HSL → 30 переменных). (priority: low)
- [ ] **Visual theme preview** в Storybook — отдельная вкладка с side-by-side. (priority: low)
- [x] **Tailwind entry-point убран из themes** — `@import "tailwindcss"` + `@layer base` блоки удалены из всех 11 themes (2026-05-20).
- [x] **CSS entry-point переехал в app's `.capsule/styles.css`** — web-style больше не диктует Tailwind context (2026-05-20).
- [x] **`@source` paths убраны** — был хрупкий relative-path matrix (2026-05-20).

## Test coverage

| Тип | Где | Что покрывает |
|---|---|---|
| Unit | `src/__tests__/createStyle.test.ts` (если есть) | CVA wrapper edge cases |
| E2E (косвенно) | smoke fixture | rendered theme variables на странице |
| Storybook (косвенно) | web-ui storybook | theme switcher live |

**Перед изменением createStyle signature:** все web-ui primitives используют его — координировать с owner-web-ui.

**Перед изменением theme variable names** (e.g. `--background` → `--surface-base`): breaking change для всех primitives и user-themes.

## Cross-package dependencies

| Зона | Owner |
|---|---|
| Tailwind entry-point, `@source` directives | owner-builders (через `.capsule/styles.css.template`) |
| UI primitives (consumers createStyle) | owner-web-ui |
| Animation primitives (Animate) | owner-web-ui |
| Theme application (DOM `data-theme` attr) | owner-web-core (`ensureTheme` в createRoot) |

## Release group

`web_base` (fixed). После изменений координировать release через главного (`pnpm release:local:web` или `--group=all`).

**Раньше** web-style собирался **последним** в release-local (последняя фаза) чтобы scan'ить dist'ы siblings. После того как Tailwind entry-point переехал в app — порядок больше не критичен, но оставлен в фазе для safety.

Связанные:
- `docs/_meta/web-style.md` — AI anchor (когда заведём).
- `docs/_meta/dep-management-plan.md` — план dep gigiene.
