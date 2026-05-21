---
tags: [hca, meta, agents]
status: documented
---

# 🤖 Субагенты для рутинной работы

В `.claude/agents/` лежат **специализированные агенты** для написания типовых артефактов HCA и владения пакетами. Каждый имеет:
- встроенный канон-шаблон / контекст в system prompt (читать кодбейзу не нужно),
- ограниченный набор tools под свою зону,
- модель под уровень сложности задачи (Haiku для шаблонных, Sonnet для проектирования).

Все агенты начинают работу с чтения [[POLICY.md|POLICY.md]] (boundaries / docs / tests / release-readiness).

## Реестр: layer-agents (пишут артефакты HCA-слоёв)

| Агент | Модель | Что пишет | Где |
|---|---|---|---|
| [[#view]] | Haiku 4.5 | Stateless View (UI в JSX) | `apps/<app>/src/views/<group>/<name>.tsx` |
| [[#widget]] | Haiku 4.5 | Композиция View / Shape + Controller / Feature | `apps/<app>/src/widgets/<group>/<name>.tsx` |
| [[#page]] | Haiku 4.5 | Page (Layout + slots) | `apps/<app>/src/pages/<route>/<name>.tsx` |
| [[#ui-component]] | Haiku 4.5 | UI-kit компонент (CVA + createStyle) | `packages/web/ui/src/primitives/<name>/` (4-5 файлов) |
| [[#shape]] | Haiku 4.5 | Shape — zod-schema + defaults + item→template mapping | `apps/<app>/src/shapes/<name>.ts` |
| [[#controller]] | Sonnet 4.6 | FSM-схема (states + handlers + next) | `apps/<app>/src/controllers/<group>/<name>.tsx` |
| [[#feature]] | Sonnet 4.6 | Domain logic + API + navigation | `apps/<app>/src/features/<group>/<name>.tsx` |
| [[#docs-writer]] | Haiku 4.5 | Два дока (AI-anchor + user-guide) по скелету | `docs/_meta/<slug>.md` + `docs/0X-…/<slug>.md` |
| [[#app]] | Sonnet 4.6 | Координатор apps/. Делегирует layer-agents, не пишет код сам | `apps/<name>/` (структура) |

## Реестр: owner-agents (отвечают за пакеты)

Каждый пакет в репо имеет owner-агента, который владеет full lifecycle (код + тесты + docs + release readiness). Owner — это «человек», к которому можно обратиться `Agent(subagent_type='owner-<X>', ...)` за trivial-фиксами в своей зоне. Нетривиальное эскалируется юзеру.

### Ownership matrix

| Owner-agent | Пакеты | Release group |
|---|---|---|
| **`owner-builders`** | `packages/builders/{biome, compliance, lib, vite}` | `cli` (fixed) |
| **`owner-cli`** | `packages/cli` | `cli` (fixed) |
| **`owner-shared`** | `packages/shared/{file-manager, utils, zod}` | `cli` + `web_base` + private |
| **`owner-canvas`** | `packages/canvas/{host, three, ui}` | independent |
| **`owner-web-core`** | `packages/web/core` | `web_base` (fixed) |
| **`owner-web-state`** | `packages/web/state` | `web_base` (fixed) |
| **`owner-web-router`** | `packages/web/router` | `web_base` (fixed) |
| **`owner-web-style`** | `packages/web/style` | `web_base` (fixed) |
| **`owner-web-ui`** | `packages/web/ui` | `web_base` (fixed) |
| **`owner-web-dnd`** | `packages/web/dnd` | `web_base` (fixed) |
| **`owner-web-editor`** | `packages/web/editor` | `web_base` (fixed) |
| **`owner-web-query`** | `packages/web/query` | `web_base` (fixed) |
| **`owner-web-renderer`** | `packages/web/renderer` | `web_base` (fixed) |
| **`owner-web-profiler`** | `packages/web/profiler` | `web_base` (fixed) |
| **`owner-web-map`** | `packages/web/map` | independent (iter 0) |
| **`owner-web-remote`** | `packages/web/remote` | independent (phase 0) |
| **`owner-tests`** | `packages/cli/e2e/` + capsule-test workflow + Verdaccio / dev / Storybook orchestration | n/a (test infra) |
| **`owner-git`** | git workflow (branches, commits, PRs, merges, cleanup) | n/a (cross-cutting) |
| **`owner-deps`** | dependency hygiene (singleton sync, knip/syncpack, lockfile diff, overrides registry) | n/a (cross-cutting) |

**Release groups (из `nx.json:release.groups`):**
- `cli` (tag `cli@{version}`): cli, shared-file-manager, vite-builder, compliance, lib-builder
- `web_base` (tag `web@{version}`): все web-* + shared-zod
- Independent: biome-config, web-map, web-remote, canvas-*, shared-utils (private)

**Особые роли (не владеют пакетом, а workflow):**

- **`owner-tests`** — testing infrastructure. Знает CLI flow, Verdaccio lifecycle, smoke fixture, capsule-test prod-репу. Может запускать `release-local --group=all`. При framework-bug — диагностирует класс и эскалирует с repro steps + suggested owner. **Не правит** `packages/*` и не bump'ит версии.

- **`owner-git`** — git operations. Branches, commits, PRs, merge с auto-delete branches, cleanup. Полный autonomy после CI green (auto-merge). Запрещён force-push в main, history rewrites, hook bypass. Bisect / regression search.

- **`owner-deps`** — dependency hygiene. Audit singletons, knip/syncpack runs, lockfile diff review, `pnpm why` queries, Verdaccio storage inspection, ведёт `docs/_meta/dep-management-plan.md`. **Не bump'ит версии** и не правит пакеты — только аудит + рекомендации главному.

### Owner-agent контракт

- **Зона ответственности:** owner работает ТОЛЬКО в своей папке. Чужие пакеты — через делегирование (`Agent(subagent_type='owner-<X>', ...)`).
- **Definition of done:** code + tests + docs в одном PR (см. [[release-checklist]]).
- **Cross-package context:** owner знает свою release-группу + consumer'ов своего пакета. Согласует breaking changes с соседями.
- **Канон не дублируется:** owner ссылается на `docs/_meta/<package>.md` (AI anchor) как на single source of truth. Не копирует контент в prompt — обновляет doc, обновление автоматически распространяется.

Полный регламент — в [[POLICY.md|POLICY.md]].

## Как они вызываются

Главный (Opus) оркеструет:

```
User: "сделай View LoginForm с email и password"
  ↓
Opus распознаёт layer → view
  ↓
Agent(subagent_type='view', prompt='LoginForm with email and password inputs + submit button')
  ↓
Haiku пишет файл по канон-шаблону
  ↓
Opus проверяет результат, докладывает пользователю
```

Можно вызывать **несколько параллельно** в одном сообщении (когда задачи независимые):

```
User: "сделай View LoginForm + Controller Auth + Page для /login"
  ↓
Opus спавнит 3 агента в одном tool-message:
  - Agent(subagent_type='view', prompt='LoginForm...')
  - Agent(subagent_type='controller', prompt='Auth controller idle→submitting...')
  - Agent(subagent_type='page', prompt='Page /login wrapping Widget.Forms.Auth')
```

Для **владельческой работы** (правки в `packages/<pkg>/`):

```
User: "в @capsuletech/web-router нужно добавить replace(path) метод"
  ↓
Opus → Agent(subagent_type='owner-web-router', prompt='...')
  ↓
Sonnet читает packages/web/router/, docs/_meta/web-router.md, ADR 014
  ↓
Делает code + test + docs update; согласует с owner-web-core (consumer)
  ↓
Opus проверяет, юзер мерджит
```

## Что **не** делегируется субагентам

| Тип задачи | Кто делает |
|---|---|
| Архитектурное решение, ADR | Opus (я) |
| Кросс-слойный или кросс-пакетный refactor | Opus оркеструет, делегирует по частям |
| Code-review результата субагента | Opus |
| Многошаговая задача с зависимостями между пакетами | Opus оркеструет; owner-agents — листья |
| Чистая косметика (`console.log`-clean, переименование в 1 файле) | Opus напрямую |

## Принципы дизайна агентов

1. **Канон в prompt'е, не в файлах кодбейзы** (для layer-agents). Owner-agents — наоборот: лёгкий prompt + ссылка на canonical AI anchor в `docs/_meta/`.
2. **Минимум tools.** Layer-agents: `Read/Write/Edit/Glob`. Owner-agents: `+ Bash` (для запуска тестов/билдов своей зоны). Никогда не `Grep` (соблазн прошерстить весь репо) и не `Agent` (агенты — листья).
3. **Один артефакт на вызов** (для layer-agents). Owner-agents — могут писать пакетную правку, но в пределах своей зоны.
4. **Compliance-правила в каждом prompt'е.** Каждый агент знает свои «нельзя».
5. **Один уточняющий вопрос максимум.** Лучше написать и переписать, чем спрашивать пять раз.

## Файлы

```
.claude/agents/
├── POLICY.md                # cross-cutting policy (boundaries, docs, tests, release) — все читают first
├── app.md                   # координатор apps/ (Sonnet)
├── view.md                  # Haiku
├── widget.md                # Haiku
├── page.md                  # Haiku
├── ui-component.md          # Haiku (framework-only)
├── shape.md                 # Haiku
├── controller.md            # Sonnet
├── feature.md               # Sonnet
├── docs-writer.md           # Haiku
└── owner-<package>.md       # Sonnet × 16 — by-package ownership (см. ownership matrix)
```

## Universal vs framework-only

См. [[POLICY.md|POLICY.md]] п.8. TL;DR:
- **Universal** (попадают в CLI templates → копируются в user-workspace): `app`, `view`, `widget`, `page`, `shape`, `controller`, `feature`.
- **Framework-only** (живут только в этом репо): `ui-component`, `docs-writer`, все `owner-*`.

## Отчётность по фичам

`scripts/feature-report.mjs` парсит Claude-логи (`~/.claude/projects/<repo>/*.jsonl`) и считает расход на фичу.

**Маркеры в моих текстовых ответах:**
- `<<feature: slug>>` — старт фичи
- `<</feature>>` — конец

**Команды:**
```bash
pnpm report:list                # все маркированные фичи
pnpm report <slug>              # → reports/<slug>.md
pnpm report:all                 # все фичи в reports/
```

Отчёт содержит: токены (input/output/cache), стоимость в $, разбивку по моделям, разбивку по субагентам. Цены — в `PRICES` константе скрипта, править при изменении тарифов.

## Эволюция

- **Новый повторяющийся паттерн** в layer-agents — заводим нового layer-agent.
- **Новый пакет** в `packages/` — заводим `owner-<pkg>.md`, обновляем ownership matrix.
- **Шаблон устаревает** (например, изменили `IHandlerApi`) — правим .md-файл агента, не код. «Обновился один файл — все будущие генерации правильные».
- **Канон пакета меняется** — owner правит свой `docs/_meta/<pkg>.md`, не агента-prompt. Owner-prompt ссылается на anchor; obnov anchor → следующая инвокация owner'а видит свежий.

## Связанное

- [[POLICY.md]] — cross-cutting policy для всех агентов
- [[release-checklist]] — что делает owner перед релизом пакета
- [[layers]] — формальное определение HCA-слоёв (используют layer-agents)
- [[golden-rules]] — правила, которые соблюдают агенты
- [[compliance|@capsuletech/compliance]] — линтер, который ловит нарушения
