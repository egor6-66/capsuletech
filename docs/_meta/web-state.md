---
tags: [meta, web-state, ai-context]
status: documented
type: ai-anchor
audience: claude
last-verified: 2026-05-27
---

# 🤖 Web State — AI context anchor

> [!ai]
> Шпаргалка для Claude-инстансов. Без воды. Юзеру — `docs/09-packages/state.md`.

## TL;DR

XState-обвязка фреймворка. **`createState(schema)`** превращает HCA-схему в XState-машину с инжектированными universal events (SET_DATA, SET_LOADING, REGISTER_COMPONENT и ещё 5) и автоматическими `__GOTO_*` переходами. **`createBridge(state, send)`** — реактивный API поверх XState-snapshot: геттеры (ctx/loading/styles/errors/components/props), мутации (update/registerComponent/updateComponent/…) и tag-операции (pick/omit/match/matchEntry/patch/values). **Tag-registry** хранит алиасы (`@inputs` → `[email, password, …]`), раскрывает их рекурсивно на query-стороне.

`IBaseStateSchema` — **единственное место** в репо, где живёт engine-shape (Phase F unification). `web-core` расширяет этот тип, не наоборот.

## Где что лежит

| Файл | Что |
|---|---|
| `packages/web/state/src/index.ts` | Публичный barrel: `createState`, `createBridge`, 4 helpers, 4 tag-registry функции + все типы |
| `packages/web/state/src/create.ts` | `createState(schema)` — фабрика XState-машины. `IBaseStateSchema`, `IBaseStateHandlers`, `IMachineContext`. Все universal events + GOTO-инжект. |
| `packages/web/state/src/bridge.ts` | `createBridge(state, send)` — Bridge-объект. Геттеры + мутации + tag-операции. `IBridge`, `IBridgeSend`, `IBridgeStateSnapshot`, `IRegisteredComponent`, `BridgeMatchOptions`. |
| `packages/web/state/src/helpers.ts` | `pickByTags`, `omitByTags`, `matchByTags`, `matchEntryByTags` — низкоуровневые tag-фильтры. `ComponentData`, `MatchOptions`. |
| `packages/web/state/src/tag-registry.ts` | `registerAliases`, `expandTags`, `getAliases`, `clearAliases` — module-level реестр алиасов с defaults. |
| `packages/web/state/src/__tests__/create.test.ts` | Unit: createState, GOTO-инжект, SET_DATA/UPDATE_COMPONENT reducer |
| `packages/web/state/src/__tests__/bridge.test.ts` | Unit: все Bridge-методы (getters, mutations, tag ops, patch, values) |
| `packages/web/state/src/__tests__/helpers.test.ts` | Unit: pickByTags/omitByTags/matchByTags/matchEntryByTags, edge cases |
| `packages/web/state/src/__tests__/tag-registry.test.ts` | Unit: registerAliases accumulation, expandTags recursive, clearAliases reset |

## Public API

```ts
import {
  createState,          // (schema: IBaseStateSchema) => AnyStateMachine
  createBridge,         // (state: IBridgeStateSnapshot, send: IBridgeSend) => IBridge

  // Tag-helpers (низкоуровневые, работают напрямую на ComponentsList)
  pickByTags,           // (data, tags, opts?) => ComponentsList
  omitByTags,           // (data, tags, opts?) => ComponentsList
  matchByTags,          // (data, tags, opts?) => ComponentData | undefined
  matchEntryByTags,     // (data, tags, opts?) => { id, ...ComponentData } | undefined

  // Tag-registry
  registerAliases,      // (aliases: Record<string, readonly string[]>) => void
  expandTags,           // (tags: readonly string[]) => string[]
  getAliases,           // () => Readonly<Record<string, readonly string[]>>
  clearAliases,         // () => void

  type IBridge,
  type IBridgeSend,
  type IBridgeStateSnapshot,
  type IRegisteredComponent,
  type BridgeMatchOptions,
  type IBaseStateSchema,
  type IBaseStateHandlers,
  type IMachineContext,
  type ComponentData,
  type MatchOptions,
} from '@capsuletech/web-state';
```

### Ключевые типы

