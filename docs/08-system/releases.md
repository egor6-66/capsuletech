---
tags: [system, releases]
status: documented
type: guide
---

# 📦 Releases

> [!info]
> Релизы Capsule управляются **Nx Release**. Версии бьются по conventional-commits, теги ставятся в git, публикация — в npm / verdaccio / nexus на выбор. Все команды — pnpm-скрипты в корне.

## Концепция

Пакеты разбиты на **группы**. Группа — это набор пакетов, которые релизятся вместе одной командой.

| Группа | Тип | Пакеты | Тег |
|---|---|---|---|
| `cli` | independent | `@capsuletech/cli` | `cli@x.y.z` |
| `web_base` | fixed | `core`, `router`, `ui`, `vite`, `style`, `file-manager`, `profiler` | `web@x.y.z` |

- **independent** — у каждого пакета своя версия.
- **fixed** — все пакеты группы делят одну версию. Любой conventional-commit в любой из них бампает всю группу.

Почему `web_base` fixed: `@capsuletech/core` re-export'ит router/ui/vite/etc. Если обновить только router, core останется на старом — потребитель получит рассинхрон. Fixed гарантирует, что весь "веб-стек" Capsule всегда совпадает по версиям.

## Команды

Все скрипты в корневом `package.json`. Шаблон: `release:<группа>:<registry>`.

```bash
# Dry-run (только посмотреть, что будет — без коммита и публикации)
pnpm release:cli              # → verdaccio
pnpm release:web              # → verdaccio

# Реальный релиз: версия + changelog + git commit + tag + publish
pnpm release:cli:verdaccio
pnpm release:cli:npm
pnpm release:cli:nexus

pnpm release:web:verdaccio
pnpm release:web:npm
pnpm release:web:nexus

# Сразу обе группы (cli + web_base)
pnpm release:all:verdaccio
pnpm release:all:npm
pnpm release:all:nexus
```

### Первый релиз

В пустой репе ещё нет git-тегов — Nx не сможет вычислить baseline. Один раз:

```bash
pnpm release:cli:verdaccio -- --first-release
pnpm release:web:verdaccio -- --first-release
```

После этого Nx найдёт свой первый тег и дальше работает автоматом.

### Доп. флаги

После `--` можно передавать любые флаги Nx:

```bash
pnpm release:web:nexus -- --dry-run            # сухой прогон даже у "реальной" команды
pnpm release:cli:npm -- --first-release        # форс на чистой репе
pnpm release:web -- minor                      # фиксированный бамп вместо conventional-commits
```

## Conventional commits — как влияют на версию

Nx Release читает коммиты с момента последнего тега и решает, какой бамп нужен.

| Коммит | Бамп |
|---|---|
| `fix(router): ...` | patch |
| `feat(router): ...` | minor |
| `feat(router)!: ...` или `BREAKING CHANGE` в теле | major |
| `chore: ...`, `docs: ...`, `refactor: ...` | без бампа |

В fixed-группе `scope` не обязан совпадать с конкретным пакетом — важен ЛЮБОЙ feat/fix внутри проектов группы. В independent-группе scope определяет, какой проект бампается.

## Registry — куда публикуем

| Алиас | Источник URL | Когда |
|---|---|---|
| `npm` | `NPM_REGISTRY_NPM` или `https://registry.npmjs.org` | Public-релиз |
| `verdaccio` | `NPM_REGISTRY_VERDACCIO` или `http://localhost:4873` | Локальное тестирование |
| `nexus` | `NEXUS_REGISTRY` (обязательно) | Корпоративный реестр |

Можно подсунуть произвольный URL: `node scripts/release.mjs --group=cli --registry=https://my-registry.example.com`.

## Креды (env-переменные)

