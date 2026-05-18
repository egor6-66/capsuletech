---
tags: [hca, binding, logic]
status: documented
---

# 🔁 Overrides — ремап имён методов

Когда дочерний Controller вызывает `next()`, по умолчанию ищется метод **с тем же именем** у родителя:

```
Controller.Form.onClick → next() → Feature.Auth.onClick
```

Но иногда у родителя нет `onClick`, есть `login`. Чтобы не переименовывать в дочернем — используется `overrides`.

## Как задать

`overrides` — это prop враппера, передаётся при использовании в Widget:

```tsx
<Controllers.Universal.Form overrides={{ onClick: 'login', onInput: 'validate' }}>
  <Entities.Auth.LoginForm />
</Controllers.Universal.Form>
```

## Что это делает

В `ControllerProxy` (`packages/web/core/src/engine/controller-proxy.ts:47`):

```ts
const targetMethod = overrides?.[methodName] ?? methodName;
return (await parent.controller[targetMethod]?.(enrichedTarget, context)) ?? null;
```

- Если в overrides есть запись для текущего метода — `next()` уйдёт в метод с другим именем.
- Если нет — fallback на оригинальное имя.

## Зачем это нужно

> [!info]
> Это позволяет **переиспользовать generic-Controller** (например, универсальный `Form`) с разными Feature, не подстраивая Controller под Feature.

Пример: один и тот же `Form` Controller используется и для логина, и для регистрации, и для смены пароля. Каждый Widget сам решает, в какой метод Feature мапить клик.

## Ограничения

- Overrides действуют только на цепочку `next()`. Имя локального метода (внутри `states`) не переименовывается.
- Невозможно «расщепить» один метод на несколько (`onClick` → `validate` + `submit`). Для этого нужна композиция Controller'ов в Widget.

## Связанное

- [[controller-proxy]]
- [[layers]]
