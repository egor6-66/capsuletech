---
tags: [hca, adr, accepted]
status: accepted
date: 2026-05-09
---

# ADR 007 — Cleanup в UiProxy: жизненный цикл регистрации компонентов

## Контекст

`packages/core/src/wrappers/ui/ui-kit/proxy.tsx:30`:

```ts
const ComponentWrapper = (componentProps) => {
  const merged = mergeProps(wrapperProps, componentProps, { dynamicMeta: wrapperProps?.meta });
  const [local, props] = splitProps(merged, ['children']);

  const id = crypto.randomUUID();                     // ⚠️ новый id на каждый рендер
  ctx.store.registerComponent({ [id]: props });       // ⚠️ нет cleanup
  // ...
}
```

Два связанных дефекта:

1. **`crypto.randomUUID()` в теле компонента** — пересоздаётся на каждый рендер вместе с записью в `store.components`.
2. **Нет `unregister`** — при unmount элемент остаётся в `store.components`. Со временем стор пухнет, GC компонентов не происходит.

Последствие для tag-системы: `store.pick(['@inputs'])` возвращает не «смонтированные сейчас», а **все когда-либо отрендеренные** инпуты. Пока sandbox маленький — не видно. На реальной форме с reactive-полями станет catastrophic.

## Решение

1. **Стабильный id через `createUniqueId`** (Solid SSR-safe) вместо `crypto.randomUUID()`.
2. **Регистрация в `createEffect`** — id и текущие props пишутся в стор на mount, обновляются на изменении props.
3. **`onCleanup` для unregister** — при unmount запись удаляется.
4. Добавить `UNREGISTER_COMPONENT`-ивент в XState-машину store + `unregisterComponent(id)` в bridge.

## Реализация

### `@capsuletech/state` — добавить событие в машину

```ts
// packages/state/src/create.ts (после рефакторинга по ADR 008)
on: {
  // ...
  UNREGISTER_COMPONENT: {
    actions: assign({
      components: ({ context, event }) => {
        const { [event.id]: _, ...rest } = context.components;
        return rest;
      },
    }),
  },
}
```

### `createBridge`

```ts
unregisterComponent: (id: string) => send({ type: 'UNREGISTER_COMPONENT', id }),
```

### UiProxy

```tsx
import { createUniqueId, createEffect, onCleanup, mergeProps, splitProps } from 'solid-js';

const ComponentWrapper = (componentProps) => {
  const merged = mergeProps(wrapperProps, componentProps, { dynamicMeta: wrapperProps?.meta });
  const [local, props] = splitProps(merged, ['children']);

  const id = createUniqueId();

  // Реактивная регистрация: на mount + на каждое изменение props
  createEffect(() => {
    ctx.store.registerComponent({ [id]: { ...props } });
  });

  onCleanup(() => {
    ctx.store.unregisterComponent(id);
  });

  // ...остальная логика без изменений
};
```

## Почему `createEffect`, а не просто `onMount`

`onMount` сработает один раз и зафиксирует props на момент монтирования. Если потом Entity передаст другой `meta` (например, динамически — `meta={isEdit ? metaA : metaB}`), `store.components[id]` останется со старыми тегами, и `pick/match` будут врать.

`createEffect` пересчитывает запись при изменении любого reactive-доступа в теле — это ровно то, что нужно для зеркала «store ↔ DOM».

## Альтернативы

- **Не очищать вообще** — оставить «лог всех когда-либо отрендеренных». Отвергнуто: ломает семантику tag-операций.
- **Очищать по таймеру / weak-id** — слишком хитро, нет реальной выгоды.
- **`onMount` + ручной re-register при изменении meta** — требует дополнительного `createEffect(on(...))` с явным списком зависимостей, проще сразу `createEffect`.

## Последствия

### Положительные
- `store.pick / omit / match` начинают честно отражать смонтированный набор компонентов.
- Стор не растёт неограниченно.
- SSR-safe id (если когда-нибудь будет SSR).

### Отрицательные
- `createEffect` запускает re-register на каждое изменение reactive-props — небольшая накладка. Mitigation: `createMemo` поверх «идентичности» props, если станет узким местом (профилировать прежде).

## Связанное

- [[ui-proxy]]
- [[008-hybrid-fsm-api|ADR 008]] — фиксы бандлятся в один рефакторинг
- [[state|@capsuletech/state]] — `UNREGISTER_COMPONENT`-ивент
- [[tagging-system]] — после фикса начнёт работать как задумано
