# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 🎯 Старт сессии — для architect-agent (главный assistant)

**Перед первым действием прочитай:**
1. **POLICY** ниже (этот файл) — никаких костылей, две роли, OWNERSHIP & TESTING, test-first.
2. **[`docs/_meta/architect-routing.md`](docs/_meta/architect-routing.md)** — symptom → agent table. Куда делегировать в зависимости от запроса.
3. **[`docs/_meta/anti-patterns.md`](docs/_meta/anti-patterns.md)** — каталог костылей с proper-fix'ами. Если соблазн на quick-fix — проверь здесь сначала.
4. **`packages/<pkg>/OWNERSHIP.md`** — если задача касается одного пакета.

### 5 правил decision-making

1. **Триаж первым.** Каждый incoming запрос: архитектурное решение / локальный fix / "не знаю работает ли". Это определяет — делаешь сам / делегируешь owner-X / сначала проверяешь.
2. **Не лезь в `packages/*` сам.** Даже «быстро». Делегируй `owner-<pkg>`. Если соблазн — POLICY п.1 + anti-patterns.md.
3. **Smoke перед release.** `pnpm test:e2e:cli` обязательно после любого framework change. Без baseline diff не виден.
4. **Quick-fix → стоп.** Если решение требует >2 нестабильных шагов / hardcoded paths / silent-fallback'ов — подход в корне неверный. Пересматриваем.
5. **Эскалация снизу вверх.** Owner-X на cross-package issue → ты (главный) → user. Никогда наоборот. Owner-* не пишут архитектуру.

### Что делает архитектор

- **Триаж** запросов от user (routing).
- **Архитектурные решения** (cross-package, контракты, ADR).
- **Final coordination** на breaking releases (bump → tag).
- **OWNERSHIP boundary** — следит чтоб owner-* не выходили за зону.

### Что НЕ делает архитектор

- Code-edits в `packages/<pkg>/src/` без причины (это owner-<pkg>).
- Git ops, кроме случаев когда `owner-git` не подходит (rare).
- Прямой `release-local` если `owner-tests` может сам.
- Dep audit (`pnpm why`, version sync) — `owner-deps`.

---

## 🚨 POLICY — фундаментальные правила (для всех agents)

Эти правила имеют **наивысший приоритет**. Любой agent, начинающий работу, обязан их соблюдать.

### 1. НИКАКИХ КОСТЫЛЕЙ И ВРЕМЕННЫХ РЕШЕНИЙ

Если что-то работает не так как должно — **чиним до конца, тестим, потом идём дальше**. Не накапливаем «временно так оставлю», не плодим quick-fix'ы поверх неработающего поведения.

Если для достижения нужного результата требуется куча нестабильных шагов / hardcoded путей / silent-fallback'ов — **подход в корне неверный**. Останавливаемся, обсуждаем, пересматриваем архитектуру. Не дописываем третий @source path в надежде что один из них резолвится.

Capsule — фреймворк. На нём будут базироваться рабочие проекты. **Костыли тут несовместимы с миссией.**

### 2. ДВЕ РОЛИ

