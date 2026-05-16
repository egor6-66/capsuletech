---
tags: [hca, adr, accepted]
status: accepted
date: 2026-05-09
---

# ADR 001 — XState как канонический FSM-движок

## Контекст

В текущей реализации поведение Controller/Feature живёт в **двух местах одновременно**:

1. **XState-машина** (`packages/state/src/create.ts`) — фактически универсальный store с одним состоянием `idle` и фиксированными ивентами (`SET_DATA`, `SET_LOADING`, ...). FSM-возможности XState не используются.
2. **Собственный runtime** (`packages/core/src/wrappers/logic/utils/proxy.ts`) — переменная `runtime.current` + объект `schema.states[name]` с методами `onInit`/`onExit`/`onClick`/произвольные. Это **настоящая** FSM, написанная вручную поверх объектов.

Это даёт два источника правды, две модели транзитов (`send` vs `state.set`) и две картины «текущего состояния». На малом sandbox это терпимо, но при росте нагрузки появятся:

- неконсистентность (XState думает, что мы в `idle`, а `runtime.current` уже в `submitting`),
- невозможность инструментирования (XState DevTools, инспектор статусов — ничего не работает с `runtime`),
- невозможность guards/invoke/spawn — всё надо писать в виде `if/else` внутри хэндлеров.

## Решение

**XState становится единственным FSM-движком.** Собственный `runtime` в `ControllerProxy` удаляется. Все переходы между состояниями объявляются декларативно в схеме XState. UI-события (`onClick`, `onInput`), которые сейчас приходят в Controller через UiProxy, превращаются в **ивенты XState** (`send({ type: 'CLICK', target, ... })`).

Цепочка `next()` между Controller → Feature моделируется через **parent-child actor model** XState: дочерний actor шлёт `sendParent({ type, ... })`, родитель ловит транзитом.

## Альтернативы

### A. Оставить как есть (две модели)
Отвергнута. Долгосрочно неустойчиво, см. контекст.

### B. Выкинуть XState, оставить свой runtime
Отвергнута пользователем (`"его функционал точно подходит под то что мне надо, плюс с таким подходом легче добиться универсальности без кучи условий"`). XState даёт guards/actors/invoke/история состояний/DevTools «бесплатно».

### C. Принято: XState как канон, custom runtime удалить
Принято.

## Что меняется в коде

> [!warning]
> Это refactor-план, не план фичи. Ниже список затронутых точек.

### `packages/state/src/create.ts`
Сейчас возвращает универсальную машину с фиксированными ивентами. Должна стать **фабрикой**, которая по `IDefineStateSchema` строит **конкретную** XState-машину с реальными `states`, `on`, `entry`, `exit`, `guards`.

Константные «store-ивенты» (`SET_DATA`, `SET_LOADING`, `SET_STYLES`, `SET_ERRORS`, `REGISTER_COMPONENT`) остаются как **общие действия**, доступные в любой машине через mixin/extends — они описывают универсальный store-слой, нужный UiProxy.

### `packages/core/src/wrappers/logic/utils/proxy.ts`
Удаляется `runtime.current`, удаляется ручной поиск метода `schema.states[name][methodName]`. Proxy становится тонким: `controller.onClick(target, ctx)` → `actor.send({ type: 'CLICK', target, ctx })`.

`state.set(name)` уходит. Переходы — только через декларацию `on: { CLICK: { target: 'submitting' } }` или внутри actions через `raise({ type: 'GOTO_SUBMITTING' })`.

### `next()` → `sendParent`
`ControllerProxy.next(payload)` превращается в:
```ts
const next = (payload?) => sendParent({ type: methodName, target: { ...target, payload }, context });
```
Родительская машина (Feature) ловит как обычный ивент:
```ts
on: { LOGIN: { target: 'submitting', actions: 'callApi' } }
```

[[overrides]] остаётся: переименование типа ивента при пробросе.

### `ControllerWrapper` / `FeatureWrapper`
Используют `useActor` (из `@xstate/solid`), а не `useMachine`, чтобы поддерживать parent-child иерархию. Внутри Widget actor дочернего Controller спавнится с `parent = useActorRef()` родительского Feature.

