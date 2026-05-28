---
tags: [style, theming]
status: documented
---

# Темовая система: как устроена и как добавить

Подробное объяснение CSS-переменных, маппинга на Tailwind и runtime-переключения.

## Как устроена одна тема

Каждая тема — файл `packages/web/style/src/themes/<name>.css`, например `black.css`:

```css
@import "tailwindcss";
@custom-variant dark (&:is(.dark *));

[data-theme="black"] {
  --background: oklch(13.41% 0 0);
  --foreground: oklch(98.79% 0 0);
  --primary: oklch(59.69% 0.14 259.57);
  --primary-foreground: oklch(98.79% 0 0);
  
  --secondary: oklch(79.97% 0.08 255.93);
  --secondary-foreground: oklch(20% 0 0);
  
  --muted: oklch(30% 0 0);
  --muted-foreground: oklch(70% 0 0);
  
  --accent: oklch(65% 0.2 39);
  --accent-foreground: oklch(13.41% 0 0);
  
  --card: oklch(17% 0 0);
  --border: oklch(25% 0 0);
  
  --destructive: oklch(62.11% 0.22 26.01);
  --destructive-foreground: oklch(98.79% 0 0);
}

[data-theme="black"].dark {
  --background: oklch(10% 0 0);
  --foreground: oklch(95% 0 0);
  /* ... dark-вариант переменных */
}
```

**Ключевые моменты:**
- Селектор `[data-theme="black"]` — эта тема активна, когда `<html data-theme="black">`.
- Переменные в `oklch()` (не `rgb`, не `hex`) — перцептивная модель, позволяет редактору правильно манипулировать яркостью и насыщенностью.
- `.dark` ниже — для dark-mode. Когда на `<html>` добавлен класс `class="dark"`, применяются эти переменные.

## Маппинг переменных на Tailwind

В `packages/web/style/src/index.css`:

```css
@import "tailwindcss";

@source "../../../packages/web/core/src/**/*.tsx";
@source "../../../packages/web/ui/src/**/*.tsx";
@source "../../../apps/*/src/**/*.tsx";

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-card: var(--card);
  --color-border: var(--border);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
}

@import "./themes/index.css";
```

**Что происходит:**
- `@theme inline { --color-background: var(--background); }` — Tailwind теперь знает, что `bg-background` → `var(--color-background)` → `var(--background)` → значение из активной темы.
- `@import "./themes/index.css"` в конце — подключает все темы (каждая переопределяет `--background` и прочие в своём селекторе).

**Результат:** когда меняется `data-theme`, браузер пересчитывает CSS-переменные → Tailwind-классы применяют новые цвета.

## Как переключить тему runtime'ом

### Способ 1: атрибут на <html>

```ts
document.documentElement.setAttribute('data-theme', 'zen');
```

Все компоненты с `bg-primary`, `text-foreground` и т.д. сразу перерисуются.

### Способ 2: ThemeSwitcher компонент

```tsx
import { ThemeSwitcher } from '@capsuletech/web-style/switcher';

export default function App() {
  return (
    <div>
      <ThemeSwitcher />
      {/* rest of app */}
    </div>
  );
}
```

ThemeSwitcher:
1. Отрисовывает меню со всеми темами (discover из `import.meta.glob('themes/*.css')`).
2. При выборе вызывает `document.documentElement.setAttribute('data-theme', name)`.
3. Сохраняет выбор в `localStorage['capsule-theme']`.
4. При reload загружает тему из localStorage.

## Список встроенных тем

`black`, `damon`, `deepPurple`, `lightGreen`, `minimalNeutral`, `openprofile`, `pasteelement`, `shopifyRed`, `tiesen`, `vescrow`, `zen` — итого 11 «контентных» тем плюс `index.css` (баррель `@import`-ов).

Имена частью кодовые (по проектам-источникам палитры), частью описательные. Точное оформление каждой смотри либо в исходниках `packages/web/style/src/themes/<name>.css`, либо вживую через theme-toolbar в Storybook (`pnpm storybook` в `packages/web/ui/`).

## Как добавить новую тему

