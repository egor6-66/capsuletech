---
tags: [ui, primitive, button]
status: documented
---

# Button

Полиморфная кнопка с CVA-вариантами. Поддерживает `as`, 6 визуальных стилей, 4 размера.

Файлы: `packages/web/ui/src/primitives/button/`. Subpath export: `@capsuletech/web-ui/button`.

## Когда использовать

- Любое действие пользователя на странице — submit, открытие диалога, переход.
- Когда нужен кликабельный элемент с темовой стилизацией.
- Когда тег должен быть произвольным (`<a>`, `<Link>`, custom-компонент) — через `as`.

Если нужен «inline-link», не путай с `Typography variant="lead"` или прямым `<a>` — Button с `variant="link"` уже даёт правильное поведение.

## API

| Prop | Тип | Default | Описание |
|---|---|---|---|
| `variant` | `'default' \| 'destructive' \| 'outline' \| 'secondary' \| 'ghost' \| 'link'` | `'default'` | Визуальный стиль. |
| `size` | `'default' \| 'sm' \| 'lg' \| 'icon'` | `'default'` | Высота / padding. `icon` — квадрат `h-9 w-9` для icon-only-кнопок. |
| `loading` | `boolean` | `false` | При `true` — заменяет children на спиннер (`<Loader2 class="animate-spin" />`), auto-disable кнопку. |
| `as` | `ValidComponent` | `'button'` | Полиморфный тег / компонент через `Slot`. |
| `class` | `string` | — | Доп. Tailwind-классы (мержатся с CVA через `tailwind-merge`). |
| `style` | `JSX.CSSProperties \| string` | — | Inline-стили. |
| `disabled` | `boolean` | — | Стандартный HTML, плюс CVA выставляет `opacity-50 pointer-events-none`. |
| `children` | `JSX.Element` | — | Текст и/или иконки. SVG автоматически получают `size-4 shrink-0`. Скрывается при `loading={true}`. |
| `...rest` | DOM-атрибуты `T` | — | `onClick`, `type`, `id`, `aria-*`, `href` (при `as="a"`), … |

Полный тип: `IButtonProps<T extends ValidComponent = 'button'>`.

## Варианты

| Variant | Использование |
|---|---|
| `default` | Primary action — Submit, Send, Confirm. Заполненный `bg-primary`. |
| `destructive` | Опасные действия — Delete, Reset, Drop. `bg-destructive`. |
| `outline` | Border-only — secondary action рядом с primary. |
| `secondary` | Filled-secondary — менее акцентный fill, но видимый. |
| `ghost` | Полностью прозрачный, hover-подсветка. Для toolbar / icon-only. |
| `link` | Текст-как-ссылка, hover-underline. Никакого фона. |

## Размеры

| Size | Геометрия | Use case |
|---|---|---|
| `default` | `h-auto px-layout py-1.5` (6px) | По умолчанию, на основе spacing-токенов темы. **Changed 2026-05-28** — было `py-button-sm` (8px); `sm`/`lg`/`icon` unchanged. |
| `sm` | `h-8 px-3 text-xs` | Компактные toolbars, мобильные плашки. |
| `lg` | `h-10 px-8` | Hero-кнопка, главное действие на лендинге. |
| `icon` | `h-9 w-9 p-0` | Icon-only: `<Button size="icon"><Search /></Button>`. |

## Примеры

**Базовая:**
```tsx
<Button>Send</Button>
```

**С иконкой и текстом:**
```tsx
import { Send } from 'lucide-solid';
<Button>
  <Send /> Send
</Button>
```
SVG автоматически получает `size-4 shrink-0` от базового CVA — отдельный `size={N}` на иконке не нужен.

**Icon-only:**
```tsx
import { Search } from 'lucide-solid';
<Button variant="ghost" size="icon" aria-label="search">
  <Search />
</Button>
```

**Полиморфная — как ссылка:**
```tsx
<Button as="a" href="/docs" variant="link">Documentation</Button>
```

**С TanStack Router:**
```tsx
import { Link } from '@tanstack/solid-router';
<Button as={Link} to="/dashboard" variant="ghost">Dashboard</Button>
```

**Destructive + disabled:**
```tsx
<Button variant="destructive" disabled>Delete (locked)</Button>
```

**С loading-state (async):**
```tsx
<Button loading={isSubmitting()}>Save</Button>
```

При `loading={true}` кнопка показывает спиннер вместо текста и автоматически disables. CVA базовый стиль задаёт `[&_svg]:size-4` — спиннер корректно масштабируется во всех variants и sizes.

## Storybook

`http://localhost:6006/?path=/story/components-button--default` после `pnpm storybook` в `packages/web/ui/`.

Stories покрывают каждый variant + каждый size + loading-имитацию (`<Loader2 class="animate-spin" />` через `disabled`).

## Pitfalls

- **Async с loading-state.** Используй `loading={true}` для async-операций — prop автоматически покажет спиннер и отключит кнопку. Старый паттерн (`disabled` + manual `<Loader2>`) всё ещё работает, но менее удобен.
- **Иерархия на странице.** Один `default` на экран. Остальные — `secondary`/`ghost`/`outline`. Несколько `default` рядом сбивают пользователя.
- **Не путай `link`-variant с `<a>`.** `variant="link"` — это стилизация. Чтобы получить настоящую ссылку, добавь `as="a" href="…"` или `as={Link}`.
- **Long children.** При длинном тексте кнопка не переносит — у CVA `whitespace-nowrap`. Если нужен перенос — переопредели `class="whitespace-normal"` или вынеси текст в `Typography` рядом.

## Связанное

- [[conventions|UI-kit канон]] — как устроены все primitives
- [[primitives/typography|Typography]]
- [[ui-proxy|UiProxy]] — как UI-event попадает в Controller
