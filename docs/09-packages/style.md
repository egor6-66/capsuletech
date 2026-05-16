---
tags: [hca, package, style]
status: documented
---

# @capsuletech/style

**Расположение:** `packages/system/style/`
**Зависит от:** `clsx`, `tailwind-merge`, `class-variance-authority`, `solid-js`

Тонкий хелпер вокруг CVA + Tailwind для реактивного применения вариантов.

## API

```ts
import { cn, createStyle } from '@capsuletech/style';
import '@capsuletech/style/css'; // глобальные базовые стили (опционально)
```

### `cn(...classes)`

Стандартный `clsx` + `tailwind-merge` — мержит классы и схлопывает конфликтующие Tailwind-утилиты.

### `createStyle(cvaFn, props)`

Принимает CVA-функцию и текущие props, возвращает реактивные геттеры:

```ts
function createStyle(cvaFn, props) {
  const className = createMemo(() => cn(cvaFn(props), props.class));
  const style = () => props.style;
  return { className, style };
}
```

Зачем `createMemo`: чтобы при изменении `props.variant` Solid пересчитал класс, а не пересоздал весь компонент.

## Использование в UI-kit

```tsx
// packages/ui/src/components/button/button.tsx
const { className, style } = createStyle(buttonCva, {
  ...variants,
  class: local.class,
  style: local.style,
});
return <button class={className()} style={style()} {...others}>{children}</button>;
```

## CVA-варианты

CVA-функция (например, `buttonCva`) — статически типизированный набор вариантов:

```ts
// packages/ui/src/components/button/variants.ts (по тому же паттерну)
export const buttonCva = cva('inline-flex items-center ...', {
  variants: {
    variant: { primary: '...', ghost: '...' },
    size:    { sm: '...', md: '...', lg: '...' },
  },
  defaultVariants: { variant: 'primary', size: 'md' },
});
```

## Связанное

- [[ui|@capsuletech/ui]]