1. **Создай файл** `packages/web/style/src/themes/<name>.css`:
   ```css
   @import "tailwindcss";
   @custom-variant dark (&:is(.dark *));

   [data-theme="<name>"] {
     --background: oklch(20% 0 0);
     --foreground: oklch(95% 0 0);
     --primary: oklch(60% 0.15 210);
     --primary-foreground: oklch(98% 0 0);
     
     --secondary: oklch(75% 0.1 200);
     --secondary-foreground: oklch(20% 0 0);
     
     --muted: oklch(35% 0 0);
     --muted-foreground: oklch(70% 0 0);
     
     --accent: oklch(70% 0.25 50);
     --accent-foreground: oklch(20% 0 0);
     
     --card: oklch(25% 0 0);
     --border: oklch(40% 0 0);
     
     --destructive: oklch(65% 0.2 25);
     --destructive-foreground: oklch(98% 0 0);
   }

   [data-theme="<name>"].dark {
     --background: oklch(15% 0 0);
     /* dark-вариант переменных */
   }
   ```

   Скопируй из любой существующей темы (`black.css`, `zen.css`) и отредактируй числа.

2. **Импортируй в** `packages/web/style/src/themes/index.css`:
   ```css
   @import "black.css";
   @import "zen.css";
   /* ... */
   @import "<name>.css";
   ```

3. **ThemeSwitcher и Storybook toolbar подхватят автоматически** (через `import.meta.glob`).

4. Оптимально: используй `editor/` для визуального редактирования вместо ручного ввода oklch-значений.

## Motion tokens

All motion durations live in `packages/web/style/src/index.css :root`:

| Token | Value | Usage |
|---|---|---|
| `--motion-instant` | 0ms | No delay (usually unused) |
| `--motion-fast` | 200ms | List items hover, Toggle, Input border, Table rows |
| `--motion-normal` | 320ms | Default transition duration (main knob) |
| `--motion-slow` | 500ms | Dialogs, panels, major layout shifts |
| `--motion-slower` | 800ms | Splash screens, page transitions |

**Critical:** `--motion-normal` feeds into **global rule** at line ~395 in `index.css`:
```css
button, input, a {
  transition: var(--transition-ui) !important;
}
```

This `!important` overrides any component-level `transition-colors duration-fast` in CVA. To tune button/input/a smoothness — adjust `--motion-normal`. See [[anti-patterns|transition-ui !important gotcha]] for full context.

## Что отвечает за .dark-класс

Отдельная ось от `data-theme`. Темы могут иметь dark-вариант (в скобках `[data-theme].dark`).

Когда на `<html>` добавлен класс `class="dark"`, селекторы `.dark` в Tailwind разворачиваются как `(&:is(.dark *)...)`.

```css
@custom-variant dark (&:is(.dark *));
```

Это даёт эффект: `dark:bg-primary` в Tailwind становится `.dark * { background: var(--primary); }` (или точнее, `:is(.dark *)` для правильной специфичности).

**Пример:** если тема `black` имеет `[data-theme="black"].dark { --primary: oklch(50% ...); }`, то при `<html class="dark" data-theme="black">` все `bg-primary` будут использовать это переопределённое значение.

## OKLCH вместо RGB/HEX

Почему `oklch(62% 0.22 26)` вместо `#FF5733`?

- **OKLCH** — перцептивное colour space. Параметры: lightness (0—100%), chroma (0—0.37), hue (0—360°).
- Позволяет редактору `editor/oklch.ts` менять яркость и насыщенность без потери оттенка.
- При переходе из темы в тему (light → dark) проще подогнать переменные, не теряя идентичность цвета.

## Полезные команды

```bash
# Смотреть, как выглядят все темы
cd packages/web/ui && pnpm storybook

# Переключаться в toolbar'е (theme selector в top-right)
# → визуально проверить, что новая тема не сломала ничего

# Редактировать тему визуально (если есть editor)
# → экспортировать как CSS
```

## Pitfalls

- **Переменная забыта в новой теме:** если в `<name>.css` не определил `--primary`, Tailwind вернёт fallback или ошибку. Проверь, что все переменные из `@theme inline` определены.
- **Дублирование `@theme inline`:** если в разных CSS-файлах определены `@theme inline`, последний перекроет предыдущий. Всё в одном месте (`index.css`).
- **Dark-класс не работает:** убедись, что `<html class="dark">` добавлен (обычно это делает приложение). Некоторые темы могут не иметь dark-варианта — это нормально (fallback на обычный режим).

## Связанное

- [[style|@capsuletech/web-style]]
- [[ui|@capsuletech/web-ui]]
- [[storybook|Storybook: theme-toolbar]]