| Роль | Что | Где |
|---|---|---|
| **Framework developer** | Лендинги фреймворка, sandbox, доки-сайты | `apps/` **внутри** capsule monorepo (`D:\CODING\projects\my\capsule\apps\`). Workspace-режим, `@capsuletech/*` через `workspace:*`. |
| **User / тест-зона** | Воспроизводит **prod-условия** реального внешнего пользователя | `D:\CODING\projects\my\capsule-test\` (отдельный repo). CLI бинарник дёргается из capsule workspace (`node ../../packages/cli/bin/capsule.mjs` — это dev-quirk), **все остальные** `@capsuletech/*` тянутся из локального **Verdaccio**. |

Любая фича считается готовой только когда **она работает в `capsule-test`** (prod-условиях). Если работает в storybook / workspace dev но ломается после publish — фича не готова, исправляем причину публикационного дрейфа, не пишем второй workaround.

### 3. РЕЛИЗ-ПАЙПЛАЙН

`scripts/release-local.mjs` публикует обе группы (`cli` + `web_base`) с **тем же** version из package.json (без `-dev.<ts>` суффиксов). Verdaccio storage purgeится перед publish'ом. Не bump'аем версии в `package.json` без необходимости.

### 4. ТРИАЖ ВОПРОСОВ

Перед делегированием agent'у или внесением change'а:
- Это решение **архитектурное** (затрагивает несколько пакетов / contract'ы) → обсудить с пользователем.
- Это **локальный bug-fix** в одном пакете → делать сразу, через owner-agent.
- Это **«я не знаю работает ли»** → сначала проверить (прочитать source / run test), потом писать код.

### 5. OWNERSHIP & TESTING

Каждый пакет в `packages/<scope>/<name>/` имеет **`OWNERSHIP.md`** — single source of truth о зонах ответственности owner-agent'а, quirks, плане рефакторинга и test coverage. Шаблон — `docs/_meta/OWNERSHIP-template.md`.

**Owner-agent перед началом работы обязан:**
1. Прочитать `packages/<pkg>/OWNERSHIP.md` (если есть). Если нет — создать после первого нетривиального изменения.
2. Прочитать `docs/_meta/<pkg>.md` AI-anchor (углублённая архитектура).
3. Запустить unit-tests пакета (`pnpm --filter <pkg> test`) — должны быть green до изменений.

**При breaking change:**
- Обновить tests + добавить новые для нового contract'а.
- Update `OWNERSHIP.md` секция «Публичный API».

**Перед release** (через главного):
- `pnpm test:e2e:cli` — smoke fixture обязательна. Тестит full prod-сценарий первого пользователя (workspace init → install → app init → dev → curl). Self-contained (запускает свой Verdaccio в `packages/cli/e2e/verdaccio-tmp/`).

**Cross-package change:**
- Не лезть в чужой пакет. Делегировать через главного, который вызовет соответствующего owner'а.
- Если задача касается shared infra (`scripts/release-local.mjs`, root `package.json`, `nx.json`) — делает главный assistant.

---

## Project

`@capsuletech/source` — экспериментальный фреймворк поверх Solid.js + XState + TanStack Solid Router. Архитектура называется **HCA (Hyper-Controlled Architecture)**, философия: *"UI is a Shadow"* — интерфейс это немая проекция логики; вся власть в Controller/Feature, общение с UI идёт через Proxy и meta-теги.

Полная документация — в `docs/` (Obsidian vault). Главный MOC: `docs/00-index.md`.

## Stack

- **Runtime:** Solid.js (fine-grained reactivity)
- **Logic:** XState — единственный движок локальной FSM (transitions, entry/exit, store-context). UI-события (`onClick`/`onInput`/...) и `next()` диспетчатся в HCA-Proxy **сверху**, не через XState event-bus. См. ADR 001 + ADR 008.
- **Router:** `@tanstack/solid-router` через синглтон `routerService`
- **Build:** Vite 6 + кастомные плагины (`@capsuletech/vite-builder`)
- **Monorepo:** Nx 22 + pnpm workspaces
- **Styling:** Tailwind v4 + CVA + кастомный `createStyle`
- **Lint/format:** Biome (расширяет `packages/builders/biome/biome.json`)

## Команды

```bash
pnpm build:core            # сборка core
pnpm lint                  # biome check --write
pnpm lint:fix              # biome check --apply --unsafe
pnpm format                # biome format --write

# Создание новой библиотеки
nx g @nx/js:library --name=@capsuletech/X --directory=packages/X --importPath=@capsuletech/X --publishable --buildable

# Запуск приложения — всегда из его директории, чтобы Vite видел правильный cwd
cd apps/sandbox && pnpm dev   # node ../../packages/cli/bin/capsule.mjs (clack-меню)

# Desktop (Tauri 2) — обёртка над любым apps/<app>
# dev: сначала запусти apps/<app> как обычно (vite), потом:
pnpm desktop sandbox --url=http://localhost:5173
# build: собери apps/<app>, потом:
pnpm desktop:build sandbox
```

> [!important]
> Vite привязан к **директории приложения** (`apps/<app>/`) — она же `workspaceRoot` для `getWorkspaceRoot()` в `@capsuletech/file-manager`. Запуск из корня репо ломает резолв `capsule.config.ts` и алиасы. Все CLI-команды дёргают через `cd apps/<app>` или скрипты приложения.

Запуск sandbox через CLI на самом деле дёргает `createDevServer` из `@capsuletech/vite-builder` (`packages/builders/vite/src/defines/capsuleConfig.ts`), который читает `apps/sandbox/capsule.config.ts`.

### Backend (Rust workspace `backend/`)

```
backend/
  fs/                      shared FS-утилиты (общие для всех Rust-crate'ов)
  desktop/                 Tauri 2 shell — одна обёртка для всех apps/<app>
  scriber/                 LLM-агент (Ollama-based)
    ollama/                lib: HTTP-клиент к Ollama + streaming
    tools/                 lib: tool-calling протокол
    server/                bin `capsule-server`: axum HTTP/SSE
```

`pnpm dev:backend` поднимает `capsule-server` (агентский). В будущем рядом со `scriber/` появится отдельный crate для web-test endpoints — `backend/` это и есть **весь** Rust-код проекта.

**Desktop shell** (`backend/desktop/`) — параметризуется на лету: `scripts/desktop.mjs` пишет временный override `.tauri.<app>.json` (productName, identifier, devUrl/frontendDist) и дергает `tauri dev|build --config <override>`. Сами апп ничего про Tauri не знают, никаких контроллеров/features для desktop пока нет — Tauri-API подключаем по необходимости позже.

## Архитектурные слои (HCA)

Снизу вверх. Запрещены **upward** и **horizontal** импорты. Любая композиция между сущностями — только в Widget.

| Слой | Папка | Что это | Wrapper |
|---|---|---|---|
| **Entity** | `entities/` | Domain data layer: zod schema + defaults + meta. **БЕЗ UI**. Single source of truth для сущностей (User, Product, Order). Возвращает plain config (не component). | `Entity((z) => ({ schema, defaults? }))` |
| **View** | `views/` | Stateless UI в виде JSX. Только Solid JSX + `data-meta`. Не знает про XState, API, router. | `View((Ui, props?) => JSX)` |
| **Shape** | `shapes/` | **Presentation**: как нарисовать сущность через batch-template (`Ui.DataTable`, `Ui.List`). Ссылается на Entity для schema/defaults. | `Shape((z, ui) => ({ schema, defaults?, as?, ...extras }))` |
| **Controller** | `controllers/` | Поведение на FSM-схеме. Через Proxy перехватывает `onClick`/`onInput` у потомков. | `Controller((services) => ({ initial, states }))` |
| **Feature** | `features/` | Domain logic / side effects. Только тут разрешены API. Валидирует через `Entities.X.schema.parse(...)`. | `Feature((services) => ({ initial, states }))` |
| **Widget** | `widgets/` | Композиция View / Shape + Controller / Feature. Единственное место, где можно «склеивать». | `Widget((Ui, props?) => JSX)` |
| **Page** | `pages/` | Корневой layout, оборачивает Widget. | `Page((Ui, props?) => JSX)` |

Имена `Page`, `Widget`, `View`, `Shape`, `Controller`, `Feature`, `Entity` — **глобальные**, инжектятся через `unplugin-auto-import`. В коде их **не импортируют**.

### Entity vs Shape — критическое различие

| Concern | Entity | Shape |
|---|---|---|
| Что описывает | Сущность (User row) | Презентация (таблица users) |
| Содержит UI template | ❌ | ✅ (`as: ui.DataTable` / `ui.List`) |
| Содержит columns / itemAs | ❌ | ✅ |
| Reusable across presentations | ✅ | ❌ (specific к layout) |
| Возвращает | plain config object | component-функция |

Правило: **сущность → Entity. Как нарисовать → Shape.** Shape ссылается на Entity (`schema: Entities.Users.schema`).

### Что приходит param vs global (semantic rule)

- **`Ui`** (UI-kit примитивы) — приходит **первым параметром** wrapper'а. Wrapper готовит per-instance проксированную копию через `UiProxy` под текущий `ControllerContext` (event-binding, meta-registration). Stable ref у одного instance, но разные у разных instance'ов.
- **`Views` / `Widgets` / `Shapes` / `Controllers` / `Features`** — **глобалы** через `Object.assign(globalThis, _registry)` в bootstrap. Один stable ref на всё приложение. Доступны прямо из factory body без объявления в args.
- **`services`** (Controller/Feature) — приходит параметром, per-instance (api/store/state).
- **`props`** — опциональный второй аргумент в View/Widget/Page. Используется для template-pattern (Shape `as` через `<Dynamic component={Tpl} {...props} />`).

`Compliance` (AST-линтер) ловит upward/horizontal импорты — слой защищён независимо от того, откуда берётся ref. См. ADR 004.

Структура namespace: **nested по структуре папок**. `widgets/forms/auth.tsx` → `Widgets.Forms.Auth`, `views/viewer/loginForm.tsx` → `Views.Viewer.LoginForm`. Папка = namespace-уровень, имя файла = leaf. **Не** flat (`Views.AuthLoginForm` — неправильно). Корневые файлы без папки: `views/hello.tsx` → `Views.Hello`.

Полные сигнатуры (см. `packages/web/core/src/wrappers/interfaces.ts`):
- `Entity((z) => ({ schema, defaults? }))` — plain config, без UI. `Entities` global registry.
- `View((Ui, props?) => JSX)` — `Shapes`/`Views`/`Entities` доступны как глобалы.
- `Widget((Ui, props?) => JSX)` — `Views`/`Shapes`/`Controllers`/`Features`/`Entities` доступны как глобалы.
- `Page((Ui, props?) => JSX)` — `Widgets` доступны как глобал.
- `Shape((z, ui) => ({ schema, defaults?, as?, ...extras }))` — `Views`/`Entities` доступны как глобалы. Batch flow: Shape passes data + extras в `as` template.
- `Controller((services) => schema)`, `Feature((services) => schema)` — `Entities` доступны для validation.

Типы слотов живут в `CapsuleSlots` (`.capsule/@types/slots.d.ts`, генерится `ExportGeneratorPlugin`'ом). Каждое property типизировано как `typeof import('@<layer>/...').default` — Ctrl+Click ведёт в источник.

**Конвенция:** каждый файл уровня (Widget/Page/View/Shape/Controller/Feature) **обязан** заканчиваться `export default <Name>;`. Без этого: (а) HMR продолжит работать (плагин добавит при отсутствии), (б) **но TS не увидит default и сломается типизация slot-кодгена**. Пиши export руками — это даёт навигацию Ctrl+Click и корректные типы.

## Ключевая механика

### UiProxy (`packages/web/core/src/engine/ui-proxy.tsx`)
Когда `View` или `Shape` рендерится внутри `Controller`, базовый UI-kit оборачивается в Proxy. Политика **C — own meta opt-in**: побочные эффекты (регистрация в store, event-binding) активируются **только** если на JSX-узле явно задан `meta`. Структурные обёртки (`Field`, `Field.Label` и т.д.) проходят сквозным рендером.

Для элементов с `meta`:
- `id = createUniqueId()` (стабильный) + `createEffect` для re-register на изменение props + `onCleanup` для unregister;
- автоподписка на 6 событий: `onClick`, `onInput`, `onChange`, `onBlur`, `onFocus`, `onKeyDown`;
- дедупликация bubbling через event-marker `__capsule_<eventName>__`;
- инжект реактивных `class` (с подмесом `store.styles[name]`), `disabled` (из `store.loading`), `name` (выведенного из `meta.tags`);
- `target` собирается с `meta` (из inner JSX), `dynamicMeta` (из outer View-prop), `key`/`modifiers` для keyboard.

### ControllerProxy (`packages/web/core/src/engine/controller-proxy.ts`)
- Текущий стейт **читается из XState**: `state.value`. Собственного runtime нет.
- При вызове `controller.<method>(target, ctx)` ищет хэндлер: `schema.states[current][method]` → `schema[method]` (top-level) → `await next()` (автобабблинг).
- Передаёт в хэндлер API: `{ target, context, next, store, state }`. `state.set(name)` шлёт `__GOTO_<name>__` в XState; `state.matches(name|name[])` — сверка стейта.
- `next(payload)` делегирует **прямым вызовом** `parent.controller[name]` — не через XState event-bus, естественный `await`-возврат. Опционально ремапит имя через `overrides`.

### createLogicWrapper (`packages/web/core/src/engine/logic-wrapper.tsx`)
Общая фабрика для Controller и Feature (различие только в инжектируемых `services`). Создаёт XState-машину через `createState(schema)`, кладёт в Context, навешивает `createEffect` для lifecycle (`onInit`/`onExit` по изменению `state.value`).

### Bridge (`packages/web/state/src/bridge.ts`)
Геттер-обёртка вокруг XState `state`/`send` + tag-операции `pick / omit / match / matchEntry`. Реактивный — Solid ловит глубокие пути (`store.ctx.components`, `store.styles`, `store.loading`).

## Vite-плагины (`packages/builders/vite/src/plugins`)

- **`ExportGeneratorPlugin`** — следит за `apps/*/src/{widgets,entities,controllers,features}/**` и поддерживает в актуальном состоянии `.capsule/registry/wrappers.ts` (lazy-импорты с вложенностью по папкам). Использует `@nx/devkit.names()` для нормализации; генерация — обычный string-concat (`ts-morph` нигде в кодбейзе не импортируется, хотя ADR/доки упоминают как «будущее»).
- **`RouterPlugin`** — следит за `apps/*/src/pages/**`, генерит зеркальные `.capsule/routes/__pages/__auth/login.tsx` из шаблона, дальше TanStack Router CLI собирает `routeTree.gen.ts`.
- **`HMRWrappingPlugin`** — pre-transform на babel-AST: превращает `const Login = Page(...)` в `(props) => Page(...)(props)` и добавляет `export default`. Без него HMR Solid ломается, потому что `Page(...)` возвращает функцию, а не компонент при первом вызове.

## Aliasing

`tsconfig.base.json` — **единственная точка** регистрации `@capsuletech/*` путей. Vite-builder резолвит через `tsconfigPaths()` + `AliasesPlugin` (см. `packages/builders/vite/src/defines/capsuleConfig.ts`), читая ту же `tsconfig.base.json`. При добавлении нового пакета:
1. Добавь путь в `tsconfig.base.json → compilerOptions.paths`.
2. Добавь имя пакета в `optimizeDeps.exclude` в `capsuleConfig.ts` (иначе esbuild попытается пре-бандлить workspace-пакет и сломает JSX-транспиляцию).

## Compliance (Golden Rules)

Подробнее в `docs/01-architecture/golden-rules.md`. Сжато:

1. **No Upward Imports.** Нижний слой не импортирует верхний.
2. **No Horizontal Imports.** `View.A` не импортирует `View.B`. `Controller.A` не знает о `Controller.B`. Только композиция в Widget или цепочка через `next()` к родительской Feature.
3. **Stateless View / Shape.** Никакого состояния, никаких импортов кроме Solid и типов.
4. **Composition Only in Widgets.** Одна View не может «жёстко» использовать другую — только через children/slots на уровне Widget.

✅ Правила **enforced линтером** через `@capsuletech/compliance` (Vite-плагин `CompliancePlugin`, режим `warn`). При нарушении — warning в логе dev-сервера с file:line:column + hint что делать. См. ADR 004.

## Известные шероховатости

Не «фиксить заодно», только если задача об этом:

_На текущий момент пусто — последняя итерация sweep'ов (2026-05-18..19) закрыла известный долг._

### Закрытые в коде
- ✅ Копипаста между `ControllerWrapper` / `FeatureWrapper` — заменено на `createLogicWrapper(kind)` (ADR 002).
- ✅ Утечка регистрации в UiProxy — `createUniqueId` + `createEffect` + `onCleanup` (ADR 007).
- ✅ Двойной FSM (XState + custom runtime) — XState теперь единственный (ADR 001 + 008).
- ✅ Дедупликация event-bubbling (один клик → один вызов handler).
- ✅ `internalMeta` → `dynamicMeta` в helpers (был баг — `pick(['@scope-tag'])` ничего не находил).
- ✅ Async-ошибки в хэндлерах — теперь ловятся через `safeCall`.
- ✅ Tag-aliases registry — `pick(['@inputs'])` теперь раскрывается (ADR 005).
- ✅ Роутер — Context-based, типизирован, `current()` возвращает `pathname`, хардкод `isAuthenticated` убран (ADR 003).
- ✅ Compliance-линтер — `@capsuletech/compliance` + Vite-плагин ловит upward / horizontal / disallowed-import / fetch-в-Controller (ADR 004, режим `warn`).
- ✅ Стейл `.js`/`.jsx` в `apps/*/src/` — отключено `recompileOnChanges` в `.idea/compiler.xml`; в `.gitignore` добавлены defensive-правила.
- ✅ Корень почищен — `_aaaaaa/`, `agent/`, `copilot/`, `req.txt`, `graph.json`, пустые `*.md`-stub'ы переехали в `docs/_archive/` или удалены.
- ✅ Debug `console.log` убраны из hot-path: `HMRWrapping.ts` (дамп transformedCode), `createModuleTree.ts` (дамп root), `builder/config.ts` (`'wadadawdwad'`), `ui/vite.config.ts` (debug-путь). Остались только намеренные информ-сообщения в CLI/build-логах.
- ✅ `nx.json: defaultBase` исправлен на `main`.
- ✅ `tsconfig.json` references обновлены — добавлены `cli`, `router`, `state`, `compliance` (раньше `tsc --build` их не видел).
- ✅ Дублирование алиасов — устранено. `tsconfigPaths()` + `AliasesPlugin` в vite-builder читают `tsconfig.base.json` как единственную точку правды (зафиксировано 2026-05-19 при создании `@capsuletech/web-remote`).

## Делегирование рутины субагентам

В `.claude/agents/` лежат 6 специализированных агентов для типовых артефактов. Каждый имеет канон-шаблон в system prompt — кодбейзу читать не нужно. Полный гайд — `docs/_meta/agents.md`.

| Агент | Модель | Когда вызывать |
|---|---|---|
| `view` | Haiku | новая View (stateless UI в JSX) |
| `shape` | Haiku | новый Shape (stateless UI в виде schema + mapper) |
| `widget` | Haiku | новый Widget (композиция) |
| `page` | Haiku | новая Page (Layout + слоты) |
| `ui-component` | Haiku | новый компонент в `@capsuletech/web-ui` |
| `controller` | Sonnet | новый Controller (FSM) |
| `feature` | Sonnet | новая Feature (API + side-effects) |

Использование:
```
Agent(subagent_type='entity', prompt='LoginForm with email/password/submit')
```

**Что НЕ делегируется:** архитектурные решения, ADR, кросс-слойные рефакторинги, правка фреймворковых пакетов (`@capsuletech/*`), code-review результата субагента, чистая косметика. Это всё делает главный (я).

**Принцип:** канон в prompt'е агента, не в файлах кодбейзы. Меняется паттерн — правится `.md`-файл агента, все будущие генерации сразу следуют новой версии.

## Когда работаешь над задачей

1. Сначала пойми, какой это **слой** — это определяет, какие импорты разрешены и какой wrapper использовать.
2. Если это новый артефакт типового слоя (View / Shape / Widget / Controller / Feature / Page / UI-component) — **делегируй субагенту**, не пиши сам.
3. Если задача про связь между View — это автоматически задача про Widget.
3. Если задача про API/IO — это автоматически задача про Feature.
4. Если правишь wrapper в `core/wrappers` — обнови соответствующую страницу в `docs/07-binding/`.
5. Если правишь vite-плагин — обнови `docs/08-system/vite-plugins.md`.

## Стиль ответов в этой репе

- Лаконично, по делу. Архитектурные решения — со ссылкой на код (`file:line`).
- Не предлагай фичи в обход регламента, даже если так проще. Если правило мешает — обсуди ADR в `docs/01-architecture/adr/`.
- Cross-references в Obsidian — через `[[WikiLinks]]`, не через относительные пути.
