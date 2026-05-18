---
tags: [meta, cleanup]
status: living-doc
---

# Cleanup plan

Сквозной список «что навести в порядок» по пакетам. Идём модуль за модулем:
код-аудит → актуализация доков → приоритизация → план правок → точечное
исправление. Этот файл — оглавление + per-module-разбор + handoff-инструкции
для следующего агента.

## Условные обозначения приоритетов

- **P0** — блокер: ломает сборку/прод/типизацию у пользователя пакета.
- **P1** — high: dead code в публичном API, протухший доc, не описанная фича, рассинхрон с реальной структурой кода.
- **P2** — medium: типизация (`as any`, голые `any`), мелкое дублирование, неполный `tsconfig`, smell в публичных сигнатурах.
- **P3** — низко: косметика, рефактор для читаемости, CHANGELOG.

## Прогресс

| Модуль | Аудит | Доки | Код-правки |
|---|---|---|---|
| [packages/builders/vite](#packagesbuildersvite) | ✅ | — | ✅ |
| [packages/builders/lib](#packagesbuilderslib) | ✅ | — | ✅ |
| [packages/builders/compliance](#packagesbuilderscompliance) | ✅ | — | ✅ |
| [packages/builders/biome](#packagesbuildersbiome) | ✅ | — | n/a (config-only) |
| [packages/web/core](#packagesweb-core) | ✅ | ✅ | ✅ (P1 #3 закрыто web-router; P2 #10 закрыто web-query) |
| [packages/web/state](#packagesweb-state) | ✅ | 🟡 (README — Nx-стаб) | ✅ |
| [packages/web/router](#packagesweb-router) | ✅ | ✅ | ✅ |
| [packages/web/query](#packagesweb-query) | ✅ | ✅ (review 2026-05-18) | 🟡 (P1 ✅ 5/5, P2 0/6, P3 0/8) |
| packages/web/ui | ✅ | ✅ | ✅ (periphery only, no components touched — PR #28) |
| packages/web/editor | ✅ | ✅ | ✅ (consolidated 3 packages: manifests + editor-state + inspector → web-editor with subpaths — PR #29) |
| packages/web/renderer | ✅ | ✅ | ✅ (periphery — PR #29) |
| [packages/web/style](#packagesweb-style) | — | — | — **← next** |
| [packages/web/profiler](#packagesweb-profiler) | — | — | — |
| [packages/web/dnd](#packagesweb-dnd) | — | — | — |
| packages/shared/* | — | — | — |
| packages/system/* | — | — | — (folder больше нет; всё в packages/builders/) |

---

## 🔴 Stability findings (приоритет — стабильность сборки)

Найдены в diagnostic-проходе 2026-05-17. Это **отдельная ось** от P0/P1/P2 — про
причины «то работает, то нет», а не про чистоту кода.

### ✅ S-1 — `defineAppConfig is not defined` (Windows path mismatch)

`packages/builders/vite/src/plugins/appConfig.ts:transform` сравнивал `id` и
`configPath` строго по строке. На Windows `path.join` отдаёт backslash, а Vite
нормализует id к forward slash + добавляет query-суффиксы (`?import`, `?t=...`).
Условие никогда не было `true` → `defineAppConfig` уходил в браузер как bare
identifier → `ReferenceError`.

Закрыто: нормализация обоих путей через `p.split('?')[0].replace(/\\/g, '/')`.
Регрессионные тесты — `packages/builders/vite/src/plugins/__tests__/appConfig.test.ts` (7 тестов).

### ✅ S-2 — `web-core/exports` mismatch (ложная тревога)

В первичной диагностике казалось что types и runtime указывают на разные
layout'ы. На самом деле `lib-builder` **намеренно** делает гибрид:
types в subdir/index.d.ts (от tsc), runtime — flat .mjs (от Vite bundle).
Текущий `exports` корректен. Проверено `publint` + `@arethetypeswrong/cli`.

### ✅ S-3 — `dist/package.json` имеет `exports` field

Закрыто: извлечён хелпер `cleanRootPkgForDist` в
`packages/builders/lib/src/libConfig.ts`, дроп поля `exports` при копировании
package.json в dist. Регрессия покрыта тестами lib-builder (49 шт.).

### 🟡 S-4 — `.d.ts` импорты без `.js`-расширения

attw показывает 💀 для `node16-esm` и `node10` — `.d.ts` внутри пакета делают
импорты без `.js`-расширения, что node-resolver не понимает. Bundler-консьюмеры
(мы и любые Vite/Webpack apps) — 🟢, всё работает. Проблема всплывёт, когда
кто-то попробует консьюмить пакет из чистого Node-проекта без бандлера.
Откладывается до публичного релиза.

### ⚠ S-5 — `shared-vite` / builder-watch-mode (частично)

Закрыто частично: добавлен per-package `pnpm dev` в `packages/builders/*` +
корневой `pnpm dev:builders` (запускает все builder-watch параллельно). Остаётся
вшить в dev-команду apps так, чтобы билдер пересобирался автоматически без
ручного запуска `pnpm dev:builders` рядом.

### ✅ S-6 — Дублирование алиасов IDE vs runtime (закрыто)

Закрыто: единый источник правды — `tsconfig.base.json`. Vite читает его
через `vite-tsconfig-paths` плагин (подключён в
`packages/builders/vite/src/defines/capsuleConfig.ts:tsconfigPaths(...)`).
Ручных `resolve.alias` таблиц для `@capsuletech/*` в репо больше нет —
есть только `AliasesPlugin` для локальных app-paths
(`@pages/*`, `@widgets/*`, ...), которые НЕ дублируются в `tsconfig.base`,
а наоборот — мержатся плагином в `.capsule/tsconfig.paths.json`.

Заодно почищены stale-имена в `dedupe` и `optimizeDeps.exclude` того же
файла (ссылались на `@capsuletech/{ui,state,core,file-manager}` —
переименованные/исчезнувшие пакеты).

### ✅ S-7 — Tauri override mess (закрыто)

Закрыто: `scripts/desktop.mjs` теперь снимает override-файл на четырёх
exit-путях (`child.on('exit')`, `SIGINT`, `SIGTERM`, `uncaughtException`)
плюс fallback `process.on('exit')`. Cleanup идемпотентен (флаг
`cleanedUp` + existsSync-проверка), так что повторные срабатывания
hooks безопасны.

### ⚠ S-8 — `unplugin-auto-import` + bare globals (частично закрыто)

`defineAppConfig` теперь экспортируется как identity-функция из
`@capsuletech/web-query/app-config`; CLI-шаблон для новых apps генерит
explicit import. См. [[013-explicit-define-app-config|ADR 013]].

Wrapper'ы (`Page` / `Widget` / `Entity` / `Controller` / `Feature` / `Shape`)
сознательно ОСТАЮТСЯ через auto-import — они идиоматичны для слой-файлов и
не участвуют в Vite-transform трюке (S-1-класс багов для них невозможен).

Legacy-bridge для `defineAppConfig` (globalThis-инжект + `AppConfigPlugin.transform`)
оставлен в коде, чтобы существующие apps (`sandbox` / `agent` / `ewc`) не
ломались. Когда они мигрируют на explicit-import — можно будет окончательно
убрать legacy и закрыть S-8.

---

## packages/builders/vite

Что это: набор Vite-плагинов (AppConfig, HMRWrapping, ExportGenerator, Router,
Compliance, EndpointsRegistry, Aliases, EnsureScaffold, StaticCopy) и define-
фабрик (`capsuleConfig`, `appConfig`, `libConfig`). Сердце dev/build pipeline'а
для apps.

### ✅ Сделано (PR #20)

- **Конс олидация** — `packages/shared/{vite,lib-config}` → `packages/builders/{vite,lib}`,
  npm-имена обрезаны до `@capsuletech/{vite,lib}-builder`.
- **Vitest установлен** — `packages/builders/vite/vitest.config.ts`, скрипты
  `test` / `test:watch`. Тесты живут в `src/**/__tests__/`.
- **AppConfigPlugin path-matching** — 7 регрессионных тестов на `transform`-hook,
  закрывают S-1 и не дают регрессии (POSIX, Windows, query-суффиксы).
- **Корневой `audit:exports`** — `scripts/audit-exports.mjs` + npm-script
  `pnpm audit:exports [filter]`. Прогоняет `publint` + `@arethetypeswrong/cli`
  по publishable пакетам.
- **`pnpm dev`** per-package + корневой `pnpm dev:builders` (S-5 частично).
- **Audit script** — парс attw с `-f json` (text-формат не стабилен).

---

## packages/builders/lib

Что это: zero-deps leaf — `@capsuletech/lib-builder`. Define-фабрика `libConfig`
для библиотек (Vite bundle + tsc types + sane package.json в dist). Используется
**всеми** publishable-пакетами репо.

### ✅ Сделано (PR #20)

- **49 тестов** на core-pieces (entry resolution, emit-dist-package-json,
  externals, runtime detection).
- **S-3 закрыт** — `cleanRootPkgForDist` дропает `exports` field при копировании
  package.json в dist.
- **ADR 010** — `docs/01-architecture/adr/010-builders-split.md`: пояснение
  почему lib-builder обязан оставаться zero-deps leaf.

---

## packages/builders/compliance

Что это: `@capsuletech/compliance` — HCA-линтер. Vite-плагин из vite-builder
дёргает его на transform-hook'е и пишет warning'и в dev-сервер.

### ✅ Сделано (PR #20)

- **58 тестов** на правила (upward, horizontal, disallowed-import, fetch-in-controller).
- Конфигурация совместимости после переезда `shared/ → builders/` — все
  internal-импорты обновлены.

---

## packages/builders/biome

`@capsuletech/biome-config` — config-only пакет (нет `dist/`, нет `vite build`).
В обходе нет кода для аудита. Переехал из `packages/shared/biome/` без изменений.

---

## packages/web/core

Что это: сердце фреймворка — wrapper'ы HCA (`Entity`/`Widget`/`Page`/`Controller`/
`Feature`/`Shape`), две Proxy-механики (`UiProxy` + `ControllerProxy`),
`createRoot`, `BaseProviders`, глобальные slot-интерфейсы (`Widgets`/`Entities`/
`Controllers`/`Features`/`Shapes`/`CapsuleApi`). Публичные подпути: `.`,
`./create`, `./providers`.

### Файловая карта (актуальная — после Phase E)

```
packages/web/core/src/
├── index.ts                       barrel
├── interfaces.ts                  IAppConfig (для apps/<app>/capsule.app.ts)
├── create/
│   ├── index.ts
│   └── createRoot.ts              render(Component, container) + ensureTheme
├── providers/
│   ├── index.ts
│   └── base.tsx                   BaseProviders — RouterProvider + опц. VitalsMonitoringProvider
├── engine/                        внутренний runtime (не публичный API)
│   ├── ctx.ts                     ICtx / IControllerHandle + Context, useCtx
│   ├── controller-proxy.ts        ControllerProxy
│   ├── ui-proxy.tsx               UiProxy + EVENT_HANDLERS
│   ├── logic-wrapper.tsx          createLogicWrapper(kind)
│   ├── derivation.ts              deriveInputType, deriveClassName, ...
│   ├── registry.ts                getGlobalRegistry<K>(key)
│   └── __tests__/                 controller-proxy, derivation, getTargetData
├── ui-kit/
│   ├── imports.tsx                lazy()-обёртки над @capsuletech/web-ui
│   └── index.ts
└── wrappers/
    ├── index.ts                   реэкспорт Entity/Widget/Page/Controller/Feature/Shape
    ├── interfaces.ts              IEntityRenderer/IWidgetRenderer/IPageRenderer
    │                              + IDefineStateSchema/IStateHandlers
    │                              + Widgets/Entities/Controllers/Features/Shapes/CapsuleApi
    ├── entity.tsx · widget.tsx · page.tsx
    ├── controller.tsx · feature.tsx (оба = createLogicWrapper(kind))
    └── shape/
        ├── index.ts · context.tsx · types.ts · ui-tracker.ts
        └── __tests__/ui-tracker.test.ts
```

### ✅ Сделано

- **Доки P1** (PR #21):
  - [docs/09-packages/core.md](docs/09-packages/core.md) — переписано под
    `@capsuletech/web-core`, новые пути, упомянуты `Shape` + `ShapeUiContext` + `useShapeUi`.
  - [docs/07-binding/ui-proxy.md](docs/07-binding/ui-proxy.md) — пути, секция
    «Деривация DOM `type` для input'а», двойная семантика `payload`.
  - [docs/07-binding/controller-proxy.md](docs/07-binding/controller-proxy.md) —
    пути, секция «Lifecycle: `onMount` (top-level)».
  - [docs/07-binding/shape.md](docs/07-binding/shape.md) — новый файл.
  - [packages/web/core/README.md](packages/web/core/README.md) — короткий указатель.
  - [docs/00-index.md](docs/00-index.md) — `[[shape]]` в Binding, `@capsuletech/web-*` в линках.
- **VitalsMonitoringProvider за prop `vitals?: boolean`** (PR #21,
  `packages/web/core/src/providers/base.tsx`) — по умолчанию выключен.
- **Phase A+B (PR #21, commit `2f1ed52`)** — pure-helper тесты + механические
  чистки. Закрыто: A-3 (`getGlobalRegistry`-унификация), A-4 (DEV-warn
  Entity-вне-Controller), A-5 (`parseMeta` DOM-read dead code), A-9 (`IPageRender`
  alias выпилен).
- **Phase C+D (PR #21, commit `f834dd9`)** — 74 теста (derivation, ui-tracker,
  controller-proxy, getTargetData). Расширен `createRoot`:
  ```ts
  interface ICreateRootOptions { container?: string | HTMLElement; defaultTheme?: string }
  export function createRoot(Component: () => JSX.Element, options?: ICreateRootOptions): () => void
  ```
  Убраны все `@ts-ignore`. Найден и пофикшен реальный баг: `ControllerProxy.next()`
  возвращал `undefined` при типе `Promise<T | null>` — теперь `?? null`.
- **Phase E (PR #22, commit `6374cd4`)** — engine/wrappers split, flatten layout.
  Закрыто: A-1 (Shape вынесен из `wrappers/logic/shape/` в `wrappers/shape/` — это
  data, не logic), A-2 (engine изолирован), A-7 (naming), A-8 (ui-kit concerns).
  Публичный API не изменился. EVENT_HANDLERS приведён к понятному виду
  `Record<EventName, { updateStore: boolean }>` (закрыто P3 #14).

### 🟡 Осталось

#### ✅ P1 #3 — Типизация `BaseProviders.routeTree`

Закрыто в проходе по web-router (PR #24, commit Phase B). `BaseProviders` стал
function-generic над `TRouteTree extends AnyRoute` (default = `AnyRoute`,
эквивалент прежнему `routeTree?: any`). `AnyRoute` re-export'нут из
`@capsuletech/web-router`, чтобы web-core не лез в `@tanstack/router-core` напрямую.

#### P2 #4 (partial) — Типизация `ctx.ts`

[packages/web/core/src/engine/ctx.ts:18](packages/web/core/src/engine/ctx.ts:18) —
`[methodName: string]: any` на `IControllerHandle`, `state: T = any` на `ICtx`.
Это **намеренно** (schema-driven dispatch, реактивный snapshot из xstate),
JSDoc у обоих полей объясняет почему. Дальнейшее ужесточение требует per-Controller
generic-параметров — оставлено до тех пор, пока конкретный потребитель не упрётся.

#### P2 #6 (partial) — `as any` в `wrappers/{entity,widget,page}.tsx`

Каст `Ui as any` нужен потому что namespace-import `import * as Ui from '../ui-kit/imports'`
имеет тип `typeof imports`, а слот ждёт `EntityUi`/`WidgetUi`/`PageUi`.
Структурно совместимы, но TS не доказывает. Решение: в `ui-kit/imports.tsx`
экспортнуть per-layer тип (`EntityUiRegistry` / `WidgetUiRegistry` / `PageUiRegistry`)
и кастить туда. Аналог уже частично есть в `wrappers/interfaces.ts` — нужно
консолидировать.

#### P2 #9 — `controller.destroy` no-op

[packages/web/core/src/engine/ctx.ts:15](packages/web/core/src/engine/ctx.ts:15)
объявляет `destroy?: () => void`,
[packages/web/core/src/engine/logic-wrapper.tsx:90](packages/web/core/src/engine/logic-wrapper.tsx:90)
вызывает `onCleanup(() => controller.destroy?.())` вхолостую. JSDoc у поля помечает
его как «extension point». Решение №1: убрать оба (поле + cleanup). Решение №2:
оставить с явным TODO. **Нужно решение пользователя** — задача спорная.

#### P2 #10 — `IAppConfig` живёт в `web/core` (blocked)

[packages/web/core/src/interfaces.ts](packages/web/core/src/interfaces.ts).
Контракт для `apps/<app>/capsule.app.ts`, который читает `AppConfigPlugin`
(Vite-плагин в `vite-builder`). Из-за него `web-core` тащит `@capsuletech/web-query`
ради типа `MwToolbox`. **Блокируется проходом по web-query.**

#### P2 #7 — Шейп-каст `as unknown as IShapeWrapper`

[packages/web/core/src/wrappers/shape/wrapper.tsx:63](packages/web/core/src/wrappers/shape/wrapper.tsx:63).
Двойной каст потому что `IShapeUi = Record<string, any>`. Чинится в связке с #6
(консолидация registry-типов в `ui-kit/imports.tsx`).

#### P2 #8 — `tsconfig.json` для публикуемой либы

[packages/web/core/tsconfig.json](packages/web/core/tsconfig.json) сейчас просто
extends-only. Добавить `include/exclude/rootDir/outDir` чтобы `tsc --noEmit` не
лазил по всему монорепо.

#### P3 #12 — Relative-deep import в `vite.config.mts`

[packages/web/core/vite.config.mts:1](packages/web/core/vite.config.mts:1):
```ts
import { libConfig } from '../../builders/lib/src';
```
Должно быть `import { libConfig } from '@capsuletech/lib-builder';`. Сейчас
работает за счёт pnpm-symlink. Та же ситуация во многих других пакетах — лучше
делать единым проходом.

#### P3 #13 — `package.json: exports` подпуты

[packages/web/core/package.json:33-40](packages/web/core/package.json:33-40) —
types указаны как `./dist/create/index.d.ts`, а import — `./dist/create.mjs`
(без `/index`). Это **намеренный гибрид** lib-builder (см. S-2), но стоит
зафиксировать как pattern в `docs/09-packages/lib-builder.md` для будущих
пакетов.

#### P3 #16 — `CHANGELOG.md`

15 пустых bump-only записей подряд. Собрать в один блок: `0.0.4 → 0.0.17: version bumps only`.

#### UiProxy render tests

Pure helpers (getTargetData, derivation) покрыты. Полный render-path — нет.
Нужны jsdom + `@solidjs/testing-library`-тесты на ui-proxy.tsx.

---

## packages/web/state

Что это: реактивный bridge поверх XState (`createBridge`), state-builder
(`createState`), tag-registry для `pick`/`omit`/`match`. Engine-уровень — не
знает про UI/Controller'ы.

### Файловая карта

```
packages/web/state/src/
├── index.ts          barrel
├── create.ts         createState(schema) + IBaseStateSchema/IBaseStateHandlers
├── bridge.ts         createBridge(state, send) + IBridge типы
├── helpers.ts        pick/omit/match/matchEntry
└── tag-registry.ts   registerAliases + lookup
```

### ✅ Сделано (PR #23, commit `814442e`)

- **72 теста** через 4 файла (helpers, tag-registry, bridge, create).
- **S-A-2** — `createBridge` параметры типизированы (`IBridgeStateSnapshot` +
  `IBridgeSend`); раньше — `state: any, send: any`.
- **S-A-3 / Phase F** — schema-types унифицированы. `IBaseStateHandlers` и
  `IBaseStateSchema<TCtx>` живут в web-state; `IDefineStateSchema` и
  `IStateHandlers` в web-core их расширяют (направление неинвертируемое —
  см. memory [[project-schema-type-unification]]).
- **S-A-6** — выпилен legacy-shim `MatchOptions | boolean` в `match`/`matchEntry`.
- **S-A-9** — `es-toolkit` и `xstate` объявлены явными deps (раньше silently
  hoisted, что хрупко).

### 🟡 Осталось

#### S-A-1 — `tag-registry` как module-level singleton

`packages/web/state/src/tag-registry.ts` — глобальный `Map` на уровне модуля.
Несколько apps в одном процессе шарят его. Сейчас не баг (apps запускаются
отдельно), но смелл. Решение — передавать registry в `createState`/`createBridge`
явно. Откладывается до появления реального use-case'а.

#### S-A-4 — `assign(({context, event}: any) => ...)` в `createState`

`packages/web/state/src/create.ts` — несколько `assign`-actions с `any`-кастом
context/event. Требует более глубокого xstate-generic рефакторинга.

#### S-A-5 — `IRegisteredComponent.payload` divergence

В web-state `payload: Record<string, unknown>`, в web-core `payload: unknown`.
Мини-расхождение. После Phase F (единый shared base) — естественно унифицировать
здесь же. Низкий приоритет.

#### S-A-7 — README — Nx-стаб

[packages/web/state/README.md](packages/web/state/README.md) сейчас:
```
This library was generated with [Nx](https://nx.dev).
```
Заменить на короткий указатель в стиле web-core/README.md (ссылка на
`docs/09-packages/state.md`, который ещё надо написать).

#### P-doc — нет страницы в `docs/09-packages/`

Аналог `docs/09-packages/core.md` для state не написан. Контент есть (память +
этот файл), нужно собрать его в нормальный doc.

---

## packages/web/router

Что это: тонкая обёртка над `@tanstack/solid-router` — factory `createRouter`,
Solid-контекст `RouterContext` + хук `useRouter`, ре-экспорт `RouterProvider`.
Скрывает детали TanStack за стабильным `ICapsuleRouter` API (`goTo` / `back` /
`current` / `raw`).

### Файловая карта (актуальная — после прохода Phase A)

```
packages/web/router/src/
├── index.ts         barrel
├── service.ts       createRouter() — value-импортит @tanstack/solid-router
├── types.ts         wrap() + ICapsuleRouter / ICreateRouterOpts / ICapsuleRouterContext
├── context.ts       RouterContext + useRouter()
└── __tests__/       wrap (7) + useRouter (2) — node-env, без jsdom
```

### ✅ Сделано (PR #24)

- **Phase A — характеризационные тесты + extract `wrap` в types.ts** (9 тестов).
  `wrap()` живёт в отдельном модуле без value-импорта `@tanstack/solid-router`,
  чтобы покрытие шло в node-env (`@tanstack/solid-router` тянет client-only
  Solid API типа `CatchBoundary` — падает на сервере).
- **Phase A — generic `TRouteTree`** пробрасывается через
  `ICreateRouterOpts<T>` → `createRouter<T>(...)` → `ICapsuleRouter<T>`.
  `back()` теперь дёргает `raw.history.back()` (single-source-of-truth от
  TanStack, готовит к SSR). `goTo()` — снят двойной `as any`, оставлен один
  `as never` на TanStack-navigate.
- **Phase B — типизация `BaseProviders.routeTree`** в web-core (закрыт P1 #3).
  `AnyRoute` re-export'нут из web-router → web-core не лезет в
  `@tanstack/router-core` напрямую. `<RouterProvider router={raw}>` без `as any`.
- **Phase C — docs.** README заменён с Nx-стаба на короткий указатель,
  `docs/09-packages/router.md` переписан под текущий пакет (имя
  `@capsuletech/web-router`, `BaseProviders` вместо `Providers.Base`, generic
  TRouteTree, объяснение wrap-в-types).
- **Phase D — конфиг-полиш.** `vite.config.mts` импортит `@capsuletech/lib-builder`
  через workspace-alias (раньше — `'../../builders/lib/src'`); явно объявлен
  в devDependencies (раньше silently hoisted). 14 пустых bump-only CHANGELOG-записей
  схлопнуты.

### 🟡 Осталось

#### P2 — `tsconfig.json` extends-only (cross-package)

Та же ситуация, что и в web-core P2 #8 / web-state. Нужен `include/exclude/
rootDir/outDir`, чтобы `tsc --noEmit` не сканировал всё монорепо. Делать
имеет смысл одним проходом по всем трём пакетам (web-core / web-state /
web-router), иначе рассинхрон.

#### P2 — `useRouter()` теряет generic `TRouteTree`

`useRouter()` возвращает `ICapsuleRouter` без generic'а — у хука нет источника
инференса. Если потребитель хочет типизированный `raw.navigate({to})` —
использует `capsuleRouter` из `createRouter` напрямую или явно указывает тип
переменной. Альтернатива (`useRouter<T>()`) требует module-augmentation паттерна
TanStack `Register` — отдельный refactor.

---

## packages/web/query

Что это: декларативный HTTP-слой Capsule. `defineEndpoint` + `createApi` +
koa-style middleware-pipeline. Feature видит typed-proxy `services.api.user.get({
id })` — без fetch/кэш/error-mapping в коде. Подпуть `./app-config` экспортирует
`IAppConfig` (раньше жил в web-core, что давало инверсию зависимости).

### Файловая карта

```
packages/web/query/src/
├── index.ts                 barrel
├── app-config.ts            IAppConfig (новый entry: '@capsuletech/web-query/app-config')
├── createApi.ts             createApi + setApiClient/getApiClient + MwToolbox
├── client.ts                QueryClient (cache + dedupe + interceptors)
├── cache.ts                 QueryCache (Map + prefix-invalidate)
├── endpoint.ts              defineEndpoint (zod + Endpoint phantom-типы)
├── fetcher.ts               defaultFetcher (нативный fetch → HttpError на non-2xx)
├── errors.ts                ApiError + Http/Unauthorized/.../Validation/Network/...
├── pipeline.ts              compose (koa) + ApiContext
├── middleware/
│   ├── core.ts              validateInput/buildRequest/httpTransport/validateResponse/mapDomain
│   ├── user.ts              cookies/auth/statusMapper/on401/log/retry
│   └── index.ts             barrel
├── types.ts                 QueryClient / Fetch / Mutate options + interceptors
└── __tests__/               147 тестов в 9 файлах (node-env)
```

### ✅ Сделано (PR #26)

- **Phase A — характеризационные тесты.** 147 в 9 файлах:
  `cache.test.ts`, `errors.test.ts`, `pipeline.test.ts`, `fetcher.test.ts`
  (с globalThis.fetch stub), `endpoint.test.ts`, `middleware-core.test.ts`,
  `middleware-user.test.ts`, `client.test.ts`, `createApi.test.ts`.
- **Phase B — `IAppConfig` переехал** из web-core в `web-query/app-config`
  (закрыт P2 #10 в web-core). Развязка инверсии: web-core больше не тащит
  web-query типов ради одного интерфейса. `CapsuleApi`-global declaration
  тоже переехала в web-query (родной дом — это типизация `getApiClient`).
  `getApiClient(): CapsuleApi | undefined` (раньше `<T = unknown>` cast hack).
  vite.config.mts → `@capsuletech/lib-builder` workspace alias + multi-entry
  `{ index, app-config }`. types/capsule.d.ts + CLI template обновлены.
- **Phase C — `HttpError` class.** Заменяет `Object.assign(new Error, { status,
  response })` каст в fetcher.ts (Q-5). `statusMapper` теперь сначала маппит
  `instanceof HttpError`, бэквард-compat ветка для bare-Error-с-.status
  оставлена для кастомных фетчеров. README с Nx-стаба переписан, CHANGELOG
  схлопнут, doc'и `api-middleware.md` / `core.md` синхронизированы (HttpError,
  retry, IAppConfig в новом подпуте).

### 🟡 Осталось

#### P2 — `tsconfig.json` extends-only (cross-package)

Та же ситуация, что и в web-core/state/router. Делать одним кросс-проходом.

---

### 📋 Web-query review 2026-05-18 — 19 findings

Полный review всего публичного API + 147 тестов. Группировка по приоритету.
Каждый item — кандидат на отдельный commit в `refactor/web-query-pass-2`-ветке.

**Pass-2 прогресс (2026-05-18):** P1 ✅ 5/5 закрыты, тесты 147 → 164 (+17). P2/P3 — на следующий проход.

#### ✅ P1 — footgun-ы (5/5 закрыто)

##### ✅ P1 #1 — `setQueryClient` / `getQueryClient` оторваны от `createApi`

[packages/web/query/src/client.ts:218](packages/web/query/src/client.ts:218),
[packages/web/query/src/createApi.ts:140](packages/web/query/src/createApi.ts:140).

`createApi` внутри делает `createQueryClient(...)` и хранит в замыкании. Глобальный
`setQueryClient` **не вызывается**. Снаружи `getQueryClient()` всегда `undefined`,
из Feature нет ссылки на client → invalidate / setQueryData недоступны вне `mutate`.

**Fix:** либо `setQueryClient(client)` внутри `createApi` (минимум), либо
`createApi(config, endpoints, { client? })` + exposed `services.api.$cache.invalidate(key)`
(см. #7).

**Закрыто:** [createApi.ts:140-151](../../packages/web/query/src/createApi.ts) —
`setQueryClient(client)` сразу после `createQueryClient(...)`. Минимальный шаг
(без расширения публичного API). Расширение через `services.api.$cache` —
в P2 #7. Тест [createApi.test.ts](../../packages/web/query/src/__tests__/createApi.test.ts):
`getQueryClient()` теперь возвращает client, через который Feature может
`invalidate` без ссылки на createApi.

##### ✅ P1 #2 — Cache key sensitivity к порядку ключей объекта

[packages/web/query/src/cache.ts:10](packages/web/query/src/cache.ts:10).

`JSON.stringify({a:1,b:2}) !== JSON.stringify({b:2,a:1})` → разные cache entries
для семантически одинакового input'а. Тест
[`cache.test.ts:43`](packages/web/query/src/__tests__/cache.test.ts:43) **документирует
это как "known limitation"**, но это footgun. После zod-parse порядок детерминирован
(zod сохраняет порядок схемы) — смягчает, не лечит для прямых вызовов `client.fetch`.

**Fix:** стабильная сериализация — sort keys рекурсивно. ~15 строк, не ломает API.
Тест на инвариант: `cacheKey({a:1,b:2}) === cacheKey({b:2,a:1})`.

**Закрыто:** [cache.ts:10-30](../../packages/web/query/src/cache.ts) —
`stableStringify` рекурсивно сортирует ключи объектов; массивы остаются
order-sensitive (намеренно). Тест-как-баг (`cache.test.ts:43`) переписан на
инвариант — два теста: вложенные объекты + массивы остаются `[a,b] !== [b,a]`.

##### ✅ P1 #3 — `HttpError.response: Response` — body single-read

[packages/web/query/src/errors.ts:44](packages/web/query/src/errors.ts:44),
[packages/web/query/src/fetcher.ts:31](packages/web/query/src/fetcher.ts:31).

В error-interceptor'ах / `cause.response.json()` ловит `TypeError: Body already
consumed` если стрим прочитан где-то выше. На сегодня `defaultFetcher` бросает
до чтения body, но порядок чтения становится implicit-контрактом.

**Fix:** в `HttpError` хранить `bodyText: string | null` (прочитанный заранее,
async fetch теперь имеет `await res.text()` перед throw), или `responseClone:
Response = response.clone()`. Первое предпочтительнее — детерминированно и
JSON-сериализуемо для телеметрии.

**Закрыто:** [errors.ts:43-71](../../packages/web/query/src/errors.ts) — добавлено
поле `bodyText: string | null`. [fetcher.ts:30-36](../../packages/web/query/src/fetcher.ts) —
`await res.text().catch(() => null)` перед `throw new HttpError(...)`. Consumer
теперь обращается к `err.bodyText` многократно (например, Sentry + on401-handler).
`err.response.text()` тоже работал бы, но стрим `bodyUsed` после нашего чтения —
этот контракт зафиксирован в тесте.

##### ✅ P1 #4 — `params` поддерживает только `string | number | boolean`

[packages/web/query/src/types.ts:25](packages/web/query/src/types.ts:25),
[packages/web/query/src/client.ts:55](packages/web/query/src/client.ts:55).

`?tags=a&tags=b` (массивные фильтры) невозможны. `undefined`-skip тоже не работает
(превратится в строку `"undefined"`).

**Fix:** расширить тип до `string | number | boolean | undefined | null |
ReadonlyArray<string | number | boolean>`. В `resolveUrl`:
- `undefined`/`null` → skip;
- array → `qs.append(k, String(v))` для каждого элемента.

**Закрыто:** [types.ts:25-39](../../packages/web/query/src/types.ts) — тип
расширен с поддержкой массивов и nullable элементов. [client.ts:51-69](../../packages/web/query/src/client.ts) —
`resolveUrl` использует `qs.append` (был `qs.set`), skip-ит undefined/null
сверху и внутри массивов; пустой qs не клеит `?`. Регрессия в
[middleware/core.ts:46-56](../../packages/web/query/src/middleware/core.ts) —
ручной cast убран, передаём rest как есть.

##### ✅ P1 #5 — `ApiError` не использует native `Error.cause`

[packages/web/query/src/errors.ts:25](packages/web/query/src/errors.ts:25).

`super(message)` без `cause` → причинная цепочка теряется в `err.stack`. DevTools
не видит chain. Pseudo-field `this.cause = opts.cause` есть, но native ES2022
property не выставлен.

**Fix:** `super(message, opts.cause !== undefined ? { cause: opts.cause } : undefined)`.
Поле `this.cause` оставить для совместимости — оно дублирует native.

**Закрыто:** [errors.ts:15-33](../../packages/web/query/src/errors.ts) — поле
`cause` объявлено через `declare readonly cause?: unknown` (наследует
own-property от ES2022 Error). `super(message, opts.cause !== undefined ? {
cause: opts.cause } : undefined)` — native cause устанавливается condition'ом.
Ручной `this.cause = opts.cause` убран (был дубликат). Тесты держат: cause
доступен через `Object.getOwnPropertyDescriptor(e, 'cause')`, без cause —
дескриптора нет (не плодим лишних own-properties).

#### 🟡 P2 — заметные пробелы (0/6 закрыто)

##### P2 #6 — Нет `gcTime` / LRU в QueryCache

[packages/web/query/src/cache.ts:25](packages/web/query/src/cache.ts:25).

`staleTime` есть, `gcTime` (когда удалить entry из памяти) — нет. Долгоживущий
SPA с большим количеством разных query-keys → unbounded memory.

**Fix:** `QueryClientOptions.gcTime?: number` + `maxEntries?: number` (простой
LRU). Timer per entry или per-tick sweep при пересоздании.

##### P2 #7 — Cache invalidation недоступна из Feature

[packages/web/query/src/createApi.ts](packages/web/query/src/createApi.ts).

Сейчас invalidate возможен только через `mutate({ invalidates: [...] })`. Если
Feature получает push через WebSocket и хочет force-refresh `['users']` — она
этого сделать не может (нет ссылки на client).

**Fix:** добавить `services.api.$cache.invalidate(key)` / `.clear()` / `.refetch(key)`
в InferApi. Или per-endpoint: `services.api.user.get.invalidate(input)`.

##### P2 #8 — Retry без jitter

[packages/web/query/src/middleware/user.ts:134](packages/web/query/src/middleware/user.ts:134).

`base * 2 ** (attempt - 1)` — детерминированный backoff. При массовом сбое 503 →
все клиенты бьют сервер синхронно (thundering herd).

**Fix:** `delay = base * 2^(attempt-1) * (0.5 + Math.random())` (50% jitter).
Или опциональный `jitter: 'full' | 'equal' | 'none'`.

##### P2 #9 — DELETE without body

[packages/web/query/src/middleware/core.ts:42](packages/web/query/src/middleware/core.ts:42).

`hasBody = method !== 'GET' && method !== 'HEAD' && method !== 'DELETE'`. Многие
REST API делают `DELETE /carts/items` с body `{ ids: [...] }` — это не запрещено
RFC 7231 для не-GET/HEAD.

**Fix:** убрать DELETE из исключения (или сделать opt-in через `EndpointConfig.bodyOnDelete?: boolean`).

##### P2 #10 — `endpoint.middleware` выполняется ПОСЛЕ `mapDomain`

[packages/web/query/src/createApi.ts:86](packages/web/query/src/createApi.ts:86).

Per-endpoint mw видит уже **domain**-объект (после `map`), не сырой response. Если
custom mw хочет логировать сырой DTO, кэшировать до маппинга, или decode binary
блоб — он не может.

**Fix (варианты):**
1. Документировать как design choice (минимум).
2. Переместить per-endpoint mw до `validateResponse`/`mapDomain`.
3. `EndpointConfig.middleware: { preMap?: Middleware[]; postMap?: Middleware[] }`.

Требует решения пользователя — это semantic break, нужен ADR.

##### P2 #11 — `log()` — без timing, без redact

[packages/web/query/src/middleware/user.ts:96](packages/web/query/src/middleware/user.ts:96).

Нет `duration` (для perf debugging), нет маскировки `Authorization`/`Cookie`/`Set-Cookie`
заголовков. Для production-логов критично, для dev — терпимо.

**Fix:** `log({ timing?: boolean; redact?: string[] | ((h, k) => string) })`.

#### 🟢 P3 — нюансы (7)

##### P3 #12 — `dedupe` ломается с разными `AbortSignal`

[packages/web/query/src/client.ts:110](packages/web/query/src/client.ts:110).

`p1 = fetch({signal: s1})`, `p2 = fetch({signal: s2})` шарят in-flight. `s2.abort()`
ничего не отменяет (p2 продолжает ждать p1).

**Fix:** при dedupe линковать signals через `AbortSignal.any([s1, s2])` (Node 19+,
браузерная поддержка с 2024). Edge-case, но реальный.

##### P3 #13 — `(req.url ?? '').startsWith('http')` — фрагильно

[packages/web/query/src/client.ts:53](packages/web/query/src/client.ts:53).

Ловит и `httptea://...`. Лучше `/^https?:\/\//i`.

##### P3 #14 — `isPrefix` через JSON.stringify per-element

[packages/web/query/src/cache.ts:16](packages/web/query/src/cache.ts:16).

Инвалидация O(n × keyDepth × stringify) — при >1000 entries заметно. Можно
кэшировать `serializedKey` в `CacheEntry` при `set` — линейный матч префикса
по строкам.

##### P3 #15 — Headers case-insensitivity не нормализована

[packages/web/query/src/client.ts:68](packages/web/query/src/client.ts:68).

`{Accept: 'x'}` и `{accept: 'y'}` хранятся как разные ключи в плоском объекте.
`fetch` потом схлопнет их непредсказуемо (последний выигрывает по platform).

**Fix:** при merge использовать `new Headers()` или явно нормализовать к нижнему
регистру.

##### P3 #16 — Нет canonical `createMockApi(endpoints, mocks)` для тестов Feature

Сейчас каждая Feature-тест пишет свой fake `services.api`. Будет drift.

**Fix:** `@capsuletech/web-query/testing` подпуть с `createMockApi(endpoints, {
'user.get': (input) => ({...}) })`. Возвращает proxy того же shape, что и
production-api.

##### P3 #17 — Streaming / SSE / WebSocket — за рамками

OK для v0.1, но roadmap. Endpoint-DSL заточен под request-response. SSE
(`EventSource`) и WebSocket — отдельный transport-слой, скорее всего рядом
с `createApi` — `createStreamApi`.

##### P3 #18 — `ApiError.payload: unknown` — нет JSON-сериализуемости guarantee

Если payload содержит `Response`/`Blob`/`Function` (e.g. в кастомном error-interceptor'е),
`JSON.stringify(err)` упадёт в Sentry/телеметрии.

**Fix:** документировать в JSDoc, или ввести `serializePayload()` helper.

##### P3 #19 — AI-anchor частично устарел

[docs/_meta/api-middleware.md:33](docs/_meta/api-middleware.md:33) — упоминает
старую локацию `interfaces.ts`. User-doc не упоминает подпуть `/app-config` и
export `defineAppConfig`. Поправить в проходе по докам (см. handoff).

#### Doc-pass plan

Обновление пары [api-middleware.md](docs/09-packages/api-middleware.md) /
[_meta/api-middleware.md](docs/_meta/api-middleware.md) должно добавить:

- **Известные ограничения** (cache-key порядок, params типы, DELETE без body, headers case-insensitivity, AbortSignal в dedupe) — секция «Gotchas» в обеих доках.
- **Порядок pipeline и почему** — раздел «Pipeline order» с диаграммой `validateInput → buildRequest → globalMw → httpTransport → validateResponse → mapDomain → endpointMw` и объяснением, что per-endpoint mw видит уже domain-объект (P2 #10).
- **Подпуть `/app-config`** + export `defineAppConfig` — упомянуть в user-doc (сейчас только в README).
- **Roadmap** — выжимка из P1/P2/P3 выше: что планируется (cache-key stability, params arrays, gcTime/LRU, jitter, $cache, mock-api, streaming).

---

## Handoff — следующему агенту

### Где ты работаешь

- **Репо:** `D:/CODING/projects/my/capsule/` (Windows, PowerShell shell, pnpm
  workspace, Nx 22).
- **Активная ветка:** обычно `main` (см. `git status`). Для нового прохода —
  создай `refactor/<package>-<scope>` из `main`.
- **CLAUDE.md в корне** — обязательное чтение перед началом. Там стек, команды,
  регламент HCA, golden rules, делегация субагентам.
- **Память** хранится по абсолютному пути
  `~/.claude/projects/D--CODING-projects-my-capsule/memory/`. Индекс —
  `MEMORY.md`, читается автоматически.

### Что уже сделано (за 4 PR — `9f13e28` → `30896f5`, 2026-05-17)

См. секцию ✅ Сделано в каждом модуле выше. Сводно:

| PR | Что |
|---|---|
| #19 (`fix/desktop-release-pnpm-version`) | desktop CI hardening (4 fix-PR'а до этого, серия) |
| #20 (`refactor/builders-consolidation`) | builders consolidation + tests + audit + watch + ADR 010 |
| #21 (`refactor/web-core-stabilization`) | web-core Phase A+B+C+D — 74 теста, registry-унификация, createRoot options |
| #22 (`refactor/web-core-engine-split`) | web-core Phase E — engine/wrappers split, flat layout |
| #23 (`refactor/web-state-stabilization`) | web-state — 72 теста, schema-type unification (Phase F) |
| #24 (`refactor/web-router-typing`) | web-router — 9 тестов, generic TRouteTree, разблокировал P1 #3 в web-core (BaseProviders) |
| #26 (`refactor/web-query-stabilization`) | web-query — 147 тестов, IAppConfig переехал из web-core (P2 #10), HttpError class |

### Working pattern (что сработало — повторяй)

- **One branch per package pass.** Naming: `refactor/<package>-<scope>`.
- **Multiple commits inside the branch** (phase A/B/C/D...), один PR в конце.
- **Characterization tests до рефактора** (см. memory [[feedback-test-before-refactor]]).
  В этой сессии тесты словили реальный баг `next() returning undefined`.
- **После каждого PR:** switch to main, pull, delete merged branch (local +
  remote), start fresh branch.
- **Reviews PR text вручную, мержит сам пользователь** (см. memory
  [[feedback-pr-per-logical-batch]]).
- **После каждого пакета:** `pnpm test` + `pnpm audit:exports <name>` +
  `pnpm nx build @capsuletech/agent` — smoke-test end-to-end.

### Регламент (то, что нельзя нарушить)

- **Все слои HCA enforced линтером** (`@capsuletech/compliance`, ADR 004,
  режим `warn`).
- **Фреймворковые пакеты `@capsuletech/*` — пишем сами** (entity/widget/...
  субагенты только под app-уровень).
- **Никакого `--no-verify`, `--force` push, `git reset --hard`** без явной просьбы.
- **На крупные операции** (массовые скан/генерации, веер агентов) — спрашивай
  пользователя через `AskUserQuestion`. Бюджет ограничен.
- **На семантические решения** (e.g. P2 #9 — выпиливать `destroy` или оставлять
  как extension point) — спрашивай, не решай молча.

### Что писать в этот файл

После каждого закрытого пункта:
- Обнови таблицу прогресса вверху.
- Допиши в секцию «✅ Сделано» соответствующего модуля (с file:line ссылками).
- Удали закрытое из «🟡 Осталось».
- Если модуль закрыт целиком — переходи к следующему по таблице.
