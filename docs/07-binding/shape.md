---
tags: [hca, binding, shape]
status: documented
---

# 🧬 Shape — декларативные data-формы

**Файлы:**
- `packages/web/core/src/wrappers/shape/wrapper.tsx` — фабрика
- `packages/web/core/src/wrappers/shape/ui-tracker.ts` — path-tracker для `definition.as`
- `packages/web/core/src/wrappers/shape/context.tsx` — `ShapeUiContext` (Entity → Shape проброс Ui)
- `packages/web/core/src/wrappers/shape/types.ts` — типы

> Раньше всё это жило в `wrappers/logic/shape/`; после Phase E (split engine/wrappers) — `wrappers/shape/`.

Shape — wrapper для повторяющихся data-форм: nav-item'ы, чипы, поля табличной формы и т.п. Из одного описания (zod-схема + дефолты + маппинг `item → templateProps`) получается типизированный polymorphic-компонент, который рендерит список через `<For>` и резолвит template из проксированного Ui родительского Entity.

## Когда использовать

- Список «однотипных» элементов внутри Entity (навигация, список вкладок, чип-список).
- Хочется единое место под форму данных + дефолты + шаблон.
- Каждый элемент списка должен получить **тот же** UiProxy event-binding, что и собственный UI Entity.

## Каркас

```ts
// apps/<app>/src/shapes/navigation.ts
export const NavigationItems = Shape((z, ui) => ({
  schema: z.array(
    z.object({
      label: z.string(),
      href:  z.string(),
      icon:  z.string().optional(),
    }),
  ),
  defaults: [
    { label: 'Branches', href: '/branches' },
    { label: 'Search',   href: '/search'   },
  ],
  as: ui.Navigation.Item,                  // path-tracker
  props: (item) => ({
    meta:    { tags: ['nav'] },
    payload: { href: item.href },
    children: item.label,
  }),
}));
```

Внутри Entity:

```tsx
// apps/<app>/src/entities/sidebar/index.tsx
const Sidebar = Entity(({ Navigation }, { NavigationItems }) => (
  <Navigation>
    <NavigationItems />               {/* подхватывает defaults */}
  </Navigation>
));
```

С внешними данными:

```tsx
<NavigationItems data={items()} />
```

С render-prop (escape hatch):

```tsx
<NavigationItems>
  {(item, index) => <Custom key={index()} {...item} />}
</NavigationItems>
```

## Path-tracker для `definition.as`

`Shape((z, ui) => ...)` вызывается **на import** — реальный Ui (с UiProxy event-binding'ом) ещё не существует. Поэтому `ui` — это **Proxy-tracker**, который фиксирует путь property-access'ов:

```ts
// ui-tracker.ts
ui.Navigation.Item   // → tracker с path = ['Navigation', 'Item']
ui.Card.Header       // → tracker с path = ['Card', 'Header']
```

На render-этапе `Shape` достаёт **реальный** проксированный Ui через `useShapeUi()` и резолвит путь:

```ts
const realUi = useShapeUi();
const path = getTrackerPath(defaultAs);
const Template = path ? resolveByPath(realUi, path) : defaultAs;
```

Это даёт ключевое свойство: template, отрисованный Shape'ом, **получает UiProxy event-binding** так же, как если бы автор Entity написал `<Navigation.Item meta={...}>` руками.

## ShapeUiContext

Чтобы Shape мог достучаться до проксированного Ui, `EntityWrapper` оборачивает свой рендер в `ShapeUiContext.Provider value={Ui}`:

```tsx
// packages/web/core/src/wrappers/entity.tsx
const Ui = ctx ? UiProxy(ctx, wrapperProps) : BaseUi;
return (
  <ShapeUiContext.Provider value={Ui}>
    {Component(Ui, getShapes())}
  </ShapeUiContext.Provider>
);
```

Shape читает через `useShapeUi()`. Если Entity рендерится без Controller'а (нет `ctx`) — в контексте лежит **базовый** Ui (без proxy), и path-tracker всё равно резолвится (просто без event-binding'а).

## Приоритет рендера

Для каждого элемента из `data` (или `defaults`) Shape выбирает template в таком порядке:

| # | Источник | Условие |
|---|---|---|
| 1 | `props.children` (render-prop в JSX) | Если передан — это escape hatch, всё остальное игнорируется |
| 2 | `props.as` (override на JSX-сайте) | Explicit-override от потребителя Shape'а |
| 3 | `definition.as` (default из factory) | Если это path-tracker — резолвится через `ShapeUiContext`; иначе используется как готовый компонент |
| 4 | _нет template_ | Рендерится `templateProps.children` без обёртки (`<>{tplProps.children}</>`) |

```tsx
// Дефолтный template
<NavigationItems />
// → For(item) → <Navigation.Item {...propsFn(item)} />

// JSX-override template
<NavigationItems as={Card.Header} />
// → For(item) → <Card.Header {...propsFn(item)} />

// Render-prop
<NavigationItems>
  {(item) => <li>{item.label}</li>}
</NavigationItems>
// → For(item) → <li>...</li>  (propsFn игнорируется)
```

## Маппинг `item → templateProps`

Поле `props` в `definition` (`propsFn`) превращает каждый item массива в props для template'а:

```ts
{
  props: (item) => ({
    meta:    { tags: ['nav'] },               // подхватится UiProxy
    payload: { href: item.href },             // станет target.payload в Controller'е
    children: item.label,
  })
}
```

Если `props` не задан — item передаётся template'у as-is (поля item = props).

Что приходит template'у — типизировано через `IShapeTemplateProps`:

```ts
interface IShapeTemplateProps {
  meta?:    Record<string, unknown>;
  payload?: Record<string, unknown>;
  children?: JSX.Element;
  [k: string]: unknown;
}
```

## Полная цепочка тегирования

В типичном кейсе nav-list'а каждый item получает теги в трёх местах:

```ts
{
  meta:    { tags: ['nav'] },                       // от Shape (для pick(['nav']))
  payload: { href: item.href },                     // данные для Controller'а / Feature'а
  children: item.label,
}
```

В Controller'е:

```ts
onClick: ({ target, next }) => {
  // target.payload === { href: '/branches' }       — от Shape
  // target.meta    === { tags: ['nav'] }           — от Shape
  // target.dynamicMeta                              — от <Sidebar meta={...} /> в Widget'е
  return next({ from: target.payload.href });       // переписать payload для Feature
}
```

## Что Shape не делает

- **Не валидирует runtime**. `z.array(...)` нужна для типизации `item` в `props: (item) => ...` (через `z.infer`); runtime-проверки `parse` не вызываются. Если нужны рантайм-проверки — делать в Feature перед `data={...}`.
- **Не управляет состоянием**. Это Stateless-wrapper. Все side-effects — в Controller/Feature.
- **Не композирует другие Shape'ы**. Один Shape = один список. Композиция — в Widget.

## Связанное

- [[ui-proxy]] · [[controller-proxy]]
- [[layers]] · [[tagging-system]]
