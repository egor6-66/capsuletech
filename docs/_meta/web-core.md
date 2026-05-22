---
tags: [meta, web-core, ai-context]
status: documented
type: ai-anchor
audience: claude
last-verified: 2026-05-21
---

# 🤖 Web Core — AI context anchor

> [!ai]
> Шпаргалка для Claude-инстансов. Без воды. Юзеру — [[core|core.md]] (когда появится).

## TL;DR

Корневой пакет HCA-фреймворка. **Семь** wrapper-функций: `View`, `Widget`, `Page`, `Shape`, `Controller`, `Feature` (UI/logic слои) + `Entity` (domain data layer — plain config, не компонент). Поверх двух Proxy-движков: **UiProxy** (per-instance event-binding + meta-registration) и **ControllerProxy** (FSM-aware dispatch с auto-bubbling через `next()`). `createRoot()` — DOM-bootstrap (`render` + theme-injection). `BaseProviders` — composition корневых providers (RouterProvider + VitalsMonitoring). `Ui` — namespace lazy-импортов всех web-ui примитивов через `createLazy()`.

**Семантика wrapper-args (v0.3.0+)**: `(Ui, props?)` для UI-слоёв, `(services)` для logic-слоёв. Всё остальное — глобалы через `Object.assign(globalThis, _registry)` в bootstrap. См. ADR 002 + commit 477b0fb.

## Где что лежит

