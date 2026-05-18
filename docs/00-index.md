---
tags: [hca, moc]
status: documented
type: index
---

# 🧭 Capsule Framework — Map of Content

> [!info]
> Это корневой MOC (Map of Content) для документации фреймворка Capsule. Всё остальное в `docs/` — линкуется отсюда.
>
> Философия: **"UI is a Shadow"** — UI это немая проекция логики. Власть в Controller / Feature.

## 📐 Архитектура

- [[philosophy|🌑 Философия — UI is a Shadow]]
- [[layers|🪜 Слои HCA — Entity / Controller / Feature / Widget / Page]]
- [[golden-rules|📜 Золотой регламент (Compliance)]]
- [[lifecycle|🔄 Жизненный цикл — от клика до Feature]]
- [[tagging-system|🏷️ Система мета-тегов]]
- [[01-architecture/adr/README|🧠 ADR — архитектурные решения]]
  - [[001-xstate-as-canonical-fsm|🛠️ ADR 001 — XState как канонический FSM-движок]]
  - [[002-controller-vs-feature|🛠️ ADR 002 — Controller vs Feature]]
  - [[003-router-context-based|🛠️ ADR 003 — Роутер: Context-based]]
  - [[004-compliance-linter|🛠️ ADR 004 — Линтер compliance]]
  - [[005-tag-aliases-registry|🛠️ ADR 005 — Реестр тег-алиасов]]
  - [[007-uiproxy-cleanup|🛠️ ADR 007 — Cleanup в UiProxy]]
  - [[008-hybrid-fsm-api|🛠️ ADR 008 — Гибридная FSM-схема (XState + next())]]
  - [[009-event-interception-extension|🛠️ ADR 009 — Расширение перехватов событий]]
  - [[010-builders-split|🛠️ ADR 010 — Build-time пакеты в `packages/builders/`]]
  - [[013-explicit-define-app-config|🛠️ ADR 013 — `defineAppConfig` через explicit import]]

## 🧩 Слои

- [[02-entities/_template|Entities — реестр]]
- [[03-controllers/_template|Controllers — реестр]]
- [[04-features/_template|Features — реестр]]
- [[05-widgets/_template|Widgets — реестр]]
- [[06-pages/_template|Pages — реестр]]

## 🔌 Binding (как UI ↔ Logic общаются)

- [[ui-proxy|🪞 UiProxy — перехват UI-событий]]
- [[controller-proxy|🧠 ControllerProxy — FSM + цепочка `next()`]]
- [[shape|🧬 Shape — декларативные data-формы]]
- [[tag-registry|🏷️ Реестр тегов и алиасов]]
- [[overrides|🔁 Overrides — ремап имён методов]]

## ⚙️ System

- [[vite-plugins|🛠️ Vite-плагины]]
- [[auto-import|📦 Auto-import + .capsule/registry]]
- [[cli|💻 CLI]]
- [[desktop|🖥️ Desktop — Tauri 2 shell для apps/<app>]]
- [[git|🌿 Git workflow — GitHub Flow + Conventional Commits]]
- [[releases|🚀 Releases — Nx Release, registries, env]]

## 📦 Пакеты

- [[core|@capsuletech/web-core]]
- [[state|@capsuletech/web-state]]
- [[router|@capsuletech/web-router]]
- [[ui|@capsuletech/web-ui]]
- [[style|@capsuletech/web-style]]
- [[dnd|@capsuletech/web-dnd]]
- [[renderer|@capsuletech/web-renderer]]
- [[editor|@capsuletech/web-editor]] — `/manifests` + `/state` + `/inspector` subpaths
- [[profiler|@capsuletech/web-profiler]]
- [[compliance|@capsuletech/compliance]]
- [[api-middleware|🌐 API middleware — endpoints + pipeline]] — `@capsuletech/web-query`

## 🗺️ Быстрая навигация

| Я хочу… | Открой… |
|---|---|
| Понять идею | [[philosophy]] |
| Понять, что куда импортировать | [[golden-rules]] |
| Понять, как клик доходит до API | [[lifecycle]] |
| Описать новую Entity | [[02-entities/_template]] |
| Понять, что генерится в `.capsule/` | [[auto-import]] |
| Узнать, что делает Vite-плагин | [[vite-plugins]] |

## 🤖 Субагенты

- [[agents|Реестр субагентов]] — entity/widget/page/ui-component (Haiku) + controller/feature (Sonnet). Пишут типовые артефакты по канон-шаблонам, не читая кодбейзу.

## 🗄️ Архив

`docs/_archive/` — историческое (initial brief, copilot-чаты, scratch-эксперименты, старые agent-prompts). Не индексируется в основном Obsidian-вью (см. `userIgnoreFilters`).
