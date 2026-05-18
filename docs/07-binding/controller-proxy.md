---
tags: [hca, binding, proxy, logic]
status: documented
---

# 🧠 ControllerProxy — FSM + цепочка `next()`

**Файлы:**
- `packages/web/core/src/engine/controller-proxy.ts` — сам Proxy
- `packages/web/core/src/engine/logic-wrapper.tsx` — фабрика, которая собирает машину + Proxy и кладёт в Context
- `packages/web/state/src/create.ts` — `createState(schema)` строит XState-машину
- `packages/web/state/src/bridge.ts` — `createBridge(state, send)` — store-фасад

> Раньше Proxy и фабрика жили в `wrappers/logic/utils/`; после Phase E
> (изоляция runtime в `engine/`) — в `engine/`.

ControllerProxy — поведенческая часть Controller/Feature. Текущая реализация — гибрид по [[001-xstate-as-canonical-fsm|ADR 001]] + [[008-hybrid-fsm-api|ADR 008]]: XState владеет локальной FSM (transitions, entry/exit, store-context), а dispatch UI-событий и `next()` живут в Proxy.

## Два независимых канала

| Канал | Кто отвечает | Через что |
|---|---|---|
| Стейт-машина — transitions, entry/exit, context | XState | `actor.send({ type: '__GOTO_X__' })`, `state.value` |
| Dispatch UI-событий (`onClick`/`onInput`/...) + `next()` | HCA Proxy | прямой вызов `controller.<method>(target, ctx)` |

Proxy спрашивает у XState текущий стейт через `state.value` и сам резолвит метод по схеме. UI-события **не идут** через XState event-bus.

## API хэндлера

Каждый метод (`onClick`, `onInput`, `onInit`, `onExit`, `onMount`, кастомные) получает:

```ts
{
  target,    // ITarget — DOM-данные + meta + dynamicMeta + payload + key/modifiers
  context,   // store.ctx (XState context на момент вызова)
  next,      // делегирование родителю — см. ниже
  store,     // bridge: get-аккессоры + мутации + pick/omit/match/matchEntry
  state,     // { current, set(name), matches(name|names) }
}
```

Тип `IHandlerApi` зафиксирован в `packages/web/core/src/wrappers/interfaces.ts` (общий файл для ui- и logic-типов после Phase E).

## Резолв метода

```ts
const current = state.value;                                // от XState
const stateHandlers = schema.states?.[current];
const method = stateHandlers?.[methodName] ?? schema[methodName];

if (typeof method !== 'function') return await next();      // автобабблинг
return await method({ target, context, next, store, state });
```

Алгоритм:
1. Читается **текущий стейт** из XState (`state.value`).
2. Ищется хэндлер в `states[current][methodName]`.
3. Если нет — fallback на `schema[methodName]` (top-level).
4. Если и там нет — автоматически делегируем родителю через `next()`.

Это даёт ключевое свойство дизайна: **один и тот же `onClick` делает разное в разных стейтах без условных блоков**, а нерасспознанное событие «улетает» вверх по цепочке.

## state.set(name)

```ts
state.set('submitting');
// → actor.send({ type: '__GOTO_submitting__' })
```

Что происходит под капотом:

1. Proxy шлёт системный ивент `__GOTO_<name>__` в XState-машину.
2. XState переходит в новый стейт.
3. `createLogicWrapper` через `createEffect` ловит изменение `state.value` и:
   - вызывает `onExit` старого стейта,
   - вызывает `onInit` нового стейта.

`state.matches(name | name[])` проверяет, что текущий стейт совпадает.

## next(payload?)

```ts
const next = async (payload = null) => {
  if (!parent?.controller) return null;
  const enrichedTarget = { ...target, payload: payload ?? target.payload };
  const targetMethod = overrides?.[methodName] ?? methodName;
  return await parent.controller[targetMethod]?.(enrichedTarget, context);
};
```

- Прямой вызов `parent.controller[name]`. **Не идёт через XState event-bus.**
- `await` возвращает результат родительского хэндлера (натуральный promise-flow).
- Тихий no-op, если родителя нет (`return null`).
- [[overrides]] ремапит имя метода на родителе.
- `payload` поверх target — см. секцию "Двойная семантика `payload`" в [[ui-proxy|UiProxy]].

## Lifecycle: onInit / onExit

`packages/web/core/src/engine/logic-wrapper.tsx` навешивает реактивный эффект:

```ts
let prevState: string | undefined;
createEffect(() => {
  const current = state.value;
  if (prevState === undefined) {
    schema.states[current]?.onInit?.(lifecycleApi());     // initial mount
  } else if (prevState !== current) {
    schema.states[prevState]?.onExit?.(lifecycleApi());
    schema.states[current]?.onInit?.(lifecycleApi());
  }
  prevState = current;
});
```

В `lifecycleApi()` приходит та же структура `IHandlerApi`, но `target = {}` (нет триггерящего события) и `next = async () => null` (lifecycle не пузырится).

## Lifecycle: onMount (top-level)

`schema.onMount` — отдельный top-level хук, **фаерящий реактивно** при каждой регистрации компонента в `store.components`:

```ts
createEffect(() => {
  void store.components;                                    // подписка на components
  schema.onMount?.(lifecycleApi());
});
```

Семантически отличается от `states[X].onInit`:

| | `onInit` (в state) | `onMount` (top-level) |
|---|---|---|
| Когда фаерит | Вход в стейт FSM | Регистрация / анрегистрация компонента в store |
| Сколько раз | По одному разу на каждый transition в state | На mount Controller'а + на каждый `registerComponent` (включая lazy-детей) |
| Аргумент `target` | `{}` | `{}` |
| Типичный паттерн | reset формы, запустить запрос на entry | пере-синхронизировать derived-state по тегам |

**Зачем именно реактивно**, а не один раз на mount: дети могут регистрироваться **позже** первого тика рендера — `lazy()` из registry, TanStack lazy-routes, Suspense-fallback'и. Если читать `store.pick(['nav'])` на первом тике, реестр часто ещё пуст. `onMount` ловит каждую новую регистрацию.

Пример — пересинхронизировать active-state с router'ом:

```ts
onMount: ({ store }) => {
  const items = store.pick(['nav']);
  store.setProps(...computePatch(items, router.current()));
}
```

> [!warning]
> Callback **обязан** быть идемпотентным. Несколько вызовов с одним и тем же набором компонентов должны давать тот же эффект. Иначе при появлении lazy-ребёнка получите N патчей вместо одного.

XState `assign({components: ...})` создаёт новый ref на каждый `REGISTER_COMPONENT` — поэтому подписка через чтение `store.components` срабатывает на каждую регистрацию, а не на reference-equality.

## Резервные методы Proxy

| Имя | Что |
|---|---|
| `controller.store` | возвращает bridge напрямую |
| `controller.destroy` | no-op (зарезервировано для будущей очистки) |

## Связанное

- [[ui-proxy]] · [[shape]]
- [[lifecycle]] · [[overrides]]
- [[state|@capsuletech/web-state]]
- [[001-xstate-as-canonical-fsm|ADR 001]] · [[008-hybrid-fsm-api|ADR 008]]
