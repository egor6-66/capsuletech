---
tags: [hca, package, ui]
status: documented
---

# @capsuletech/ui

**Расположение:** `packages/ui/`
**Зависит от:** `@kobalte/core`, `@capsuletech/style`, `solid-js`

Базовый stateless UI-kit. Это **строительные блоки** для Entity, не Entity сами по себе.

## Состав

```
packages/ui/src/components/
├── button/        Button (с CVA-вариантами, asChild)
├── input/         Input
├── label/         Label
├── field/         Field, Field.Content, Field.Label, Field.Description, Field.Error,
│                  Field.Group, Field.Legend, Field.Separator, Field.Set, Field.Title
├── card/          Card, Card.Header, Card.Title, Card.Description, Card.Content, Card.Footer
├── layout/        Layout (со slots)
├── list/          List
├── navigation/    Navigation, Navigation.List, Navigation.Item
├── separator/
├── typography/
└── wrappers/
```

## Соглашения

- **Стили через CVA + `createStyle`** (см. [[style|@capsuletech/style]]).
- **Компаунд-компоненты** через `Object.assign(Base, { Part: ... })`. Пример: `Card.Header`, `Field.Label`.
- **`asChild` (где есть)** — паттерн Radix: рендерится не базовый тег, а функция-children, в которую прокидывается `class`/`style`.

```tsx
// packages/ui/src/components/button/button.tsx
const [local, variants, others] = splitProps(
  props,
  ['class', 'style', 'asChild', 'children'],
  ['variant', 'size'],
);
const { className, style } = createStyle(buttonCva, { ...variants, class: local.class, style: local.style });
return (
  <Show when={local.asChild} fallback={<button class={className()} style={style()} {...others}>{local.children}</button>}>
    {typeof local.children === 'function' ? local.children({ class: className(), style: style(), ...others }) : local.children}
  </Show>
);
```

## Как UI попадает в Entity

```
@capsuletech/web-ui ──▶ @capsuletech/web-core/ui-kit/imports.tsx (lazy-импорты)
                ──▶ Ui (объект всех компонентов)
                ──▶ EntityWrapper.UiProxy(ctx, props)  // оборачивает
                ──▶ <Component {...Ui} />              // Entity получает Field/Button/Input в props
```

## Что **не** должно жить в `@capsuletech/ui`

- Бизнес-валидация полей.
- Знание о `meta`/`tags`. UI не знает про мета-теги — это договор между Entity и [[ui-proxy|UiProxy]].
- Состояние формы. Это `store.ctx.data`.

## Генератор

```bash
pnpm ui:gen
```

Запускает `nx g ./packages/ui/generators.json:ui-component`. Генерит скелет нового компонента.

## Связанное

- [[ui-proxy]]
- [[style|@capsuletech/style]]
- [[layers]]
