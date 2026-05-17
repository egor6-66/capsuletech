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
| [packages/web/core](#packagesweb-core) | ✅ | ✅ | ✅ (open items blocked on web-router/web-query) |
| [packages/web/state](#packagesweb-state) | ✅ | 🟡 (README — Nx-стаб) | ✅ |
| [packages/web/router](#packagesweb-router) | ✅ | ✅ | ✅ |
| [packages/web/query](#packagesweb-query) | — | — | — **← next** |
| [packages/web/ui](#packagesweb-ui) | — | — | — |
| [packages/web/style](#packagesweb-style) | — | — | — |
| [packages/web/profiler](#packagesweb-profiler) | — | — | — |
| packages/shared/* | — | — | — |
| packages/system/* | — | — | — |

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

### 🟡 S-6 — Дублирование алиасов IDE vs runtime

`tsconfig.base.json` (paths) и `packages/web/core/src/builder/config.ts`
(resolve.alias) — две независимых таблицы. `tsconfigPaths` плагин уже подключён
в `capsuleConfig.ts` — нужно проверить, что он покрывает все записи и удалить
ручной список. Та же тема, что и S-2 (но с другой стороны).

### 🟡 S-7 — Tauri override mess

`scripts/desktop.mjs` пишет временный `.tauri.<app>.json`. Если предыдущий
запуск упал — мусорный override остаётся. Нужен cleanup-handler.

### 🟡 S-8 — `unplugin-auto-import` + bare globals = хрупкий контракт

`defineAppConfig`, `Page`, `Widget`, `Entity`, `Controller`, `Feature`, `Shape`
инжектятся через auto-import + transform-hack. Любая ошибка в этой цепочке
(см. S-1) даёт `ReferenceError`'ы в неожиданных местах. **Архитектурный риск,
не баг.** Альтернатива: явные импорты `defineAppConfig` (identity-функция в
рантайме). Wrapper'ы оставить через auto-import — там идиоматично.

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
