---
tags: [hca, architecture, lifecycle]
status: documented
---

# 🔄 Жизненный цикл — от клика до Feature

Что происходит, когда пользователь кликает по `<Button>` внутри Entity. Пошагово, по реальному коду.

## Карта участников

```
┌──────────────┐
│ Page         │   pages/auth/login.tsx
└──────┬───────┘
       │ <Widgets.Forms.Auth />
       ▼
┌──────────────┐
│ Widget       │   widgets/forms/auth.tsx
└──────┬───────┘
       │ <Features.Auth.Login>          ← XState-машина + Proxy + Context.Provider
       │   <Controllers.Universal.Form> ← XState-машина + Proxy + Context.Provider
       │     <Entities.Auth.LoginForm>  ← UiProxy подменяет Field/Button/Input
       │       <Button meta={{tags:['submit']}}>
       │     </Entities.Auth.LoginForm>
       │   </Controllers.Universal.Form>
       │ </Features.Auth.Login>
       ▼
```

## Шаг 1. Mount

При рендере `Widget` для каждого Controller/Feature:

1. `createLogicWrapper` (`packages/web/core/src/engine/logic-wrapper.tsx`) делает:
   - `parent = useCtx()` — берёт Context от родителя в дереве (если есть);
   - `services = buildServices(kind)` — Controller получает `{ router }`, Feature будет получать больше по мере появления уникальных services (см. [[002-controller-vs-feature|ADR 002]]);
   - `schema = defineStateSchema(services)` — пользовательская схема;
   - `machine = createState(schema)` — XState-машина с реальными states и `__GOTO__`-транзитами ([[008-hybrid-fsm-api|ADR 008]]);
   - `[state, send] = useMachine(machine)`;
   - `store = createBridge(state, send)` — фасад со всеми геттерами и tag-операциями;
   - `controller = ControllerProxy({ schema, state, send, store, parent, overrides })`.

2. Вешает `createEffect` для lifecycle: при изменении `state.value` вызывает `onExit` старого стейта и `onInit` нового. Initial-onInit срабатывает на первом проходе.

3. Кладёт `{ controller, state, store, parent }` в Context.Provider.

4. `EntityWrapper` (`packages/web/core/src/wrappers/entity.tsx`) при рендере Entity:
   - читает `ctx = useCtx()`;
   - оборачивает базовый UI-kit через `UiProxy(ctx, wrapperProps)` (или возвращает голый Ui, если ctx нет);
   - рендерит `<Component {...Ui} />`.

## Шаг 2. Render внутри Entity

Когда внутри Entity рендерится `<Button meta={{ tags: ['submit'] }}>`:

1. `UiProxy` (`packages/web/core/src/engine/ui-proxy.tsx`) перехватывает обращение к `Button` и оборачивает в `ComponentWrapper`.

2. `ComponentWrapper` мержит wrapperProps + componentProps + добавляет `dynamicMeta = wrapperProps?.meta` — это даёт **two-tier meta** (см. [[ui-proxy|UiProxy]] и [[tagging-system]]).

3. Проверяется политика регистрации (C — own meta): есть ли у этого JSX-узла **собственный** `meta`? Если нет — рендерится без побочных эффектов. Если да:
   - генерится стабильный `id = createUniqueId()`;
   - выводится `name` из первого «конкретного» (без `@`-префикса) тега в `meta.tags`;
   - `createEffect(() => store.registerComponent({ [id]: { ...props, name } }))` — запись в стор + реактивное обновление при изменении props;
   - `onCleanup(() => store.unregisterComponent(id))` — снятие при unmount.

4. Биндятся 6 событий ([[009-event-interception-extension|ADR 009]]): `onClick`, `onInput`, `onChange`, `onBlur`, `onFocus`, `onKeyDown`. Каждый помечен флагом `__capsule_<eventName>__` для дедупликации на bubbling.

5. `dynamicProps` подменяет реактивные `class` (с подмесом `store.styles[name]`), `disabled` (с `store.loading`) и `name` (выведенный из тегов). DOM-узел `<button name="submit">` получает атрибут «под капотом».

## Шаг 3. Click

Пользователь кликает.

1. DOM `click` → перехваченный `onClick` из UiProxy.
2. Проверка дедупликации: если уже сработал у потомка ниже — `return`. (Иначе один клик дал бы два вызова на каждом уровне обёртки.)
3. Собирается `target` через `getTargetData`: `{ name, value, type, meta, dynamicMeta, key, modifiers }`.
4. Вызывается `controller.onClick(target, store.ctx)`.

## Шаг 4. ControllerProxy резолвит метод

`controller` — это **Proxy** из `proxy.ts`. Обращение к `controller.onClick` возвращает асинхронную функцию, которая:

1. Берёт **текущий стейт от XState**: `current = state.value`.
2. Ищет хэндлер: `schema.states[current]?.onClick` → если нет, `schema.onClick` (top-level) → если и там нет, `await next()` (делегация наверх).
3. Если нашёлся — вызывает с API:
   ```ts
   { target, context, next, store, state }
   ```
   - `state.set(name)` шлёт `__GOTO_<name>__` в XState; `createEffect` ловит изменение и вызывает `onExit/onInit`.
   - `state.matches(name | name[])` сверяет текущий стейт.
   - `next(payload?)` дёргает `parent.controller[methodName]` (или ремап через [[overrides]]). **Не идёт через XState event-bus** — прямой вызов, естественный `await`-возврат.

## Шаг 5. Цепочка `next()`

Если Controller вызвал `next()`:

```
Entity.Button onClick (DOM)
   ↓
UiProxy → controller.onClick(target, ctx)
   ↓
Controller.Form.states.idle.onClick({ target, next, ... })
   ↓ if (target.meta.tags.includes('submit')) → await next(store.ctx.data)
   ↓
Feature.Auth.Login.states.idle.onClick({ target: { ..., payload: data }, ... })
   ↓ await api.login(...) → router.goTo('/dashboard')
```

Возврат идёт обратно по цепочке промисов. Если родителя нет — `next()` возвращает `null`, ошибки не возникает.

## Шаг 6. Реактивный обратный путь

Когда Controller/Feature вызывает `store.setLoading(true)`:

1. `bridge.setLoading` отправляет `send({ type: 'SET_LOADING', value: true })` в XState.
2. Машина обновляет `context.loading` через `assign`.
3. Solid реактивно ловит обращение `store.loading` (через геттер в bridge) → пересчитывает `disabled` в UiProxy → DOM-нода `<button>` обновляется.

> [!info]
> Тут работает fine-grained reactivity Solid: перерисуется **только** свойство `disabled` у конкретной кнопки, а не весь Controller/Widget.

## Связанное

- [[ui-proxy|🪞 UiProxy — детали]]
- [[controller-proxy|🧠 ControllerProxy — детали]]
- [[tagging-system|🏷️ Meta-теги]]
- [[layers]]