```ts
interface IBaseStateSchema<TCtx = any> {
  initial: string;
  context?: TCtx;         // user state — попадает в context.data
  states: Record<string, IBaseStateHandlers>;
  [methodName: string]: any;  // top-level handlers (onSubmit, onClick, ...)
}

interface IMachineContext<TCtx = any> {
  data: TCtx;                          // ТОЛЬКО user state из schema.context
  loading: boolean;
  errors: Record<string, string>;
  styles: Record<string, string>;
  components: Record<string, any>;     // зарегистрированные UI-компоненты (UiProxy)
  props: Record<string, Record<string, any>>;  // runtime props-патчи (по id)
}

interface IRegisteredComponent {
  meta?: { tags?: readonly string[]; [k: string]: unknown };
  dynamicMeta?: { tags?: readonly string[]; [k: string]: unknown };
  payload?: Record<string, unknown>;
  name?: string;
  value?: unknown;
  type?: string;
  [k: string]: unknown;
}
```

## Engine flow

`createState(schema)` строит XState-машину в три шага:

```
schema.states → Object.keys(stateNames)
  ├── GOTO-переходы: для каждого state → "__GOTO_<state>__": { target: ".<state>" }
  │    (инжектируются в машину автоматически, не пишутся руками)
  │
  ├── Начальный context: { data: schema.context ?? {}, loading: false, errors: {},
  │    styles: {}, components: {}, props: {} }
  │
  └── Universal events (on: {...}):
       SET_DATA          → assign: context.data = { ...context.data, ...event.payload }
       SET_LOADING       → assign: context.loading = event.value
       SET_STYLES        → assign: context.styles = event.styles  (полная замена)
       SET_ERRORS        → assign: context.errors = event.errors  (полная замена)
       REGISTER_COMPONENT → assign: context.components = { ...components, ...event.payload }
       UNREGISTER_COMPONENT → assign: удаляет id из components И props
       UPDATE_COMPONENT  → assign: merge patch к существующей записи (неизвестный id игнорится)
       SET_PROPS         → assign: merge patch к context.props[id] (per-id, неразрушающий)
```

UI-события (`onClick`, `onInput`, `onInit`, `onExit`) **не идут** через XState event-bus — они обрабатываются напрямую в ControllerProxy (web-core). Машина видит только store-мутации и GOTO.

## Bridge mechanic

`createBridge(state, send)` — тонкая обёртка над XState-snapshot. `state` — реактивный объект от `useMachine` (`@xstate/solid`); геттеры Bridge'а читают из него живые значения.

### Геттеры

| Bridge getter | Источник | Fallback |
|---|---|---|
| `ctx` | `state.context` | — (raw, без fallback) |
| `loading` | `state.context.loading` | — |
| `styles` | `state.context.styles` | `{}` |
| `errors` | `state.context.errors` | `{}` |
| `components` | `state.context.components` | `{}` |
| `props` | `state.context.props` | `{}` |

### Мутации (Bridge method → XState event → reducer effect)

| Bridge method | XState event | Reducer effect | Когда использовать |
|---|---|---|---|
| `update(payload)` | `SET_DATA` | merge в `context.data` | User state из `schema.context` (form values через хэндлер, бизнес-данные) |
| `setLoading(bool)` | `SET_LOADING` | replace `context.loading` | Async-операции: `true` перед fetch, `false` после |
| `setStyles(map)` | `SET_STYLES` | replace `context.styles` | CSS-классы по компоненту (UiProxy читает при рендере) |
| `setErrors(map)` | `SET_ERRORS` | replace `context.errors` | Validation errors по полю |
| `setProps(payload)` | `SET_PROPS` | merge per-id в `context.props` | Низкоуровневый props-патч по известному id компонента |
| `registerComponent(payload)` | `REGISTER_COMPONENT` | merge в `context.components` | UiProxy — единоразово на mount элемента с `meta` |
| `updateComponent(payload)` | `UPDATE_COMPONENT` | merge patch к записи (неизвестный id игнорится) | UiProxy — runtime-патч после mount (onInput/onChange → обновление `value`/`type`) |
| `unregisterComponent(id)` | `UNREGISTER_COMPONENT` | удаляет id из `components` и `props` | UiProxy — `onCleanup` при unmount |