| Файл | Что |
|---|---|
| `packages/web/core/src/index.ts` | публичный barrel: 7 wrappers + `useShapeUi` + `Providers` namespace + типы |
| `packages/web/core/src/wrappers/entity/wrapper.ts` | `Entity` — domain data layer factory. Plain config (не компонент). `Object.freeze(factory(z))`. |
| `packages/web/core/src/wrappers/entity/types.ts` | `IEntityDefinition`, `IEntityFactory`, `IEntityWrapper` |
| `packages/web/core/src/wrappers/view.tsx` | `ViewWrapper` — простой leaf, UiProxy под ControllerContext, ShapeUiContext.Provider |
| `packages/web/core/src/wrappers/widget.tsx` | `WidgetWrapper` — добавляет `Outlet` в Ui, ShapeUiContext.Provider |
| `packages/web/core/src/wrappers/page.tsx` | `PageWrapper` — `{ Layout, Outlet, Animate }` в Ui, ShapeUiContext.Provider |
| `packages/web/core/src/wrappers/shape/wrapper.tsx` | `ShapeWrapper` — batch flow (v0.4.0+): `splitProps`+`mergeProps`, передаёт `data` + extras в `as` через `Dynamic`. Path-tracker резолвится через `ShapeUiContext`. |
| `packages/web/core/src/wrappers/shape/context.tsx` | `ShapeUiContext` — несёт **только** Ui (после revert PR #114) |
| `packages/web/core/src/wrappers/shape/ui-path-tracker.ts` | Proxy-based path-tracker для `as: ui.X.Y` |
| `packages/web/core/src/wrappers/logic-wrapper.tsx` | `createLogicWrapper(kind)` — Controller/Feature общая фабрика (services injection + XState + lifecycle) |
| `packages/web/core/src/wrappers/interfaces.ts` | публичные типы: `IViewWrapper`, `IWidgetWrapper`, `IPageWrapper`, `IDefineStateSchema`, `ITarget`, `IHandlerApi` |
| `packages/web/core/src/engine/ui-proxy.tsx` | UiProxy — `EVENT_HANDLERS` (6 событий), meta-registration, event-bubble dedup |
| `packages/web/core/src/engine/controller-proxy.ts` | ControllerProxy — dispatch state lookup, `next()` bubbling, state.set/matches |
| `packages/web/core/src/engine/ctx.ts` | `useCtx()` — ControllerContext (xstate state + send + bridge) |
| `packages/web/core/src/engine/derivation.ts` | `deriveName`, `deriveInputType`, `TAG_TO_INPUT_TYPE` |
| `packages/web/core/src/engine/registry.ts` | `getGlobalRegistry(key)` — читает `globalThis.Widgets/Views/...` |
| `packages/web/core/src/ui-kit/imports.tsx` | `Ui` — lazy-импорты всех web-ui примитивов через `createLazy` |
| `packages/web/core/src/providers/base.tsx` | `BaseProviders` — RouterProvider + VitalsMonitoring |
| `packages/web/core/src/create/createRoot.ts` | DOM bootstrap: `render(Bootstrap, container)` + theme `data-theme` |
| `packages/web/core/src/wrappers/__tests__/view-props.test.tsx` | 7 характеризационных тестов нового `(Ui, props)` контракта |

## Public API

```ts
import {
  View, Widget, Page, Controller, Feature, Shape,    // 6 UI/logic wrappers (глобалы через AutoImport в apps)
  Entity,                                             // domain data layer wrapper (глобал через AutoImport — pending owner-builders)
  Providers,                                          // namespace { BaseProviders }
  useShapeUi,                                         // hook — Ui namespace из ShapeUiContext
  type ITarget, type IHandlerApi,
  type IDefineStateSchema, type IStateHandlers,
  type IServices, type IWrapperProps,
  type INext, type IStateApi,
  type IViewWrapper, type IViewRenderer,
  type IUiMetaProps, type ITagMeta,                  // UiProxy meta-props для Ui-компонентов
  type IEntityDefinition, type IEntityWrapper,        // Entity-specific types
} from '@capsuletech/web-core';

import { createRoot } from '@capsuletech/web-core/create';
import { BaseProviders } from '@capsuletech/web-core/providers';
```

### Wrapper-сигнатуры (v0.3.0+)

```ts
// Domain data layer — НЕ компонент, plain frozen config object
Entity((z: CapsuleZ) => {
  schema: ZodType;          // любая zod-схема (обычно z.array(z.object(...)))
  defaults?: TData;         // sample fixtures для разработки и тестов
}): { schema: ZodType; defaults?: TData }   // возвращает ровно то что вернула factory (frozen)

View<P>((Ui: ViewUi, props: P) => JSX.Element): Component<P>
Widget<P>((Ui: WidgetUi, props: P) => JSX.Element): Component<P>
Page<P>((Ui: PageUi, props: P) => JSX.Element): Component<P>
// v0.4.0: batch flow — Shape НЕ итерирует, передаёт data[] целиком в as-template
Shape((z: ZodHelpers, ui: UiPathTracker) => {
  schema: ZodArray;
  defaults?: TData[];
  as?: Component;        // batch-template (Ui.List / Ui.DataTable / custom)
  [extraKey: string]: unknown; // columns, sorting, itemAs, etc → forwarded to as
}): Component<{
  data?: TData[];        // overrides defaults
  as?: Component;        // overrides definition.as
  [extraKey: string]: unknown; // consumer extras win over definition extras
}>
Controller((services: IServices) => IDefineStateSchema): Component
Feature((services: IServices) => IDefineStateSchema): Component
```

**Shape v0.4.0 BREAKING:** `props: (item) => ...` per-item mapper и `children` render-prop удалены. `IShapeTemplateProps` и `IShapeRender` убраны из публичного API. Используй batch-templates (`Ui.List` / `Ui.DataTable`). Реактивность через `splitProps` + `mergeProps`.

**Generic `<P extends Record<string, any>>`** на View/Widget/Page renderer'ах — для типизации props на call site (Shape `as`-pattern: template-View получает item-данные как props).

**Registries — глобалы** (доступны прямо из factory body):
- `Views` / `Widgets` / `Shapes` / `Controllers` / `Features` — через `Object.assign(globalThis, _registry)` в bootstrap.
- `Ui` — единственное что приходит **параметром**, потому что per-instance (UiProxy под текущий ControllerContext).

## Lifecycle flow

```
apps/<app>/src/pages/welcome.tsx                  ← Page((Ui) => <Ui.Layout.Matrix slots={...}>)
  └─ PageWrapper готовит pageUi = { Layout, Outlet, Animate }
       └─ ShapeUiContext.Provider value={pageUi}
            └─ Component(pageUi, wrapperProps)            ← factory вызвана, JSX из неё
                 └─ <Widgets.Auth.Login />                ← глобал, lazy()
                      └─ WidgetWrapper готовит baseUi = { ...Ui, Outlet }
                           └─ ShapeUiContext.Provider value={baseUi}
                                └─ Component(baseUi, wrapperProps)
                                     └─ <Features.Viewer.Auth>          ← глобал
                                          └─ createLogicWrapper готовит services
                                               └─ <Controllers.Universal.Form>
                                                    └─ createLogicWrapper готовит services
                                                         └─ ControllerContext.Provider
                                                              └─ <Ui.Card>
                                                                   └─ <Views.Forms.Field />   ← глобал
                                                                        └─ ViewWrapper:
                                                                             useCtx() → ControllerContext
                                                                             UiProxy(BaseUi, ctx, props)
                                                                             ShapeUiContext.Provider
                                                                             Component(proxiedUi, wrapperProps)
                                                                             ↓
                                                                             event-binding ✓
                                                                             meta-registration ✓
                                                                             store-styled class ✓
```

## UiProxy mechanic (engine/ui-proxy.tsx)

Policy **C — own meta opt-in**: побочные эффекты (registration, event-binding) активируются **только** на JSX-узлах с явным `meta={{...}}`. Структурные обёртки (Field, Card, Field.Label) проходят сквозным рендером.

Для элементов с `meta`:
- `id = createUniqueId()` (стабильный) + `createEffect` для re-register на изменение props + `onCleanup` для unregister
- автоподписка на 6 событий: `onClick`, `onInput`, `onChange`, `onBlur`, `onFocus`, `onKeyDown`
- дедупликация bubbling через event-marker `__capsule_<event>__`
- инжект реактивного `class` (с подмесом `store.styles[name]`), `disabled` (из `store.loading`), `name` (deriveName из tags)
- `target` собирается как `{ meta, dynamicMeta, key, modifiers, payload }`

## ControllerProxy mechanic (engine/controller-proxy.ts)

- Текущий стейт **читается из XState**: `state.value`. Собственного runtime нет.
- При вызове `controller.<method>(target, ctx)` ищет хэндлер: `schema.states[current][method]` → `schema[method]` (top-level) → `await next()` (автобабблинг).
- Передаёт в хэндлер API: `{ target, context, next, store, state }`.
- `state.set(name)` — `__GOTO_<name>__` в XState; `state.matches(name|name[])` — сверка.
- `next(payload)` — **прямой вызов** `parent.controller[name]`, не XState event-bus. Опционально ремапит имя через `overrides` prop на Controller-обёртке.

## Известные грабли

19. **`Entity` — единственный wrapper без Solid-компонента.** Все остальные wrappers (`View`, `Widget`, `Page`, `Controller`, `Feature`, `Shape`) возвращают `Component<P>`. `Entity` возвращает **frozen plain object** `{ schema, defaults? }`. HMRWrappingPlugin не трогает `entities/` файлы (нет `const X = Wrapper(...)` component pattern). UiProxy и ControllerProxy к Entity не применяются — это pure data layer. AutoImport делает `Entity` глобальным через `WRAPPER_NAMES` (owner-builders добавляет). Codegen `Entities.*` — через `ExportGeneratorPlugin` scan `entities/` (owner-builders добавляет).

20. **Типизация `Entities.*` глобала пока пуста.** `interface Entities {}` в `wrappers/interfaces.ts` — placeholder. Заполняется через codegen (ExportGeneratorPlugin scan `entities/` → `.capsule/@types/slots.d.ts`). До добавления owner-builders: `Entities.Users` будет `any`; после — `typeof import('@entities/users').default`.

1. **`createRoot` ≠ Solid `createRoot`.** Наш — render-фабрика (`render(Bootstrap, container)` + `data-theme` inject). Solid'ская — для реактивного scope без рендера. Часто путают. Источник: `src/create/createRoot.ts`.

2. **CSS удалён из пакета.** `createRoot` больше не делает `import './styles.css'`. Приложение само импортирует `.capsule/styles.css` (генерится `ScaffoldPlugin` из builders). Если CSS не применяется — смотри `bootstrap.tsx.template` в vite-builder scaffold.

3. **`Providers` — namespace, не named export.** `import { Providers } from '@capsuletech/web-core'; <Providers.BaseProviders>`. Расширяемая namespace для будущих `Providers.TestingProvider`. Не плющи в named.

4. **`Ui.Layout` — plain object**, не вызываемый компонент. `{ Grid, Flex, Matrix }` — три lazy-компонента. Источник: `src/ui-kit/imports.tsx:17`. В отличие от него, `Ui.Table` — вызываемый compound (`Object.assign(TableBase, { Header, Body, Row, Head, Cell })`), доступен в `ViewUi` и `WidgetUi`. `Ui.DataTable` — простой callable (без sub-components), доступен в `ViewUi` и `WidgetUi`. Generic `<TData>` — TS инферирует тип строки из `data`/`columns` props. Subpath: `@capsuletech/web-ui/dataTable`. `Ui.ThemeSwitcher` — plain callable из `@capsuletech/web-style` (localStorage persistence + `data-theme` на `<html>`), доступен в `ViewUi` и `WidgetUi`. Импортируется из main barrel (subpath `./switcher` — framework gap в web-style, pending architect).

5. **Все `Ui.*` — lazy через `createLazy`.** Обёртка над `lazy(() => import(...).then(m => ({ default: m[name] })))`. Нужен `<Suspense>` вокруг дерева. `createRoot` оборачивает в Suspense автоматически.

6. **UiProxy policy C — own meta opt-in.** Побочные эффекты только если на JSX-узле явно `meta={{...}}`. Структурные обёртки (Field, Card) проходят сквозным рендером. Изменение этой политики — массовый impact, нужен ADR.

7. **`EVENT_HANDLERS` — захардкожены 6 событий.** `onClick`, `onInput`, `onChange`, `onBlur`, `onFocus`, `onKeyDown`. Добавление нового (`onScroll`) — правка `engine/ui-proxy.tsx > EVENT_HANDLERS` + опционально `engine/derivation.ts > TAG_TO_INPUT_TYPE`. См. ADR 009.

8. **`next(payload)` — прямой вызов**, не XState event. `parent.controller[name]` через `await`. Не переписывай на event-bus без ADR (см. ADR 008 — гибридная FSM-схема).

9. **`engine/*` — НЕ public.** `index.ts` не экспортирует ничего из `engine/`. Если что-то из engine нужно во внешнем коде — симптом, документируй причину перед public-экспортом.

16. **`IUiMetaProps` (`meta`/`payload`/`dynamicMeta`/`modifiers`) — UiProxy-layer, не web-ui.** `<Ui.Input meta={{tags:['email']}} />` типизируется через `WithMetaProps<ViewUiRaw>` в `wrappers/interfaces.ts`. UiProxy перехватывает эти props в `wrapComponent` и не прокидывает их в реальный DOM-компонент. web-ui компоненты их не знают — типы расширяются здесь (web-core), не там. Источник: `src/wrappers/interfaces.ts`.

17. **Compound sub-components (`Card.Header`, `Field.Label`, …) сохраняются через `StaticProps<T>`.** `WithMetaProps` для callable `T[K]` возвращает `((props: P & IUiMetaProps) => R) & WithMetaProps<StaticProps<T[K]>>`. `StaticProps<T>` — `{ [K in keyof T as K extends keyof Function ? never : K]: T[K] }` — отфильтровывает `name/length/bind/call/apply/prototype` из Function.prototype. Рекурсия через `WithMetaProps<StaticProps<...>>` гарантирует что `Card.Header` тоже принимает `meta`. `Layout` (plain object) идёт через `extends object` ветку — не затронут. Источник: `src/wrappers/interfaces.ts` (`StaticProps` + `WithMetaProps`). `Ui.Navigation` удалён (2026-05-22, primitive deleted from web-ui).

10. **8 workspace deps.** `web-core` зависит от `web-profiler`, `web-router`, `web-state`, `web-ui`, `web-query`, `shared-zod`, `vite-builder`, `web-style`. При изменении контрактов в любом из них — координируй с owner'ом.

11. **`IBaseStateSchema` в `web-state`.** `IDefineStateSchema` в `wrappers/interfaces.ts` расширяет `IBaseStateSchema` из `web-state` (Phase F unification). Не инвертируй направление зависимости.

12. **`ShapeUiContext` несёт только `Ui`** (после revert PR #114 в commit 477b0fb). Раньше был combined `{ ...Ui, Views }` — теперь Shape берёт View-templates через global `Views.X.Y` в `as`, не через `ui.Views.X.Y` path-tracker.

18. **Shape v0.4.0 — batch flow, не per-item.** `<For each>` убран. `props: (item) => ...` и `children` render-prop — удалены. `IShapeTemplateProps` / `IShapeRender` — убраны из публичного API. Теперь `as` получает: `data` (целый массив) + extras из definition + consumer JSX props. Итерация — внутри batch-template (`Ui.List`, `Ui.DataTable`). Apps-код с per-item Shapes (старый `props: (item) => ...`) → нужно переписать на batch-template.

13. **Generic `<P>` на wrapper'ах требует `extends Record<string, any>`** — чтобы соответствовать Solid `Component<P>`. Default `Record<string, any>` сохраняет backward-compat для factory без `<P>`. Не упрощай до `<P = unknown>` — Solid Component откажет.

14. **`Object.assign(globalThis, _registry)` ломает tree-shaking** для registry. Поэтому `wrappers.ts` использует `lazy()` для каждого компонента — это обходит проблему через code-splitting. Eager-import всех registries → fat initial bundle. См. session note про lazy registry в memory.

15. **`HMRWrappingPlugin` ожидает factory-call в default export.** `const X = View(...)` + `export default X` — обязательный паттерн. Плагин превращает `View(...)` в `(props) => View(...)(props)` чтобы HMR не сбрасывал state. Если `export default` отсутствует — HMR продолжит работать (плагин добавит), но TS не увидит default → сломается типизация slot-кодгена.

## Что менять когда

| Хочу… | Куда лезть |
|---|---|
| Добавить новый Entity (domain data) | `apps/<app>/src/entities/<name>.ts` → `Entity((z) => ({ schema, defaults? }))` + `export default`. Codegen подхватит в `Entities.*`. `z.infer<typeof Entities.X.schema>` для типа. |
| Расширить IEntityDefinition (validators, relations) | `packages/web/core/src/wrappers/entity/types.ts` → добавить поле в `IEntityDefinition`. При breaking change — bump major. |
| Добавить новый primitive в `Ui` (например `Dialog`) | `src/ui-kit/imports.tsx` (lazy + `Object.assign` для compound) + тип в `ViewUiRaw`/`WidgetUiRaw` в `src/wrappers/interfaces.ts` + характеризационные тесты в `src/wrappers/__tests__/ui-meta-props.test.tsx`. Если primitive из другого пакета (не web-ui), проверь наличие subpath в его `package.json exports` и `tsconfig.base.json paths` — иначе импортируй из main barrel (прецедент: `ThemeSwitcher` из `@capsuletech/web-style`). |
| Добавить новый wrapper-слой (например `Adapter`) | `WRAPPER_NAMES` в `packages/builders/vite/src/plugins/constants.ts` (SSOT для AutoImport, делает owner-builders) + новый wrapper в `packages/web/core/src/wrappers/` + публичный API в `index.ts` + AI-anchor entry |
| Добавить новое поле в `ITarget` (например `meta.section`) | `packages/web/core/src/wrappers/interfaces.ts > ITarget` + сборщик `target` в `engine/ui-proxy.tsx` + опционально `engine/derivation.ts` если выводится из tags. Tests! |
| Добавить новый handler-event (`onScroll`) | `engine/ui-proxy.tsx > EVENT_HANDLERS` + (опц) `engine/derivation.ts > TAG_TO_INPUT_TYPE`. ADR 009. Tests! |
| Изменить wrapper-сигнатуру | `packages/web/core/src/wrappers/<wrapper>.tsx` + `interfaces.ts` (типы) + CLI templates (`packages/cli/src/templates/`) + `.claude/agents/{view,widget,page,shape}.md` + `CLAUDE.md` table + characterization tests. BREAKING → bump major. |
| Расширить ShapeUiContext | `packages/web/core/src/wrappers/shape/context.tsx`. **Не плющить registries в Ui** — это уже было (PR #114, реверт). Если нужен новый namespace — отдельный Context. |
| Добавить новый Provider в BaseProviders | `packages/web/core/src/providers/base.tsx` + публичный API из `web-core/providers`. Координируй с owner'ом нового пакета. |
| SSR-готовность | `createRoot` сейчас CSR-only (`document` в hot path). Нужна `hydrate`-ветка. Backlog: P3 в OWNERSHIP.md. |
| Devtools-integration | Exporter для `@capsuletech/web-profiler` — backlog P3. |
| TypingProvider для services | Generic-context для типизации `services` через app-level config. Backlog P3. |

## Cross-links

- OWNERSHIP: [packages/web/core/OWNERSHIP.md](../../packages/web/core/OWNERSHIP.md)
- ADRs: [[001-xstate-only-fsm]], [[002-logic-wrapper-unification]], [[007-uiproxy-cleanup]], [[008-hybrid-fsm-with-direct-next]], [[009-event-handlers-hardcoded]]
- Связанные пакеты: [[web-state]] (Bridge, IBaseStateSchema), [[web-router]] (router в services), [[web-ui]] (Ui-kit), [[web-style]] (theme tokens), [[web-profiler]] (VitalsMonitoring)
- Builders: [[builders|builders.md]] — WRAPPER_NAMES, HMRWrappingPlugin, RouterPlugin, ExportGeneratorPlugin
- Release: web-core в группе `web_base` (fixed-versioning, tag `web@{version}`)
