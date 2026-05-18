# Capsule

> Фреймворк для долгоживущих UI-приложений. Архитектура **HCA** (Hyper-Controlled Architecture) на Solid.js, XState и TanStack Router.
> Философия: **UI is a Shadow** — интерфейс это немая проекция логики.

Capsule разделяет «что показать», «как реагировать» и «что делать с миром» по разным физическим слоям. Entity рендерит JSX и не знает ничего про state, API или роутинг. Controller — FSM на XState, который перехватывает события у потомков через Proxy. Feature держит side-effects. Widget склеивает всё это композицией. На границах работают линтер (`@capsuletech/compliance`) и кодген (`@capsuletech/vite-builder`), которые не дают сломать регламент.

---

## Главное

- **Solid runtime.** Fine-grained reactivity без virtual DOM и diff-фаз — подписки точечные, перерисовывается только то, что реально изменилось.
- **FSM как способ описания поведения.** Controller это XState-схема, а не свалка `useState`. Переходы, entry/exit, store-context — встроены, не сбоку.
- **UI ↔ Logic через Proxy.** Никаких ручных `onClick={handler}`. Controller перехватывает события у любого ребёнка через [UiProxy](docs/07-binding/ui-proxy.md), Entity описывает только структуру.
- **Дизайн-система с глубокой кастомизацией.** Tailwind v4 + CVA + кастомный `createStyle` + Kobalte-примитивы. Темизация, варианты, slot-overrides на уровне фреймворка, а не «накатить класс сверху».
- **Compliance-линтер.** Запрещённые импорты (upward / horizontal / fetch-в-Controller) ловятся на этапе Vite-dev. Регламент не висит в `CONTRIBUTING.md` — он enforced.
- **Auto-import без импортов.** `Page`, `Widget`, `Entity`, `Controller`, `Feature`, `Shape` — глобальные wrappers. Слоты приходят позиционными аргументами с типизацией через сгенерённый `CapsuleSlots`.
- **Registry-driven CLI.** Один реестр питает и интерактивный TUI (clack), и `commander`-команды. Scaffold слоёв, релизы, git-workflow — через `pnpm capsule`.

## Стек

| Слой | Технология |
|---|---|
| Reactivity | [Solid.js](https://www.solidjs.com/) |
| State machines | [XState](https://stately.ai/) |
| Routing | [TanStack Solid Router](https://tanstack.com/router) |
| Build | Vite 6 + кастомные плагины (`@capsuletech/vite-builder`) |
| Styling | Tailwind v4 + CVA + `@capsuletech/web-style` |
| UI primitives | Kobalte, lucide-icons |
| Monorepo | Nx 22 + pnpm workspaces |
| Lint/format | Biome |

## Quick start

```bash
pnpm install
pnpm build:core

# запуск sandbox-приложения (обязательно из его директории)
cd apps/sandbox && pnpm dev
```

Создание нового пакета:

```bash
nx g @nx/js:library --name=@capsuletech/X --directory=packages/X \
  --importPath=@capsuletech/X --publishable --buildable
```

Подробнее про CLI и команды — в [docs/08-system/cli.md](docs/08-system/cli.md).

---

## Темы

### Архитектура HCA

Пять слоёв с однонаправленным потоком: `Entity → Controller → Feature → Widget → Page`. Запрещены upward- и horizontal-импорты. Композиция между сущностями возможна **только** в Widget. Имена слоёв — глобальные, инжектятся через `unplugin-auto-import`.

→ [Философия (UI is a Shadow)](docs/01-architecture/philosophy.md) · [Слои](docs/01-architecture/layers.md) · [Golden Rules (compliance)](docs/01-architecture/golden-rules.md) · [Жизненный цикл клика](docs/01-architecture/lifecycle.md)

### Binding — как UI и Logic общаются

`Controller` оборачивает базовый UI-kit в Proxy. Когда у JSX-узла задан `meta`, Proxy подписывается на 6 событий, инжектит реактивные `class` / `disabled` / `name`, регистрирует элемент в store и снимает регистрацию через `onCleanup`. Текущий стейт читается из XState, цепочка `next()` идёт **прямым вызовом** `parent.controller[name]` без event-bus.

→ [UiProxy](docs/07-binding/ui-proxy.md) · [ControllerProxy + `next()`](docs/07-binding/controller-proxy.md) · [Tag registry](docs/07-binding/tag-registry.md) · [Overrides](docs/07-binding/overrides.md)

### Система мета-тегов

Связь между UI и Controller — не через imperative refs, а через декларативные `data-meta`. Реестр алиасов (`@inputs`, `@submit`, …) раскрывается линтером и runtime'ом. Это и есть «контракт» между слоями.

→ [Tagging system](docs/01-architecture/tagging-system.md) · [Tag registry](docs/07-binding/tag-registry.md)

### Дизайн-система

`@capsuletech/web-ui` строит компоненты поверх Kobalte (доступность, behavior) и CVA (варианты). `@capsuletech/web-style` даёт `createStyle` для семантических токенов, тем и slot-overrides. Tailwind v4 — как rendering-engine для классов. Темизация и кастомизация — first-class, а не post-hoc патч.

→ [@capsuletech/web-ui](docs/09-packages/ui.md) · [@capsuletech/web-style](docs/09-packages/style.md)

### Пакеты

Монорепо `@capsuletech/*`. Юзер на уровне приложения держит в зависимостях только Capsule-пакеты; solid-js / vite / xstate / @tanstack — скрытые внутренние детали.

→ [@capsuletech/web-core](docs/09-packages/core.md) · [@capsuletech/web-state](docs/09-packages/state.md) · [@capsuletech/web-router](docs/09-packages/router.md) · [@capsuletech/web-ui](docs/09-packages/ui.md) · [@capsuletech/web-style](docs/09-packages/style.md) · [@capsuletech/compliance](docs/09-packages/compliance.md) · [api-middleware](docs/09-packages/api-middleware.md)

### Системная часть (Vite, CLI, релизы)

Три кастомных Vite-плагина держат всю инфру: `ExportGeneratorPlugin` (lazy-реестр слоёв), `RouterPlugin` (зеркальные routes для TanStack), `HMRWrappingPlugin` (babel-патчинг wrappers под Solid HMR). CLI — registry-driven, релизы через Nx Release.

→ [Vite-плагины](docs/08-system/vite-plugins.md) · [Auto-import + `.capsule/registry`](docs/08-system/auto-import.md) · [CLI](docs/08-system/cli.md) · [Git workflow](docs/08-system/git.md) · [Releases](docs/08-system/releases.md)

### Архитектурные решения (ADR)

Все нетривиальные решения зафиксированы в `docs/01-architecture/adr/`: почему XState единственный FSM-движок, как разъехались Controller и Feature, почему линтер в режиме `warn`, как устроено расширение перехватов событий.

→ [Реестр ADR](docs/01-architecture/adr/README.md)

---

## Карта документации

Полный MOC (Map of Content) — в [docs/00-index.md](docs/00-index.md). Документация ведётся как Obsidian-vault: внутренние ссылки могут быть через `[[WikiLinks]]`, но из этого README навигация идёт по обычным relative-путям, чтобы работать и в GitHub.

## Лицензия

TBD.
