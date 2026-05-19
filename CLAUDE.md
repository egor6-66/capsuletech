# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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
| **Entity** | `entities/` | Stateless UI. Только Solid JSX + `data-meta`. Не знает про XState, API, router. | `Entity(({ Field, Button, ... }) => JSX)` |
| **Controller** | `controllers/` | Поведение на FSM-схеме. Через Proxy перехватывает `onClick`/`onInput` у потомков. | `Controller((services) => ({ initial, states }))` |
| **Feature** | `features/` | Domain logic / side effects. Только тут разрешены API. | `Feature((services) => ({ initial, states }))` |
| **Widget** | `widgets/` | Композиция Entity + Controller. Единственное место, где можно «склеивать». | `Widget(({ Card, ... }) => JSX)` |
| **Page** | `pages/` | Корневой layout, оборачивает Widget. | `Page(({ Layout, Outlet }) => JSX)` |

Имена `Page`, `Widget`, `Entity`, `Controller`, `Feature` — **глобальные**, инжектятся через `unplugin-auto-import`. В коде их **не импортируют**.

Слоты других слоёв приходят **позиционными аргументами** в wrapper-функцию (см. `packages/web/core/src/wrappers/interfaces.ts`):
- `Widget((ui, features, controllers, entities) => JSX)` — flat-имена: `widgets/forms/auth.tsx` → `FormsAuth`, `entities/viewer/loginForm.tsx` → `ViewerLoginForm`
- `Page((ui, widgets) => JSX)`
- `Entity((ui) => JSX)`, `Controller(() => schema)`, `Feature((api) => schema)`

Типы слотов живут в `CapsuleSlots` (`.capsule/@types/slots.d.ts`, генерится `ExportGeneratorPlugin`'ом). Каждое property типизировано как `typeof import('@<layer>/...').default` — Ctrl+Click ведёт в источник.

**Конвенция:** каждый файл уровня (Widget/Page/Entity/Controller/Feature) **обязан** заканчиваться `export default <Name>;`. Без этого: (а) HMR продолжит работать (плагин добавит при отсутствии), (б) **но TS не увидит default и сломается типизация slot-кодгена**. Пиши export руками — это даёт навигацию Ctrl+Click и корректные типы.

## Ключевая механика

### UiProxy (`packages/web/core/src/engine/ui-proxy.tsx`)
Когда `Entity` рендерится внутри `Controller`, базовый UI-kit оборачивается в Proxy. Политика **C — own meta opt-in**: побочные эффекты (регистрация в store, event-binding) активируются **только** если на JSX-узле явно задан `meta`. Структурные обёртки (`Field`, `Field.Label` и т.д.) проходят сквозным рендером.

Для элементов с `meta`:
- `id = createUniqueId()` (стабильный) + `createEffect` для re-register на изменение props + `onCleanup` для unregister;
- автоподписка на 6 событий: `onClick`, `onInput`, `onChange`, `onBlur`, `onFocus`, `onKeyDown`;
- дедупликация bubbling через event-marker `__capsule_<eventName>__`;
- инжект реактивных `class` (с подмесом `store.styles[name]`), `disabled` (из `store.loading`), `name` (выведенного из `meta.tags`);
- `target` собирается с `meta` (из inner JSX), `dynamicMeta` (из outer Entity-prop), `key`/`modifiers` для keyboard.

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

`tsconfig.base.json` определяет `@capsuletech/*` пути для IDE. Реальные алиасы для рантайма — в `packages/builders/vite/src/defines/capsuleConfig.ts → resolve.alias` (для dev/build). При добавлении нового пакета обновляй **обе точки**, иначе IDE будет видеть, а Vite — нет.

## Compliance (Golden Rules)

Подробнее в `docs/01-architecture/golden-rules.md`. Сжато:

1. **No Upward Imports.** Нижний слой не импортирует верхний.
2. **No Horizontal Imports.** `Entity.A` не импортирует `Entity.B`. `Controller.A` не знает о `Controller.B`. Только композиция в Widget или цепочка через `next()` к родительской Feature.
3. **Stateless Entity.** Никакого состояния, никаких импортов кроме Solid и типов.
4. **Composition Only in Widgets.** Одна Entity не может «жёстко» использовать другую — только через children/slots на уровне Widget.

✅ Правила **enforced линтером** через `@capsuletech/compliance` (Vite-плагин `CompliancePlugin`, режим `warn`). При нарушении — warning в логе dev-сервера с file:line:column + hint что делать. См. ADR 004.

## Известные шероховатости

Не «фиксить заодно», только если задача об этом:
- Дублирование алиасов между `tsconfig.base.json` (`paths`) и `packages/builders/vite/src/defines/capsuleConfig.ts` (`resolve.alias`). Когда добавляется новый пакет — обновлять обе точки. Дедуп возможен (`tsconfigPaths` плагин уже подключён), но требует аккуратной проверки каждой записи — не cosmetic.

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

## Делегирование рутины субагентам

В `.claude/agents/` лежат 6 специализированных агентов для типовых артефактов. Каждый имеет канон-шаблон в system prompt — кодбейзу читать не нужно. Полный гайд — `docs/_meta/agents.md`.

| Агент | Модель | Когда вызывать |
|---|---|---|
| `entity` | Haiku | новая Entity (stateless UI) |
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
2. Если это новый артефакт типового слоя (Entity / Widget / Controller / Feature / Page / UI-component) — **делегируй субагенту**, не пиши сам.
3. Если задача про связь между Entity — это автоматически задача про Widget.
3. Если задача про API/IO — это автоматически задача про Feature.
4. Если правишь wrapper в `core/wrappers` — обнови соответствующую страницу в `docs/07-binding/`.
5. Если правишь vite-плагин — обнови `docs/08-system/vite-plugins.md`.

## Стиль ответов в этой репе

- Лаконично, по делу. Архитектурные решения — со ссылкой на код (`file:line`).
- Не предлагай фичи в обход регламента, даже если так проще. Если правило мешает — обсуди ADR в `docs/01-architecture/adr/`.
- Cross-references в Obsidian — через `[[WikiLinks]]`, не через относительные пути.
