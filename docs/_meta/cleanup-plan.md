---
tags: [meta, cleanup]
status: living-doc
---

# Cleanup plan

Сквозной список «что навести в порядок» по пакетам. Идём модуль за модулем: код-аудит → актуализация доков → приоритизация → план правок. Этот файл — оглавление + per-module-разбор + handoff-инструкции для следующего агента.

## Условные обозначения приоритетов

- **P0** — блокер: ломает сборку/прод/типизацию у пользователя пакета.
- **P1** — high: dead code в публичном API, протухший доc, не описанная фича, рассинхрон с реальной структурой кода.
- **P2** — medium: типизация (`as any`, голые `any`), мелкое дублирование, неполный `tsconfig`, smell в публичных сигнатурах.
- **P3** — низко: косметика, рефактор для читаемости, CHANGELOG.

## Прогресс

| Модуль | Аудит | Доки | Код-правки |
|---|---|---|---|
| [packages/web/core](#packagesweb-core) | ✅ | ✅ | 🟡 in progress |
| [packages/builders/vite](#packagessharedvite) | ✅ | — | 🟡 in progress |

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
layout'ы. На самом деле `shared-lib-config` **намеренно** делает гибрид:
types в subdir/index.d.ts (от tsc), runtime — flat .mjs (от Vite bundle).
Текущий `exports` корректен. Проверено `publint` + `@arethetypeswrong/cli`.

### ⚠ S-3 — `dist/package.json` имеет `exports` field (non-blocking warning)

`packages/builders/lib/src/libConfig.ts:emitDistPackageJsonPlugin` пишет
`dist/package.json` с полем `exports`. Node его игнорирует (работает только в
корневом `package.json`), но **некоторые бандлеры могут читать** → inconsistent
resolution. Сейчас не ломает, но стоит почистить когда придём в lib-config.

### ⚠ S-4 — `.d.ts` импорты без `.js`-расширения

attw показывает 💀 для `node16-esm` и `node10` — `.d.ts` внутри пакета делают
импорты без `.js`-расширения, что node-resolver не понимает. Bundler-консьюмеры
(мы и любые Vite/Webpack apps) — 🟢, всё работает. Проблема всплывёт, когда
кто-то попробует консьюмить пакет из чистого Node-проекта без бандлера.
Откладывается до публичного релиза.

### 🟡 S-5 — `shared-vite` отгружается из `dist/` (нет watch-mode)

Правка в `packages/builders/vite/src/` без `pnpm --filter @capsuletech/vite-builder
build` даёт устаревший плагин в dev-сервере app'а. Источник «работало вчера,
сегодня отлетело». **Fix-кандидат:** параллельный watch для `shared-vite` в
корневом `dev`-скрипте, или tsx-loader.

### 🟡 S-6 — Дублирование алиасов IDE vs runtime

`tsconfig.base.json` (paths) и `packages/web/core/src/builder/config.ts`
(resolve.alias) — две независимых таблицы. После рестракта `packages/ →
packages/web/` это место — источник «в IDE видно, в Vite не резолвится».
`tsconfigPaths` плагин уже подключён в `capsuleConfig.ts` — нужно проверить,
что он покрывает все записи и удалить ручной список.

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

### ✅ Сделано (на ветке `fix/web/core/add-docs-and-clean`)

- **Vitest установлен** — `packages/builders/vite/vitest.config.ts`, скрипты
  `test` / `test:watch` в `package.json`. Тесты живут в `src/**/__tests__/`.
- **AppConfigPlugin path-matching** — 7 регрессионных тестов на `transform`-hook,
  закрывают S-1 и не дают регрессии (POSIX, Windows, query-суффиксы).
- **Корневой `audit:exports` скрипт** — `scripts/audit-exports.mjs` + npm-script
  `pnpm audit:exports [filter]`. Прогоняет `publint` + `@arethetypeswrong/cli`
  по publishable пакетам. Bundler-консьюмеры зелёные, node-резолверы
  диагностируются (но не блокируют — мы Vite-only).
- **`pnpm test`** на корне — прогон тестов по всем `packages/**` с workspace
  concurrency=1 (чтобы output читался).

---

## packages/web/core

Что это: сердце фреймворка — wrapper'ы HCA (`Entity`/`Widget`/`Page`/`Controller`/`Feature`/`Shape`), две Proxy-механики (`UiProxy` + `ControllerProxy`), `createRoot`, `BaseProviders`, глобальные slot-интерфейсы (`Widgets`/`Entities`/`Controllers`/`Features`/`Shapes`/`CapsuleApi`). Публичные подпути: `.`, `./create`, `./providers`.

### Файловая карта (актуальная)

```
packages/web/core/src/
├── index.ts                       barrel: wrappers + Providers + interfaces
├── interfaces.ts                  IAppConfig (для apps/<app>/capsule.app.ts)
├── index.css                      пустой (только комментарий)
├── create/
│   ├── index.ts
│   └── createRoot.ts              render(Component, #root) + ensureTheme
├── providers/
│   ├── index.ts
│   └── base.tsx                   BaseProviders — RouterProvider + опц. VitalsMonitoringProvider за prop `vitals`
└── wrappers/
    ├── index.ts                   реэкспорт Entity/Widget/Page + Controller/Feature/Shape + ShapeUiContext/useShapeUi
    ├── ctx.ts                     Solid Context { state, store, controller, parent }
    ├── interfaces.ts              re-export ui/logic interfaces
    ├── ui/
    │   ├── entity.tsx · widget.tsx · page.tsx
    │   ├── interfaces.ts          IEntityWrapper/IWidgetWrapper/IPageWrapper + global Widgets/Entities/Controllers/Features/Shapes/CapsuleApi
    │   └── ui-kit/
    │       ├── imports.tsx        lazy()-обёртки над @capsuletech/web-ui
    │       └── proxy.tsx          UiProxy
    └── logic/
        ├── controller.tsx · feature.tsx (оба = createLogicWrapper(kind))
        ├── interfaces.ts          IDefineStateSchema / IHandlerApi / IServices / ITarget / IStateApi
        ├── utils/
        │   ├── createLogicWrapper.tsx
        │   └── proxy.ts           ControllerProxy
        └── shape/
            ├── wrapper.tsx · context.tsx · types.ts · ui-tracker.ts
```

### ✅ Сделано (на ветке `fix/web/core/add-docs-and-clean`)

- **Доки P1** — закрыты одним проходом:
  - [docs/09-packages/core.md](docs/09-packages/core.md) — перепрописано под `@capsuletech/web-core`, новые пути, упомянуты `Shape` + `ShapeUiContext` + `useShapeUi`, актуализированы depds.
  - [docs/07-binding/ui-proxy.md](docs/07-binding/ui-proxy.md) — обновлены пути, добавлена секция «Деривация DOM `type` для input'а» (`deriveInputType`), описана двойная семантика `payload`.
  - [docs/07-binding/controller-proxy.md](docs/07-binding/controller-proxy.md) — обновлены пути, добавлена секция «Lifecycle: `onMount` (top-level)» с таблицей сравнения с `onInit`.
  - [docs/07-binding/shape.md](docs/07-binding/shape.md) — новый файл: factory, path-tracker, `ShapeUiContext`, приоритет рендера, маппинг `item → templateProps`.
  - [packages/web/core/README.md](packages/web/core/README.md) — заменён на короткий указатель.
  - [docs/00-index.md](docs/00-index.md) — добавлен link `[[shape]]` в Binding, переименованы линки пакетов на `@capsuletech/web-*`.
- **VitalsMonitoringProvider возвращён за prop `vitals?: boolean`** в [packages/web/core/src/providers/base.tsx](packages/web/core/src/providers/base.tsx). По умолчанию выключен — прод-бандл apps/<app> не тащит overhead профайлера. Dep `@capsuletech/web-profiler` теперь оправдан.

### 🟡 Осталось — P1

#### 1. `IPageRender` back-compat alias

[packages/web/core/src/wrappers/ui/interfaces.ts:84](packages/web/core/src/wrappers/ui/interfaces.ts:84). Грепом не найдено ни одного потребителя за пределами самого файла. Удалить вместе с предыдущим комментарием (строки 83-84):

```ts
/** Back-compat alias: некоторое количество кода ссылается на старое имя `IPageRender`. */
export type IPageRender = IPageRenderer;
```

Проверить: `grep -r "IPageRender" packages apps` после правки должен возвращать ноль вхождений.

#### 2. Расширить API `createRoot`

[packages/web/core/src/create/createRoot.ts:18](packages/web/core/src/create/createRoot.ts:18).

Текущая сигнатура:

```ts
export function createRoot(
  Component: () => Node | JSX.ArrayElement | string | number | boolean | null | undefined,
)
```

Проблемы:
- Тип параметра тащит DOM-`Node`. На практике в HCA-рендере никто не возвращает DOM-узлы — нужна `JSX.Element`.
- Селектор контейнера хардкоднут `getElementById('root')` — фреймворк не запустить рядом с чужим SPA.
- `DEFAULT_THEME = 'black'` — недоступно для override снаружи.

Целевая сигнатура:

```ts
interface ICreateRootOptions {
  /** Селектор контейнера (id) или прямая ссылка на HTMLElement. По умолчанию `'root'`. */
  container?: string | HTMLElement;
  /** Дефолтная тема (ставится на `<html data-theme=...>`, если атрибута нет). По умолчанию `'black'`. */
  defaultTheme?: string;
}

export function createRoot(
  Component: () => JSX.Element,
  options?: ICreateRootOptions,
): () => void;
```

При правке — синхронизировать использование в:
- `apps/sandbox/.capsule/index.ts`, `apps/ewc/.capsule/index.ts`, `apps/agent/.capsule/index.ts` (грепни `createRoot` по `apps/`).
- `packages/cli/src/templates/app/.capsule/index.ts.template` (CLI-шаблон).
- `packages/builders/vite/src/plugins/scaffold/template/index.ts.template`.

#### 3. Типизация `BaseProviders.routeTree`

[packages/web/core/src/providers/base.tsx:10-11](packages/web/core/src/providers/base.tsx:10-11) — `routeTree?: any` + `<RouterProvider router={raw as any} />`.

Это упирается в `@capsuletech/web-router/createRouter` — нужно вытащить generic-тип `TRouteTree` оттуда и проложить его до `BaseProviders`. Если в `web-router` не разрешено наружу — отдельный проход по `web-router` (отдельный модуль, см. предложение модулей дальше).

Минимум здесь — заменить `any` на `Parameters<typeof createRouter>[0]['routeTree']` если внутренние типы пакета это разрешают.

### 🟡 Осталось — P2

#### 4. Типизация `ctx.ts`

[packages/web/core/src/wrappers/ctx.ts](packages/web/core/src/wrappers/ctx.ts) — `store: any; controller: any; parent: any`.

```ts
import type { IBridge } from '@capsuletech/web-state';

type IController = Record<string, (target: ITarget, ctx: unknown) => Promise<unknown>>;

export interface ICtx<T extends AnyStateMachine> {
  state: T;
  store: IBridge;
  controller: IController & { store: IBridge; destroy?: () => void };
  parent?: ICtx<AnyStateMachine>;
}
```

`parent` опционально — у самого верхнего Controller'а его нет.

#### 5. Унификация `globalThis`-геттеров

Сейчас 5 одинаковых функций раскиданы по `entity.tsx`/`widget.tsx`/`page.tsx`:

```ts
const getWidgets = (): Widgets => (globalThis as any).Widgets ?? ({} as Widgets);
const getEntities = …
const getControllers = …
const getFeatures = …
const getShapes = …
```

Свернуть в один хелпер `packages/web/core/src/wrappers/registry.ts`:

```ts
type RegistryKey = 'Widgets' | 'Entities' | 'Controllers' | 'Features' | 'Shapes';
type RegistryMap = { Widgets: Widgets; Entities: Entities; /* … */ };

export const getGlobalRegistry = <K extends RegistryKey>(key: K): RegistryMap[K] =>
  ((globalThis as any)[key] ?? ({} as RegistryMap[K]));
```

И удалить копипастный JSDoc-блок (он одинаковый в 3 файлах).

#### 6. Убрать `as any` в wrapper'ах

В `entity.tsx`/`widget.tsx`/`page.tsx` каст `Ui as any` нужен потому, что namespace-import `import * as Ui from './imports'` имеет тип `typeof imports`, а слот ждёт `EntityUi`/`WidgetUi`/`PageUi`. Они структурно совместимы, но TS не доказывает.

Решение: в `ui-kit/imports.tsx` экспортнуть `UiRegistry` (или per-layer тип `EntityUiRegistry` / `WidgetUiRegistry` / `PageUiRegistry`) и кастить туда. Аналог уже частично есть в `interfaces.ts` — нужно консолидировать.

#### 7. `Shape` — type cast `as unknown as IShapeWrapper`

[packages/web/core/src/wrappers/logic/shape/wrapper.tsx:63](packages/web/core/src/wrappers/logic/shape/wrapper.tsx:63). Двойной каст потому что `IShapeUi = Record<string, any>`. Если в `types.ts` дать `IShapeUi` тип `{ readonly [k: string]: IShapeUi & { [PATH]: readonly string[] } }` или вынести namespace в generic-параметр factory'и — можно убрать каст.

#### 8. `tsconfig.json` для публикуемой либы

[packages/web/core/tsconfig.json](packages/web/core/tsconfig.json) сейчас:

```json
{ "extends": "../../../tsconfig.base.json" }
```

Добавить:

```json
{
  "extends": "../../../tsconfig.base.json",
  "include": ["src/**/*"],
  "exclude": ["dist", "node_modules"],
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist"
  }
}
```

Сборка идёт через Vite/`lib-config`, эти опции — для IDE/typecheck (`tsc --noEmit`), чтобы он не лазил по всему монорепо.

#### 9. `controller.destroy` no-op

[packages/web/core/src/wrappers/logic/utils/proxy.ts:34](packages/web/core/src/wrappers/logic/utils/proxy.ts:34) возвращает `() => {}` и `onCleanup(() => controller.destroy?.())` в `createLogicWrapper` тоже вхолостую. Решение №1: убрать оба (поле + cleanup). Решение №2: задокументировать как extension point для будущих фич (e.g. teardown long-running subscriptions). Я бы выбрал убрать сейчас — добавим обратно когда появится реальный use case.

### 🟡 Осталось — P2 архитектурный вопрос

#### 10. `IAppConfig` живёт в `web/core`

[packages/web/core/src/interfaces.ts](packages/web/core/src/interfaces.ts). Это контракт для `apps/<app>/capsule.app.ts`, который читает `AppConfigPlugin` (Vite-плагин в `shared-vite`). Из-за него `web-core` тащит `@capsuletech/web-query` ради типа `MwToolbox`.

Варианты:
- **A.** Новый пакет `@capsuletech/shared-app-config` — типы без рантайма.
- **B.** Переезд в `@capsuletech/vite-builder/types` (там уже живёт логика плагина).
- **C.** Оставить как есть, согласившись на dep `web-query`.

Решение откладывается до прохода по `@capsuletech/web-query` — там же синхронизируем `MwToolbox`. **Не трогаем в этом проходе**, фиксируем как тех-долг.

### 🟡 Осталось — P3 косметика

#### 11. `index.css`

[packages/web/core/src/index.css](packages/web/core/src/index.css) — пустой файл с одним комментарием. Импортируется в `createRoot.ts:3`. Удалить файл + импорт.

#### 12. `vite.config.mts` — relative-deep import

[packages/web/core/vite.config.mts:1](packages/web/core/vite.config.mts:1):

```ts
import { libConfig } from '../../shared/lib-config/src';
```

Должно быть:

```ts
import { libConfig } from '@capsuletech/lib-builder';
```

Сейчас работает только потому, что pnpm symlink'ает workspace.

#### 13. `package.json: exports` подпуты

[packages/web/core/package.json:30-38](packages/web/core/package.json:30-38) — types указаны как `./dist/create/index.d.ts`, а import — `./dist/create.mjs` (без `/index`). Нужно сверить с реальным `dist/`-layout от `@capsuletech/lib-builder`. Соберите пакет (`pnpm nx build @capsuletech/web-core`) и посмотрите, что лежит в `dist/`. Если subdir-layout — обновить `exports` на `./dist/create/index.mjs`. Иначе types ↔ runtime могут разъехаться у потребителя.

#### 14. `EVENT_HANDLERS` представление

[packages/web/core/src/wrappers/ui/ui-kit/proxy.tsx:79](packages/web/core/src/wrappers/ui/ui-kit/proxy.tsx:79) — readonly-tuple. Можно нагляднее:

```ts
type EventName = 'onClick' | 'onInput' | 'onChange' | 'onBlur' | 'onFocus' | 'onKeyDown';
const EVENT_HANDLERS: Record<EventName, { updateStore: boolean }> = {
  onClick:   { updateStore: false },
  onInput:   { updateStore: true  },
  // …
};
// Итерируем через Object.entries(EVENT_HANDLERS).
```

#### 15. `parseMeta` без warn

[packages/web/core/src/wrappers/ui/ui-kit/proxy.tsx:14](packages/web/core/src/wrappers/ui/ui-kit/proxy.tsx:14) глотает `JSON.parse` без логирования. В `import.meta.env.DEV` блоке — добавить `console.warn('[UiProxy] meta-attr is not valid JSON:', raw)`. На прод это не уходит.

#### 16. `CHANGELOG.md`

15 пустых bump-only записей подряд. Собрать в один блок: `0.0.4 → 0.0.17: version bumps only`.

---

## Handoff — следующему агенту

Если ты только что подхватил эту задачу — добро пожаловать. Контекст ниже самодостаточен.

### Где ты работаешь

- **Репо:** `D:/CODING/projects/my/capsule/` (Windows, PowerShell shell, pnpm workspace, Nx 22).
- **Активная ветка:** `fix/web/core/add-docs-and-clean`. Создана из `main` (commit `9792b94`).
- **Git worktree-у `eager-herschel-0a02e5`** в `.claude/worktrees/` — игнорируй. Это другой checkout, не пиши туда.
- **CLAUDE.md в корне** — обязательное чтение перед началом. Там стек, команды, регламент HCA, golden rules, делегация субагентам.
- **Память** хранится по абсолютному пути `~/.claude/projects/D--CODING-projects-my-capsule/memory/`. Индекс — `MEMORY.md`, читается автоматически при старте сессии.

### Что уже сделано в этом проходе

Все изменения — в незакоммиченных правках на `fix/web/core/add-docs-and-clean`:

- **6 файлов доков обновлены / созданы** (см. секцию «✅ Сделано» выше). Доки протухли после рестракта `packages/ → packages/web/` и переименования `@capsule → @capsuletech`; теперь актуальны под `@capsuletech/web-core` и описывают весь публичный API включая `Shape`, `deriveInputType`, `onMount`.
- **`VitalsMonitoringProvider` возвращён за prop** [packages/web/core/src/providers/base.tsx](packages/web/core/src/providers/base.tsx). По умолчанию выключен. Dep `@capsuletech/web-profiler` оправдан — оставлен в `package.json`.
- **Файл-индекс `cleanup-plan.md`** (этот файл) — содержит детальный аудит модуля.

Не закоммичено намеренно — пользователь сам решит как и когда коммитить. Не делай `git commit` без явной просьбы.

### Что осталось — порядок

Следуй секциям выше. Логический порядок:

1. **P1 — мелочёвка** (пункты 1-3): убрать `IPageRender`, расширить `createRoot`, типизировать `routeTree`. После #2 не забыть синхронизировать вызовы в `apps/*/.capsule/index.ts` и CLI-шаблонах (см. список путей в пункте 2).
2. **P2 — типизация** (пункты 4-9): пройтись по `as any` и голому `any`, унифицировать registry-геттеры, расширить `tsconfig`. Здесь важно не сломать build — после каждого блока запускай `pnpm nx build @capsuletech/web-core` и проверяй потребителей: `apps/sandbox && pnpm dev` (грузи в браузер из CLAUDE.md «Команды»).
3. **P2 архитектурный (#10)** — **не трогай** пока, пока не сделаем проход по `@capsuletech/web-query`.
4. **P3 — косметика** (пункты 11-16): мелочи, можно делать пачкой.

### Регламент проекта (то что ты не должен нарушить)

- **Все слои HCA enforced линтером** (`@capsuletech/compliance`, см. ADR 004) — режим `warn`. При сборке проверяй логи dev-сервера.
- **`packages/web/core` — фреймворковый пакет**. Не делегируй субагентам (`entity`/`controller`/`feature`) — они только под app-уровень. Тут пишем сами.
- **Каждый Page/Widget/Entity/Controller/Feature** должен заканчиваться `export default <Name>` — но это про app-уровень, к core не относится.
- **Никакого `--no-verify`, `--force` push, `git reset --hard`** без явной просьбы.
- **На крупные операции (массовые скан/генерации, веер агентов)** — спрашивай пользователя. Бюджет ограничен (см. memory `feedback_ask_before_expensive`).
- **Если нужно решение по семантике** (например пункт 9 — выпиливать `destroy` или оставлять как extension point) — спроси пользователя через `AskUserQuestion`, не решай молча.

### Что писать в этот файл

После каждого закрытого пункта обнови:
- Таблицу прогресса вверху (`packages/web/core` → код-правки `✅`).
- Секцию «✅ Сделано» — допиши, что закрыто, с file:line ссылками.
- Удали соответствующий пункт из «🟡 Осталось».

Когда модуль закрыт целиком — переходи к следующему по предложенному списку модулей (см. ниже).

### Куда идти дальше после web/core

Логические следующие модули (по влиянию на ядро ↓):

| # | Модуль | Зачем | Заметки |
|---|---|---|---|
| 1 | `packages/web/state` | Тесно завязан с core (Bridge, createState). Типы `IBridge` нужны для core P2 #4. | Должен идти после core или параллельно. |
| 2 | `packages/web/router` | Разблокирует core P1 #3 (типизация `routeTree`). | После state. |
| 3 | `packages/web/query` | Разблокирует core P2 #10 (переезд `IAppConfig`). | После router. |
| 4 | `packages/web/ui` | Самый большой по объёму компонентов. | Можно делать параллельно с logic-пакетами. |
| 5 | `packages/web/style` · `packages/web/profiler` | Маленькие, последними. | |
| 6 | `packages/shared/*` (vite, file-manager, zod, lib-config) | Инфраструктура — низкое влияние на core. | Часто чистится попутно. |
| 7 | `packages/system/*` (biome, compliance, cli) | Линтер + tooling. | Отдельный большой проход. |
| 8 | `apps/*` | После того как все packages чистые. | Здесь обычно subagent'ы (entity/widget/...). |

Применяй ту же методу: код-аудит → актуализация доков → приоритизация P0/P1/P2/P3 → план правок → точечное исправление с предварительным согласованием спорных мест.
