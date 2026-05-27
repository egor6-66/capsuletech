---
tags: [hca, adr, implemented]
status: implemented
date: 2026-05-27
---

# ADR 020 — Component-data flow: register on mount, updateComponent on runtime

> [!success] Status: implemented (2026-05-27)
> PR #166 (`0832ad5`) — новый event `UPDATE_COMPONENT`, bridge-метод `updateComponent()`, разделение register/update семантики. UiProxy переведена на узкие writes.

## Контекст

Раньше UiProxy на каждом `onInput` писал **весь target** через `store.update` (SET_DATA):

```ts
store.update({
  [componentId]: {
    name, value, type, meta, dynamicMeta, payload, key, modifiers
  }
})
```

Это заканчивалось в `context.data: TCtx` — user state из `schema.context`. Дока в `docs/09-packages/state.md` это явно прописывала: `data` — это namespace пользователя для бизнес-логики.

**Problem:** UI-данные (name, value, type, meta) и пользовательское состояние (data из Feature) жили в одном namespace. Результат:
- Drift: `target` дублировал `meta` (она уже регистрировалась в `components[id].meta` при REGISTER_COMPONENT).
- Шум в user space: непредвиденные ключи `[componentId]` в `context.data`.
- Confusing API: Feature-разработчик видит `store.ctx.data` и не знает, какие ключи там пользовательские, а какие — от UI.

**Note:** Никаких ADR/design docs для текущего flow не найдено — это был дефолтный паттерн времени, когда `store` был single catch-all.

## Решение

### 1. Новый event UPDATE_COMPONENT

В `packages/web/state/src/store.ts`:

```ts
type IUpdateComponentPayload = {
  [id: string]: Partial<{
    value: any
    type?: string
    // другие runtime-поля по расширению
  }>
}

// Action в XState machine:
{
  type: 'UPDATE_COMPONENT',
  payload: IUpdateComponentPayload
}
```

Мержит в `components[id]`, skip неизвестные id молча (защита от race-condition'ов).

### 2. Bridge-метод updateComponent

`packages/web/state/src/bridge.ts`:

```ts
updateComponent(payload: IUpdateComponentPayload) {
  machine.send({ type: 'UPDATE_COMPONENT', payload })
}
```

### 3. UiProxy narrowed writes

`packages/web/core/src/engine/ui-proxy.tsx` `onInput` хэндлер теперь:

```ts
// Раньше:
store.update({ [id]: target })

// Теперь:
store.updateComponent({
  [id]: { value: target.value, type: target.type }
})
```

Только runtime-поля. `meta` и структура компонента остаются как есть (они не меняются на лету).

### 4. store.values() helper

Новый bridge-метод для submit-payload'ов:

```ts
store.values(tags) → Record<name, value>
```

Собирает `value` у компонентов, которые матчат теги + имеют `name`. Last-write-wins для дублей.

```ts
// В Feature:
const formData = store.values(['@inputs'])
// { email: 'user@...', password: '...' }
```

### 5. Семантика register vs update

| Event | Когда | Что | Идемпотент? |
|---|---|---|---|
| `REGISTER_COMPONENT` | Mount (первый раз) | Записывает весь target (meta, name, value, type) | ✅ (skip если уже есть) |
| `UPDATE_COMPONENT` | Runtime (на Input/Change/…) | Мержит patch в `components[id]` | ✅ (merge) |
| `UNREGISTER_COMPONENT` | Unmount | Удаляет из `components[id]` | ✅ |

## Последствия

### ✅ Плюсы

- **User namespace `data: TCtx` чист.** Разработчик Feature может написать `store.update({ counter: 1 })` без опасения коллизии с UI-id ключами.
- **Явная граница регистрация vs update.** REGISTER на mount — один раз, UPDATE на runtime — много раз. Clear contract.
- **Удобный payload:** `store.values(['@inputs'])` — вместо ручного сбора из `components[id].value`.
- **Compliance:** семантика register/update чётко разведена в docs, линтер может требовать правильное использование.

### ⚠️ Breaking changes

- **Apps, читавшие `store.ctx[id]` для value-access** — должны переехать на:
  - `store.components[id].value` (direct access)
  - или `store.values(['@tagName'])` (query-side batch)
- **Apps, писавшие `store.update({ [id]: ... })`** — если `id` выглядит как component-id — переехать на `store.updateComponent()`.

Однако **уникальный компонент-id** (из `createUniqueId()`) имеет формат типа `components_2`, очень узнаваем. Риск ошибки низкий.

## Альтернативы

1. **Оставить всё как было** — не решает confusing DX и drift.
2. **Отдельный namespace `ui`** (`store.ui[id]` вместо `store.ctx[id]`) — тоже решает, но UPDATE_COMPONENT менее гибкий для расширения (новый event vs новый namespace).

## Связанное

- PR #166 (`0832ad5`) — реализация.
- [[019-autoimport-dirs-drop|ADR 019]] — одновременный рефакторинг cycle-break.
- `docs/09-packages/state.md` — update таблица context + register/update.
- `docs/_meta/web-state.md` — AI-anchor с полной семантикой store.
- `docs/_meta/web-core.md` — упоминание UiProxy narrowed writes.
