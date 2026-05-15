---
tags: [system, git, workflow]
status: documented
type: guide
---

# 🌿 Git workflow

> [!info]
> Capsule использует **GitHub Flow** — одна long-lived ветка `main` (всегда деплоится), всё остальное живёт в коротких feat/fix-ветках. Релизы через nx release, теги вида `cli@x.y.z` и `web@x.y.z`. Подробнее про релизы — [[releases]].

## Картинка флоу

```
main ──●──●──●──●──●──●──●──→  (всегда зелёная)
        \          \
   feat/cli/auth   feat/web/query
   (1-3 дня)       (1-3 дня)
```

Правила:
- `main` защищена, push только через PR.
- Ветка живёт **максимум 2-3 дня**. Долго живёт → расходится с main → конфликты.
- Коммиты в [Conventional Commits](https://www.conventionalcommits.org/) — на их основе nx release бампит версии и собирает CHANGELOG.

## Daily workflow

### Старт фичи

```bash
# 1. Убедись что на main и подтяни свежак
capsule git switch       # выбрать main
capsule git pull         # или sync-main если ты на feat

# 2. Создай feat-ветку
capsule git create       # выбрать type/scope/slug интерактивно
# → feat/cli/auth-redirect
```

### Работа

```bash
# Закоммитить (мастер Conventional Commits)
capsule git commit

# Или с готовым месседжем:
capsule git commit "feat(cli): add release plan command"

# Если main ушёл вперёд и ты хочешь подтянуть свежак к себе:
capsule git sync-main    # rebase origin/main → твоя ветка
```

### Открыть PR

```bash
capsule git pr           # push + открыть Create-PR на GitHub
                         # (или gh pr create если установлен)
```

### После merge PR

```bash
capsule git switch       # обратно на main
capsule git pull         # подтянуть свеже-смерженное

capsule git clean-merged # удалить локальные ветки, уже в main
```

## Команды CLI

Все живут под `capsule git <name>`:

| Команда | Что делает |
|---|---|
| `git status` | Текущая ветка + `git status --short` |
| `git branches` | Список локальных веток. В app/lib фильтр по scope |
| `git switch` | Переключиться на ветку (scope-ветки сверху) |
| `git create` | Создать `<type>/<scope>/<slug>` интерактивно |
| `git commit [msg]` | Conventional Commits мастер. С `msg` — без интерактива |
| `git pull` | `git pull --ff-only` текущей ветки |
| `git push` | `git push`, при первом — авто `--set-upstream` |
| `git sync` | `fetch --all --prune` + обзор ahead/behind по всем веткам |
| `git sync-main` | `fetch + rebase origin/main` в текущую feat-ветку |
| `git pr` | Push + открыть Create-PR (или `gh pr create`) |
| `git clean-merged` | Удалить локальные ветки, уже смерженные в main |
| `git log` | Последние 20 коммитов (graph, all, decorate) |

## Имена веток

Схема: `<type>/<scope>/<slug>`. Без slug — `<type>/<scope>`.

| Type | Когда |
|---|---|
| `feat` | новая фича |
| `fix` | багфикс |
| `dev` | долгоживущая dev-ветка пакета (редко) |
| `chore` | cleanup / housekeeping |
| `refactor` | рефакторинг без поведенческих изменений |
| `docs` | документация |
| `test` | тесты |

`scope` — имя пакета или приложения: `cli`, `web-core`, `agent`, `sandbox`. `capsule git create` подсказывает доступные из `apps/` и `packages/`.

Примеры:
- `feat/cli/release-plan`
- `fix/web-core/proxy-cleanup`
- `chore/agent/deps-bump`

## Conventional Commits

Схема: `type(scope): subject`.

| Type | Эффект на версию |
|---|---|
| `feat` | minor (1.2.3 → 1.3.0) |
| `fix` | patch (1.2.3 → 1.2.4) |
| `refactor`, `perf`, `docs`, `style`, `test`, `build`, `ci`, `chore` | без бампа |
| любой с `!` или `BREAKING CHANGE:` в теле | major (1.2.3 → 2.0.0) |

`capsule git commit` сам собирает правильный формат — пиши только subject в повелительном наклонении («add», «fix», «remove»).

## Релизы

См. [[releases]]. Шорткат:

```bash
capsule release plan     # dry-run: что бампнется, БЕЗ изменений
capsule release          # интерактивный мастер: группа → бамп → режим
capsule release tags     # последние 20 git-тегов
```

## Типовые проблемы

### «Я сделал коммит не в ту ветку»

```bash
git log --oneline -n 1            # запомни хэш коммита
git reset --hard HEAD~1           # откатить ТЕКУЩУЮ ветку на 1 коммит назад
capsule git switch                # на нужную ветку
git cherry-pick <hash>            # принести коммит сюда
```

### «Закоммитил .env / секрет»

Если **ещё не пушил** — переписать историю можно:

```bash
git rm --cached .env
echo .env >> .gitignore
git commit --amend --no-edit
```

Если **уже пушил** — поздно, ключ утёк. **Ротируй** секрет в сервисе (OpenAI/Anthropic/etc), затем чисти историю через `git filter-repo` или wipe репо.

### «Ветка отстала от main, мерж не лезет / много конфликтов»

```bash
capsule git sync-main             # rebase origin/main → твоя feat

# Если конфликты — git добавит маркеры <<<<<<< в файлы.
# Открой эти файлы, выбери правильную версию, удали маркеры.
git add <исправленные файлы>
git rebase --continue

# Если запутался:
git rebase --abort                # вернуть как было до rebase
```

### «Удалил ветку, а там был неслитый коммит»

```bash
git reflog                        # увидеть все HEAD за последние дни
# найди строку вида: bb31b8a HEAD@{15}: commit: ...
git switch -c recovered bb31b8a   # восстановить ветку из reflog
```

### «Случайно сделал force-push»

```bash
git reflog                        # на удалённой стороне reflog нет, но локально — да
# найди прошлый коммит main, force-push обратно:
git push --force origin <old-hash>:main
```

### «Слишком много веток развелось»

```bash
capsule git clean-merged          # удалит смерженные в main
git branch | grep -v main         # увидеть остальное, прибить вручную через git branch -D
```

## Что НЕ делать

- ❌ Прямой `git push origin main` — main защищена, ходи через PR.
- ❌ `git push --force` в общую ветку без согласования. На своих feat можно.
- ❌ Долгоживущие ветки. Если фича > 3 дней — раздроби или мержь поэтапно.
- ❌ Коммитить `.env`, ключи, `node_modules`, `dist`. `.gitignore` это покрывает, но проверяй diff.
- ❌ Большие PR с разной тематикой. Один PR = одна логически связная вещь.

## Ссылки

- [[releases]] — релизный флоу через nx release
- [[cli]] — общая дока CLI
- [Conventional Commits](https://www.conventionalcommits.org/)
- [GitHub Flow](https://docs.github.com/en/get-started/quickstart/github-flow)
