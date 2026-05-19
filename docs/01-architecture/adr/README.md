---
tags: [hca, architecture, adr, moc]
status: index
---

# 🧠 ADR — Architecture Decision Records

Здесь живут архитектурные решения. Каждое — отдельный файл с числовым префиксом.

## Реестр

| № | Решение | Status | Дата |
|---|---|---|---|
| [[001-xstate-as-canonical-fsm\|001]] | XState как канонический FSM-движок (custom runtime — удалить) | 🛠️ implemented | 2026-05-09 |
| [[002-controller-vs-feature\|002]] | Controller vs Feature — органическая дивергенция | 🛠️ implemented | 2026-05-09 |
| [[003-router-context-based\|003]] | Роутер: Context-based вместо singleton | 🛠️ implemented | 2026-05-10 |
| [[004-compliance-linter\|004]] | Линтер для compliance (No Upward / No Horizontal) | 🛠️ implemented | 2026-05-10 |
| [[005-tag-aliases-registry\|005]] | Реестр тег-алиасов (`@inputs → email,password,...`) — раскрытие на стороне запроса | 🛠️ implemented | 2026-05-10 |
| 006 | A11y / focus management: на каком слое | ⏳ open | — |
| [[007-uiproxy-cleanup\|007]] | Cleanup в `UiProxy.registerComponent` (`createUniqueId` + `onCleanup`) | 🛠️ implemented | 2026-05-09 |
| [[008-hybrid-fsm-api\|008]] | Гибридная FSM-схема: XState локально, `next()` отдельно | 🛠️ implemented | 2026-05-10 |
| [[009-event-interception-extension\|009]] | Расширение перехватов UI-событий (onChange, onBlur, onFocus, onKeyDown) | 🛠️ implemented (без onSubmit) | 2026-05-10 |
| 010 | Политика регистрации компонентов: own-meta opt-in (политика C) | 🛠️ implemented | 2026-05-10 |
| 011 | Деривация `name` из `meta.tags` (`name` под капотом) | 🛠️ implemented | 2026-05-10 |
| 012 | Дедупликация UI-событий через event-marker (anti-bubbling) | 🛠️ implemented | 2026-05-10 |
| [[013-explicit-define-app-config\|013]] | `defineAppConfig` через explicit import (закрывает S-8) | 🛠️ implemented | 2026-05-18 |
| [[014-router-api-extension\|014]] | Router: `goTo` options-объект + generic `ICapsuleRouterContext` | 🛠️ implemented | 2026-05-18 |
| [[015-remote-modules\|015]] | Remote modules: своё runtime, pluggable transport, manifest-driven | 📝 proposed | 2026-05-19 |

> [!info]
> Status:
> - 📝 **proposed** — обсуждается, ещё не принято
> - ✅ **accepted** — принято, ждёт имплементации
> - 🛠️ **implemented** — реализовано в коде
> - ❌ **rejected** — рассмотрено и отклонено
> - 🗑️ **deprecated** — отменено более новым ADR
> - 🔄 **superseded by NNN** — заменено NNN

## Шаблон

```markdown
---
tags: [hca, adr]
status: proposed | accepted | rejected | deprecated | superseded
date: YYYY-MM-DD
---

# ADR NNN — Заголовок решения

## Контекст
Что заставило принять решение. Какие силы действуют.

## Решение
Что мы решили.

## Альтернативы
Что рассматривали и почему отвергли.

## Последствия
Положительные и отрицательные следствия.

## Связанное
- [[...]]
```
