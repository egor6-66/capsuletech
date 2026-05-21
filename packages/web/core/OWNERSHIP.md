---
name: "@capsuletech/web-core"
owner-agent: owner-web-core
group: web_base
status: pre-1.0
last-updated: 2026-05-21
---

# @capsuletech/web-core

Корневой пакет HCA-фреймворка: шесть wrapper-функций (View/Widget/Page/Controller/Feature/Shape), Proxy-механика (UiProxy + ControllerProxy), провайдеры (BaseProviders), DOM-bootstrap (createRoot) и реестр UI-примитивов (ui-kit/imports).

> **BREAKING (v0.2.0):** `Entity` → `View`, `EntityUi` → `ViewUi`, `IEntityWrapper` → `IViewWrapper`, `IEntityRenderer` → `IViewRenderer`, `IWidgetRenderer` 4-й arg `entities` → `views`, global registry `Entities` (placeholder для domain layer) + новый `Views`. ShapeUiContext поднят в Widget/Page — Shape первоклассный leaf. `Layout` добавлен в `WidgetUi`. Consumer updates требуют отдельных PR (owner-builders, owner-cli, architect для docs).
>
> **BREAKING (v0.3.0):** Wrapper signatures упрощены до **`(Ui, props?)`**. Убраны positional registry-args: `View((Ui, Shapes) => ...)` → `View((Ui, props?) => ...)`; `Widget((Ui, Features, Controllers, Views) => ...)` → `Widget((Ui, props?) => ...)`; `Page((Ui, Widgets) => ...)` → `Page((Ui, props?) => ...)`. `Views`/`Widgets`/`Shapes`/`Controllers`/`Features` — глобалы через `Object.assign(globalThis, _registry)` в bootstrap. `ShapeUiContext` revert — несёт только `Ui` (без Views-merge): для template из View использовать `as: Views.X.Y` напрямую (global). Generic `<P>` на rendererах для типизации props (Shape `as`-pattern).

## Зона ответственности

### Owns

