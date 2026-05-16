---
tags: [hca, meta, agents]
status: documented
---

# 🤖 Субагенты для рутинной работы

В `.claude/agents/` лежат **специализированные агенты** для написания типовых артефактов HCA и документации. Каждый имеет:
- встроенный канон-шаблон в system prompt (читать кодбейзу не нужно),
- ограниченный набор tools (`Read, Write, Edit, Glob` — без Bash/Agent/Grep),
- модель под уровень сложности задачи (Haiku для шаблонных, Sonnet для проектирования).

## Реестр

| Агент | Модель | Стоит* | Что пишет | Где |
|---|---|---|---|---|
| [[#entity]] | Haiku 4.5 | $1/$5 | Stateless Entity | `apps/<app>/src/entities/<group>/<name>.tsx` |
| [[#widget]] | Haiku 4.5 | $1/$5 | Композиция Entity+Controller+Feature | `apps/<app>/src/widgets/<group>/<name>.tsx` |
| [[#page]] | Haiku 4.5 | $1/$5 | Page (Layout + slots) | `apps/<app>/src/pages/<route>/<name>.tsx` |
| [[#ui-component]] | Haiku 4.5 | $1/$5 | UI-kit компонент (CVA + createStyle) | `packages/ui/src/components/<name>/` (4 файла) |
| [[#controller]] | Sonnet 4.6 | $3/$15 | FSM-схема (states + handlers + next) | `apps/<app>/src/controllers/<group>/<name>.tsx` |
| [[#feature]] | Sonnet 4.6 | $3/$15 | Domain logic + API + navigation | `apps/<app>/src/features/<group>/<name>.tsx` |
| [[#docs-writer]] | Haiku 4.5 | $1/$5 | Два дока (AI-anchor + user-guide) по скелету | `docs/_meta/<slug>.md` + `docs/0X-…/<slug>.md` |

\* per Mtok input/output.

## Как они вызываются

Главный (Opus, я) оркеструет:

```
User: "сделай Entity LoginForm с email и password"
  ↓
Opus распознаёт layer → entity
  ↓
Agent(subagent_type='entity', prompt='LoginForm with email and password inputs + submit button')
  ↓
Haiku пишет файл по канон-шаблону
  ↓
Opus проверяет результат, докладывает пользователю
```

Можно вызывать **несколько параллельно** в одном сообщении (когда задачи независимые):

```
User: "сделай Entity LoginForm + Controller Auth + Page для /login"
  ↓
Opus спавнит 3 агента в одном tool-message:
  - Agent(subagent_type='entity', prompt='LoginForm...')
  - Agent(subagent_type='controller', prompt='Auth controller idle→submitting...')
  - Agent(subagent_type='page', prompt='Page /login wrapping Widget.Forms.Auth')
```

## Что **не** делегируется субагентам

| Тип задачи | Кто делает |
|---|---|
| Архитектурное решение, ADR | Opus (я) |
| Кросс-слойный рефакторинг | Opus |
| Правка фреймворковых пакетов (`@capsuletech/core`, `@capsuletech/state` и т.д.) | Opus |
| Code-review результата субагента | Opus |
| Многошаговая задача с зависимостями между слоями | Opus оркеструет, делегирует по частям |
| Чистая косметика (`console.log`-clean, переименование) | Opus напрямую — субагент тут оверкилл |

## Принципы дизайна агентов

1. **Канон в prompt'е, не в файлах кодбейзы.** Чем меньше агенту нужно читать — тем дешевле и быстрее. Шаблоны живут прямо в `.md`-файле агента.
2. **Минимум tools.** Никакого `Grep` (соблазн прошерстить весь репо), никакого `Agent` (агенты — листья, не оркестраторы), никакого `Bash` (не их работа).
3. **Один артефакт на вызов.** Агент пишет одну Entity / один Controller / один Widget. Если нужна цепочка — оркеструет Opus.
4. **Compliance-правила в каждом prompt'е.** Каждый агент знает свои «нельзя» (no upward imports, no fetch в Controller, и т.д.). Линтер ловит ошибки, но лучше их вообще не делать.
5. **Один уточняющий вопрос максимум.** Если запрос неясен — задать **один** focused-question, не пять. Все остальные шероховатости — лучше написать и переписать, чем спрашивать.

## Файлы

```
.claude/agents/
├── entity.md          # Haiku
├── widget.md          # Haiku
├── page.md            # Haiku
├── ui-component.md    # Haiku
├── controller.md      # Sonnet
├── feature.md         # Sonnet
└── docs-writer.md     # Haiku
```

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

> [!info]
> `.claude/agents/` сейчас локально у пользователя (не закоммичено). Чтобы команда могла использовать тех же агентов — нужно убрать `.claude/` из `.gitignore` (сейчас часть `.claude/` игнорится) и закоммитить `agents/` отдельно.

## Эволюция

- Когда выявится **новый повторяющийся паттерн** — заводим новый агент.
- Когда шаблон в агенте **устаревает** (например, изменили `IHandlerApi`) — правим .md-файл агента, не код. Это даёт «обновился один файл — все будущие генерации правильные».
- Когда **компиляторы FSM-схемы** в `@capsuletech/state/create.ts` обзаведутся `invoke` / `actors` / parallel — соответственно расширяем `controller.md` и `feature.md`.

## Связанное

- [[layers]] — формальное определение HCA-слоёв
- [[golden-rules]] — правила, которые агенты соблюдают
- [[compliance|@capsuletech/compliance]] — линтер, который ловит нарушения если агент ошибся