Helper читает env и пишет временный `.npmrc` (cleanup'ит после публикации).

**Nexus:**
```bash
# Вариант A — bearer-token (рекомендуется)
$env:NEXUS_REGISTRY = "https://nexus.company.com/repository/npm-private/"
$env:NEXUS_TOKEN = "NpmToken.abcdef123456..."
pnpm release:web:nexus

# Вариант B — basic _auth (логин/пароль)
$env:NEXUS_REGISTRY = "https://nexus.company.com/repository/npm-private/"
$env:NEXUS_USERNAME = "ci-user"
$env:NEXUS_PASSWORD = "secret"
pnpm release:web:nexus
```

**npm public:**
```bash
$env:NPM_TOKEN = "npm_xxxxxxxxxxxx"   # опционально, для авторизованного publish
pnpm release:web:npm
```

**Verdaccio:** обычно anonymous, ничего ставить не надо. Если verdaccio с авторизацией — добавь в `.npmrc` руками.

> [!warning]
> Никогда не коммить креды. Все переменные ставь либо в shell-сессии, либо в `.env.local` (он в `.gitignore`). Helper всегда восстанавливает `.npmrc` после публикации, но при `kill -9` процесса креды могут остаться в файле — проверь.

## Что происходит за кулисами

```
pnpm release:web:nexus
  └─→ node scripts/release.mjs --group=web_base --registry=nexus
        ├─→ pnpm nx release --group web_base --skip-publish
        │     ├─ preVersionCommand: nx run-many -t build -p <7 пакетов>
        │     ├─ bump версии в package.json всех 7 пакетов (одинаково, fixed)
        │     ├─ переписать workspace:* → "1.2.3" в зависимостях
        │     ├─ сгенерить CHANGELOG.md в каждом пакете
        │     └─ git commit + git tag web@1.2.3 (push: false)
        │
        ├─→ inject NEXUS_TOKEN в .npmrc
        ├─→ pnpm nx release publish --group web_base --registry=$NEXUS_REGISTRY
        └─→ восстановить .npmrc
```

После этого:
- Локально 7 package.json уже с новой версией и без `workspace:*`.
- В git — коммит `chore(release): publish 1.2.3` + тег `web@1.2.3`.
- В nexus — 7 опубликованных tarballs.
- **Push в origin вручную:** `git push && git push --tags` (`release.git.push: false` в `nx.json`).

## Добавить новую группу

В `nx.json` → `release.groups`:

```json
"node_server": {
  "projects": ["@capsuletech/server", "@capsuletech/server-_auth"],
  "projectsRelationship": "independent",
  "releaseTagPattern": "node@{version}",
  "version": {
    "conventionalCommits": true,
    "preVersionCommand": "pnpm nx run-many -t build -p @capsuletech/server,@capsuletech/server-_auth"
  },
  "changelog": { "projectChangelogs": true }
}
```

И скрипты в `package.json`:

```json
"release:node": "node scripts/release.mjs --group=node_server --registry=verdaccio --dry-run",
"release:node:verdaccio": "node scripts/release.mjs --group=node_server --registry=verdaccio",
"release:node:nexus": "node scripts/release.mjs --group=node_server --registry=nexus"
```

## Troubleshooting

**`No git tags matching pattern`** — нет baseline-тега. Запусти с `--first-release`.

**`Unknown argument: registry`** — забыл, что `--registry` принимает только `nx release publish`. Helper это знает — гоняй через pnpm-скрипты, не напрямую `nx release`.

**`does not have a package.json file available in dist\packages\<name>\`** — у Capsule `dist/` лежит **внутри** каждого пакета, а Nx по дефолту ищет publishable artifact в `dist/<projectRoot>/`. Чинится через `targetDefaults["nx-release-publish"].options.packageRoot = "{projectRoot}"` в `nx.json` (уже стоит). Если воспроизводится — проверь что эта секция не уехала.

**`task graph has a circular dependency`** на pre-version build — Nx видит ложный цикл `@capsuletech/vite-builder ↔ @capsuletech/compliance` (vite использует compliance в runtime, compliance использует vite в devDeps для собственной сборки). Решение: `preVersionCommand` в `nx.json` использует `pnpm --filter ... build`, а не `nx run-many` — pnpm сортирует только по runtime-deps и цикла не видит.

**`401 Unauthorized`** — креды не подхватились. Проверь:
- `cat .npmrc` (после падения, до cleanup'а — креды должны быть там)
- env-переменные в текущей сессии (`$env:NEXUS_TOKEN`)
- URL в `NEXUS_REGISTRY` заканчивается на `/` (важно — npm маппит auth-ключ по path)

**Версии не бампаются** — проверь conventional-commits. `chore: ...` не бьёт бамп; нужен `feat:` или `fix:`. Или передай специфаер: `pnpm release:web -- minor`.

**`You cannot publish over the previously published versions: 0.0.1`** — версия в package.json совпадает с уже опубликованной. conventional-commits не нашёл бампающих коммитов. Передай явный specifier: `pnpm release:local -- patch` (или `minor`/`major`). Альтернатива — сделать коммит с conventional-prefix (`fix:` / `feat:`).

**`--first-release` сломал последующие релизы** — этот флаг для САМОГО первого релиза (когда нет git-tag). Постоянно держать его в `package.json` скриптах нельзя — Nx тогда игнорит существующие теги. Используй ad-hoc: `pnpm release:local -- --first-release`.

**Хочу откатить релиз** — `git reset --hard HEAD~1 && git tag -d web@x.y.z`. В registry удалять отдельно (`npm unpublish` — только в первые 72 часа на npmjs).

## Связанное

- [[cli|@capsuletech/cli]] — отдельная независимая группа, релизится своей командой.
- [[vite-plugins]] — vite-плагины из `@capsuletech/vite-builder` ходят в составе web_base.
- Старый `scripts/publish.mjs` (без git-тегов, snapshot-versioning) остался для быстрой публикации в локальный verdaccio во время разработки — не путать с `release:*:verdaccio`.