### `UiProxy`
В обработчиках вместо `ctx.controller.onClick?.(data, ctx.store.ctx)` будет `ctx.actor.send({ type: 'CLICK', target: data })`. Сигнатура хэндлера в схеме перестаёт быть «функция, которая что-то делает» и становится «`actions:` в transition».

### `bridge` (`@capsuletech/state/createBridge`)
Остаётся, но `update`/`setLoading`/`setStyles`/`setErrors`/`registerComponent` превращаются в `send({ type: ... })` к **конкретному** actor'у, а не к глобальной машине.

`registerComponent` стоит вынести **за пределы** машины: это runtime-метаданные UI, не бизнес-состояние. Их место — обычный Solid-store или WeakMap, не XState `context`.

## Последствия

### Положительные
- Один источник правды для FSM.
- DevTools / inspector / @statelyai cloud — работают сразу.
- Guards, `invoke`, actors, history-states, parallel-states — доступны декларативно, без условий в коде.
- Семантика `next()` через `sendParent` — каноничная для actor-model, без магии.
- Легче тестировать: машина проверяется юнит-тестом без UI.

### Отрицательные
- **Breaking change в API схемы.** `state.set('foo')` исчезает; `states.idle.onClick(api)` либо исчезает, либо перепроектируется (см. open question ниже).
- Кривая обучения: разработчик теперь должен думать в терминах XState (events, transitions, actions, guards), а не «вызвал метод — поменял стейт».
- Для тривиальных Controller'ов (как `Universal.List` сейчас) станет чуть многословнее.
- Нужна осторожность с TypeScript: машины XState типизируются через `setup()` и `assign()`, придётся переписать `IDefineStateSchema`.

## Open follow-up: API-стиль схемы

XState можно «обернуть» по-разному. Это **под-решение** ADR 001, выбор пользователя:

### Стиль 1 — Полностью декларативный (canonical XState)
```tsx
const Form = Controller(({ setup }) => setup({
  context: { fields: {} },
  initial: 'idle',
  states: {
    idle: {
      on: {
        CLICK: [
          { target: 'submitting', guard: 'isSubmit' },
          { actions: 'updateField', guard: 'isInput' },
        ],
      },
    },
    submitting: {
      entry: 'callParentLogin',
      on: { DONE: 'idle' },
    },
  },
}));
```
Плюсы: канон, всё работает «бесплатно». Минусы: больше бойлерплейта, меньше похоже на текущий API.

### Стиль 2 — Гибрид (handlers + декларативные переходы)
```tsx
const Form = Controller(() => ({
  initial: 'idle',
  states: {
    idle: {
      onClick: ({ target, send, sendParent, store }) => {
        if (target.meta?.tags?.includes('submit')) {
          sendParent({ type: 'login', target });
          send({ type: 'GOTO_SUBMITTING' });
        }
      },
    },
    submitting: { /* ... */ },
  },
  // Под капотом: onClick компилируется в `on: { CLICK: { actions: <handler> } }`
  // GOTO_* — в декларативные transitions.
}));
```
Плюсы: API близок к текущему, минимум обучения. Минусы: усложняется компиляция (мы сами поддерживаем «диалект»), часть профита XState DevTools теряется.

### Стиль 3 — Чистая декларация + named actions/guards
```tsx
const Form = Controller(({ setup }) => setup({
  initial: 'idle',
  states: {
    idle: { on: { CLICK: [{ target: 'submitting', guard: 'isSubmit' }] } },
    submitting: { entry: 'login', on: { DONE: 'idle' } },
  },
  guards: { isSubmit: ({ event }) => event.target.meta?.tags?.includes('submit') },
  actions: { login: ({ event, sendParent }) => sendParent({ type: 'login', ...event }) },
}));
```
Плюсы: максимально каноничный XState, легко переиспользовать guards/actions, тестируется чище. Минусы: больше всего отличается от текущего API.

> [!question] Какой стиль выбрать?
> Это решение блокирует имплементацию. Варианты, рекомендация — стиль 3 (long-term-friendly), но если важна минимальная разница с текущим кодом sandbox — стиль 2.

## Связанное

- [[controller-proxy]] (текущая реализация — будет переписана)
- [[state|@capsuletech/state]]
- [[lifecycle]]
- [[ui-proxy]]
- ADR 002 (`Controller vs Feature` — зависит от исхода)
- ADR 007 (`Cleanup в UiProxy` — независимо)