**Семантика разделения `registerComponent` / `updateComponent`:**
- `registerComponent` — один раз при mount, пишет всю запись (`meta`, `name`, `dynamicMeta`, …).
- `updateComponent` — runtime-патч после register'а; UiProxy шлёт его при `onInput`/`onChange` для обновления `value`. Если id не зарегистрирован — молча игнорится (порядок mount/event не должен ломать app).
- Не путать с `update()` (SET_DATA → `context.data` — это user state).

## Tag operations

Все tag-операции Bridge'а используют `BridgeMatchOptions`:
```ts
interface BridgeMatchOptions {
  lookDynamic?: boolean;    // учитывать dynamicMeta.tags. Default: true
  expandAliases?: boolean;  // раскрывать алиасы из tag-registry. Default: true
}
```

| Метод | Возвращает | Когда использовать |
|---|---|---|
| `pick(tags, opts?)` | `Record<id, IRegisteredComponent>` | Все компоненты с хотя бы одним из тегов. Форм-payload сбора, bulk-disable. |
| `omit(tags, opts?)` | `Record<id, IRegisteredComponent>` | Все компоненты без указанных тегов. Инвертированная фильтрация. |
| `match(tags, opts?)` | `IRegisteredComponent \| undefined` | Первый компонент по тегам. Для single-target операций. |
| `matchEntry(tags, opts?)` | `{ id, ...IRegisteredComponent } \| undefined` | Первый компонент + его id. Когда нужен id для последующего patch/unregister. |
| `patch(tags, patchOrFn, opts?)` | `void` | Tag-based props-патч. Один `send(SET_PROPS)` на все совпадения. `patchOrFn` — объект (одинаковый patch для всех) или `(comp, id) => patch \| null` (per-component). |
| `values(tags, opts?)` | `Record<name, value>` | Form-payload: `{ [comp.name]: comp.value }` для matched компонентов. Skip nameless. |

**`values` детали:** используется в submit-хэндлерах. `store.values(['@inputs'])` раскрывает алиас и собирает payload формы одной строкой. Компоненты без `name` (например кнопки) пропускаются. Дублирующиеся `name` — last-write-wins (симптом ошибки разработчика).

**`patch` детали:** если `patchOrFn` — функция, возврат `null`/`undefined`/`{}` пропускает компонент. Если ни один компонент не дал непустой patch — `send` не вызывается.

## Tag aliases

Реестр живёт в `tag-registry.ts` как module-level переменная.

**Дефолты (hard-coded в модуле):**
```ts
'@inputs'  → ['email', 'password', 'phone', 'text', 'number']
'@actions' → ['submit', 'cancel', 'reset']
```

**Expansion — рекурсивная с защитой от циклов:**
```ts
registerAliases({ '@form': ['@inputs', 'select'] });
expandTags(['@form']);
// → ['@form', '@inputs', 'email', 'password', 'phone', 'text', 'number', 'select']
```
BFS с `seen`-множеством: каждый тег обрабатывается один раз. Цикл `A → B → A` не ломает expansion.

**Где регистрировать алиасы:** в `BaseProviders` на mount (web-core). Очищается `clearAliases()` при unmount или в test-setup.

**Принципиально:** алиасы — **query-side зонтик**. В JSX компоненты несут raw tags (`meta={{ tags: ['email'] }}`). Алиас раскрывается при вызове `pick`/`omit`/`match`/`values`, а не при регистрации. Не пиши `@inputs` в `meta.tags` на JSX-узле.

## Известные грабли

1. **`context.data` — ТОЛЬКО user state.** `update({ foo: 'bar' })` пишет в `context.data` через SET_DATA. UiProxy **не пишет** в `data` — он пишет в `context.components` (REGISTER/UPDATE_COMPONENT). До PR #166 был смешанный подход; после — строгое разделение. Если видишь component-данные в `context.data` — это регрессия.

2. **`updateComponent` vs `update` — разные каналы.** `bridge.update(payload)` → SET_DATA → `context.data` (бизнес-state). `bridge.updateComponent(payload)` → UPDATE_COMPONENT → `context.components[id]` (UI-регистрация). Путаница между ними — источник багов, где значения формы оседают не там.