- `packages/web/core/src/wrappers/` — все шесть wrapper-функций + публичные интерфейсы (`interfaces.ts`)
- `packages/web/core/src/engine/` — внутренний движок: `ui-proxy.tsx`, `controller-proxy.ts`, `logic-wrapper.tsx`, `ctx.ts`, `derivation.ts`, `registry.ts`
- `packages/web/core/src/providers/base.tsx` — `BaseProviders` (RouterProvider + VitalsMonitoring)
- `packages/web/core/src/create/createRoot.ts` — DOM-bootstrap: render + ensureTheme
- `packages/web/core/src/ui-kit/imports.tsx` — `Ui` namespace registry (lazy lazy-imports всех web-ui примитивов)
- `packages/web/core/src/index.ts` + `interfaces.ts` — публичный barrel
- `packages/web/core/vite.config.mts` — build config (три entrypoint'а: index / create / providers)
- `packages/web/core/package.json` — exports / deps / peerDeps
- `packages/web/core/src/**/__tests__/` — unit-тесты движка

### Не трогает

- Содержимое `@capsuletech/web-ui`, `@capsuletech/web-state`, `@capsuletech/web-router`, `@capsuletech/web-style`, `@capsuletech/web-profiler`, `@capsuletech/web-query` (делегировать соответствующим owner'ам).
- `packages/builders/vite/src/plugins/scaffold/` — scaffolding-шаблоны (owner-builders).
- `WRAPPER_NAMES` в `packages/builders/vite/src/plugins/constants.ts` — SSOT для AutoImport (owner-builders; при добавлении нового wrapper'а согласовывать).
- Root-level `package.json`, `tsconfig.base.json`, `nx.json` (главный assistant).
- `apps/*/` (user / framework-developer scope).
- `scripts/release-local.mjs` и подобные shared infra (главный assistant).

## Публичный API

Три subpath-экспорта через `package.json.exports`:

### `.` — main barrel (`src/index.ts`)

```ts
import {
  View, Widget, Page, Controller, Feature, Shape, // 6 wrapper-функций
  Providers,                                        // namespace: { BaseProviders }
  useShapeUi,                                       // hook для Shape consumer'ов
  type ITarget, type IHandlerApi,                   // user-facing типы
  type IDefineStateSchema, type IStateHandlers,     // schema-типы
  type IServices, type IWrapperProps,               // injected types
  type INext, type IStateApi,                       // handler-API helpers
  type IViewWrapper, type IViewRenderer,            // View-specific types
} from '@capsuletech/web-core';
```

Wrapper-имена (`View/Widget/Page/Controller/Feature/Shape`) — **глобальные в apps** через AutoImport. В app-коде их явно не импортируют, но они должны экспортироваться из barrel чтобы AutoImport мог их инжектить.

### `./create` (`src/create/index.ts`)

```ts
import { createRoot } from '@capsuletech/web-core/create';
createRoot(Bootstrap);
createRoot(Bootstrap, { container: 'my-app', defaultTheme: 'light' });
```

### `./providers` (`src/providers/index.ts`)

```ts
import { BaseProviders } from '@capsuletech/web-core/providers';
<BaseProviders routeTree={routeTree} routerContext={...} vitals showDashboard>
  ...
</BaseProviders>
```

**НЕТ** `./css` — CSS был удалён из этого пакета. Bootstrap-стили теперь живут в `.capsule/styles.css`, который генерится builders scaffold и импортируется в `bootstrap.tsx` приложения.

Это **контракт**. Изменение любого из трёх subpath-экспортов или shape ITarget/IHandlerApi — breaking change → bump major + координировать с главным и всеми owner'ами web_base группы.

## Quirks / gotchas

- **`IUiMetaProps` живёт в web-core, не в web-ui.** `meta`, `payload`, `dynamicMeta`, `modifiers` — props UiProxy-layer (перехватываются в `wrapComponent`, в реальный DOM не попадают). web-ui — чистый DOM/style primitive, HCA-aware props там неуместны. `WithMetaProps<T>` — mapped type в `wrappers/interfaces.ts`, применяется к `ViewUiRaw` / `WidgetUiRaw` / `PageUiRaw` → `ViewUi` / `WidgetUi` / `PageUi`. Источник: `src/wrappers/interfaces.ts` (helper `StaticProps<T>` + `WithMetaProps<T>`).

- **Compound sub-components (`Card.Header`, `Field.Label`, `Navigation.Item`, …) сохраняются через `StaticProps<T>`.** `WithMetaProps` для callable `T[K]` возвращает intersection: `((props: P & IUiMetaProps) => R) & WithMetaProps<StaticProps<T[K]>>`. `StaticProps<T>` отфильтровывает встроенные ключи прототипа `Function` (`K extends keyof Function ? never : K`), оставляя только пользовательские attached properties. Рекурсивное применение `WithMetaProps` к `StaticProps` гарантирует что `Card.Header`, `Field.Label` и т.д. тоже принимают `meta`. Регрессия: до PR #119 callable-ветка возвращала только `(props: P & IUiMetaProps) => R` без attached statics.

- **`createRoot` ≠ Solid `createRoot`.** Наш — render-фабрика (`render(Bootstrap, container)` + `data-theme` inject). Solid'ская — для реактивного scope без рендера. Часто путают. Источник: `src/create/createRoot.ts`.

- **CSS удалён из пакета.** `createRoot` больше не делает `import './styles.css'`. Приложение само импортирует `.capsule/styles.css` (генерится `ScaffoldPlugin` из builders). Если CSS не применяется — смотри `bootstrap.tsx.template` в vite-builder scaffold.

- **`Providers` — namespace, не named export.** `import { Providers } from '@capsuletech/web-core'; <Providers.BaseProviders>`. Расширяемая namespace для будущих `Providers.TestingProvider` и т.д. Не плющить в named.

- **`Ui.Layout` — plain object**, не вызываемый компонент. `{ Grid, Flex, Matrix }` — три lazy-компонента. Источник: `src/ui-kit/imports.tsx:17`.

- **Все `Ui.*` — lazy через `createLazy`.** Обёртка над `lazy(() => import(...).then(m => ({ default: m[name] })))`. Нужен `<Suspense>` вокруг дерева где они используются.

- **UiProxy policy C — own meta opt-in.** Побочные эффекты (регистрация, event-binding) активируются только если на JSX-узле явно задан `meta={{...}}`. Структурные обёртки (Field, Card и т.д.) проходят сквозным рендером. Изменение этой политики — массовый impact по всем apps, требует ADR.

- **`EVENT_HANDLERS` — захардкожены 6 событий.** `onClick`, `onInput`, `onChange`, `onBlur`, `onFocus`, `onKeyDown`. Добавление нового (например `onScroll`) требует правки `engine/ui-proxy.tsx > EVENT_HANDLERS` + опционально `engine/derivation.ts > TAG_TO_INPUT_TYPE`. См. ADR 009.

- **`next(payload)` — прямой вызов**, не XState event. `parent.controller[name]` вызывается напрямую с `await`. Не переписывать на event-bus без ADR (ADR 008 — гибридная FSM-схема).

- **`engine/*` — НЕ public.** `index.ts` не экспортирует ничего из `engine/`. Если что-то из engine нужно во внешнем коде — это симптом, документируй причину перед public-экспортом.

- **8 workspace deps.** `web-core` зависит от `web-profiler`, `web-router`, `web-state`, `web-ui`, `web-query`, `shared-zod`, `vite-builder`, `web-style`. При изменении контрактов в любом из них — согласовывать с соответствующим owner'ом.

- **IBaseStateSchema в web-state.** `IDefineStateSchema` в `wrappers/interfaces.ts` расширяет `IBaseStateSchema` из `web-state` (Phase F unification). Не инвертировать направление зависимости.

## План рефакторинга / оптимизаций

- [ ] **Завести `docs/_meta/web-core.md` AI anchor** — без него Claude-инстансы каждый раз перечитывают весь README. (priority: high)
- [ ] **Покрытие engine тестами выше 70%** — сейчас точечное: `ui-proxy`, `controller-proxy`, `derivation`, `getTargetData` покрыты; пробелы в `logic-wrapper` и `ctx`. (priority: medium)
- [ ] **SSR-готовность** — `createRoot` CSR-only (`document` в hot path). Нужна `hydrate`-ветка для SSR. (priority: low)
- [ ] **TypingProvider** — TS-only context для типизации `services` через generic. (priority: low)
- [ ] **Devtools-integration** — exporter для `@capsuletech/web-profiler` (state + controller traces). (priority: low)
- [x] **Копипаста Controller/Feature устранена** — заменено на `createLogicWrapper(kind)` (ADR 002, 2026-05).
- [x] **Утечка регистрации в UiProxy** — `createUniqueId` + `createEffect` + `onCleanup` (ADR 007, 2026-05).
- [x] **Двойной FSM** — XState теперь единственный runtime (ADR 001 + 008, 2026-05).
- [x] **Дедупликация event-bubbling** — event-marker `__capsule_<name>__` (2026-05).
- [x] **CSS удалён из пакета** — перенесён в builders scaffold (2026-05).
- [x] **Entity → View rename** — `View` = UI JSX-leaf, `Entity` зарезервирован под domain data layer (2026-05-21).
- [x] **ShapeUiContext поднят в Widget/Page** — Shape первоклассный leaf из любого слоя (2026-05-21).
- [x] **Layout добавлен в WidgetUi** — `Ui.Layout.Matrix` доступен в Widget (2026-05-21).
- [x] **Wrapper signatures упрощены до `(Ui, props?)`** — registry-args убраны, `Views`/`Widgets`/`Shapes`/`Controllers`/`Features` — глобалы. `ShapeUiContext` revert (несёт только Ui, без Views-merge). Generic `<P>` для типизации props в Shape `as`-pattern (2026-05-21).
- [x] **`IUiMetaProps` + `WithMetaProps<T>` добавлены** — `meta`/`payload`/`dynamicMeta`/`modifiers` теперь типизированы на уровне `ViewUi`/`WidgetUi`/`PageUi`. TS2322 на `<Ui.Input meta={...} />` устранён. Источник: `src/wrappers/interfaces.ts`. Тест: `src/wrappers/__tests__/ui-meta-props.test.tsx` (2026-05-21).
- [x] **Compound sub-components restored in `WithMetaProps`** — `Card.Header`, `Card.Title`, `Card.Content`, `Card.Description`, `Card.Footer`, `Field.Label`, `Field.Content`, `Field.Group`, `Navigation.List`, `Navigation.Item` и т.д. больше не теряются после augmentation. Введён helper `StaticProps<T>` (`K extends keyof Function ? never : K`). Callable-ветка теперь возвращает intersection callable + `WithMetaProps<StaticProps<T[K]>>`. Layout (`{ Grid, Flex, Matrix }`) не регрессирует — идёт через `extends object` ветку. 136 тестов green (2026-05-21).

## Test coverage

| Тип | Где | Что покрывает |
|---|---|---|
| Unit (jsdom) | `src/engine/__tests__/ui-proxy.test.tsx` | event-bubble dedup, meta opt-in, registration cleanup, dynamicMeta merging |
| Unit (jsdom) | `src/engine/__tests__/controller-proxy.test.ts` | dispatch state lookup, next() bubbling, state.set/matches |
| Unit | `src/engine/__tests__/derivation.test.ts` | `deriveName`, `deriveInputType`, `TAG_TO_INPUT_TYPE` |
| Unit | `src/engine/__tests__/getTargetData.test.ts` | `getTargetData` edge cases |
| Unit | `src/wrappers/shape/__tests__/ui-tracker.test.ts` | Shape ui-tracker регрессии |
| Unit (jsdom) | `src/wrappers/__tests__/view-props.test.tsx` | View `(Ui, props)` signature, generic `<P>`, Shape `as` Dynamic-pattern, reactivity |
| Unit (types+jsdom) | `src/wrappers/__tests__/ui-meta-props.test.tsx` | `IUiMetaProps` shape, `WithMetaProps` application to ViewUi/WidgetUi, runtime no-crash |
| E2E (косвенно) | capsule-test smoke fixture | bootstrap + routing + Controller round-trip |

**Перед изменением engine:** unit-tests должны быть green (`pnpm --filter @capsuletech/web-core test`).
**При breaking change ITarget / IHandlerApi:** обновить tests + добавить характеризационный тест перед фиксом.
**Принцип:** characterization test первым, потом fix (feedback:test_before_refactor).

## Cross-package dependencies

| Зона | Owner |
|---|---|
| UI primitives (Button, Input, Card, Field, Layout, ...) | owner-web-ui |
| State machine / Bridge / IBaseStateSchema | owner-web-state |
| RouterProvider / useRouter / ICapsuleRouter | owner-web-router |
| Theme variables / createStyle | owner-web-style |
| VitalsMonitoringProvider / ProfilerProvider | owner-web-profiler |
| getApiClient / IAppConfig / CapsuleApi | owner-web-query |
| WRAPPER_NAMES / AutoImport constants | owner-builders |
| shared-zod (Zod schemas) | owner-shared-zod |

## Release group

`web_base` — fixed-versioning, tag `web@{version}`. Соседи: web-dnd, web-editor, web-profiler, web-query, web-renderer, web-router, web-state, web-style, web-ui, shared-zod.

`web-core` — самый «горячий» пакет группы. Любое изменение публичного API (wrapper-сигнатура, ITarget, IHandlerApi) — breaking change для всей группы и для apps. Bump major + согласуй со всеми owners до release.

После изменений в этом пакете — координировать release через главного (`scripts/release-local.mjs`).