3. **`IBridgeStateSnapshot` требует только `.context`.** Bridge не использует `state.value`, `state.status` и т.д. Это намеренно: Bridge — чистый store-API, FSM-состояние читается отдельно через `useCtx()` в web-core. Mock в тестах: `{ context: {...} } as IBridgeStateSnapshot`.

4. **`tag-registry` — module-level state.** При SSR с несколькими root'ами — гонка (сейчас CSR-only, не проблема). В тестах **обязательно** `clearAliases()` в afterEach/после каждого кейса, иначе алиасы одного теста протекают в следующий.

5. **`values()` — last-write-wins при дублях `name`.** Не бросает исключение — намеренная лениность. Если `values()` возвращает только одно значение вместо двух — проверь дублирующиеся `name` в JSX-компонентах.

6. **`IBaseStateSchema` живёт здесь (Phase F).** web-core импортирует отсюда и расширяет через `IDefineStateSchema extends IBaseStateSchema`. Не добавляй controller/feature-specific поля (`services`, `overrides`) в base. Это создаст циклическую зависимость `web-state → web-core`.

7. **`createState` НЕ создаёт actor.** Возвращает XState `AnyStateMachine`. Actor создаётся в `createLogicWrapper` (web-core) через `useMachine` из `@xstate/solid`. Не вызывай `interpret()` или `createActor()` здесь — будет дублирующийся actor.

8. **GOTO — кастомный механизм, не XState-native.** `state.set('submitting')` в ControllerProxy шлёт `{ type: '__GOTO_submitting__' }`. `createState` автоматически инжектирует переход `__GOTO_<name>__` для каждого state из `schema.states`. Если вручную определить event с таким именем в `schema` — конфликт с инжектом.

9. **Геттеры Bridge'а реактивны через Solid.** Присваивание `const comps = bridge.components` вне реактивного контекста ломает отслеживание. Используй внутри `createMemo`/`createEffect`/JSX или через `bridge.ctx.components` в handler'е (там реактивность не нужна — handler вызывается при событии, не при render'е).

## Что менять когда

| Хочу… | Куда лезть |
|---|---|
| Новый universal event (например `RESET_DATA`) | `create.ts` → добавить в `on: {}` + assign; `bridge.ts` → новый метод-мутация + тип; тесты в обоих `__tests__/` файлах |
| Новый Bridge-метод (например `count(tags)`) | `bridge.ts` → реализация + `IBridge` тип (если хочешь именованный тип); тест в `bridge.test.ts` |
| Новый tag-helper (например `groupByTags`) | `helpers.ts` → функция + `MatchOptions`-совместимая сигнатура; `index.ts` → экспорт; тест в `helpers.test.ts` |
| Добавить поле в `IRegisteredComponent` | `bridge.ts > IRegisteredComponent`; согласуй с owner-web-core (UiProxy строит payload) |
| Изменить `IMachineContext` shape | `create.ts` → type + initial context + reducer (если нужно); `bridge.ts` → геттеры; `web-core > engine/ui-proxy.tsx` — downstream consumer (координация с owner-web-core) |
| Изменить alias resolution (например добавить default-алиасы) | `tag-registry.ts > aliases` init; тесты в `tag-registry.test.ts` |
| Рекурсивный limit на expansion depth | `tag-registry.ts > expandTags` — сейчас BFS без limit, защита только от циклов |
| SSR-aware изоляция registry | Нужен ADR. Переход от module-level переменной к Provider-scope injection. |
| Расширить `IBaseStateSchema` | Только engine-level поля. Controller/Feature-specific (`services`, `overrides`) → в web-core через `extends`. |

## Cross-links

- OWNERSHIP: `packages/web/state/OWNERSHIP.md` (нет — создать после первого нетривиального изменения)
- ADRs: [[001-xstate-only-fsm]], [[005-tag-aliases-registry]], [[008-hybrid-fsm-api]], [[020-bridge-untangling]]
- Docs: `docs/09-packages/state.md` — user-facing (не дублировать здесь)
- Связанные пакеты: [[web-core]] (главный consumer — createLogicWrapper, UiProxy, createBridge usage), [[web-query]] (Features через Bridge в services)
- Release: web-state в группе `web_base` (fixed-versioning, tag `web@{version}`)
- Peers: `solid-js ^1.9.0`, `xstate ^5.0.0`
