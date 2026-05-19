# @capsuletech/cli

CLI для фреймворка [Capsule](../../README.md) — scaffold проектов, dev/build, git/nx/release-инструменты.

Один и тот же бинарь работает в **двух режимах**:

- **TUI** (без аргументов) — интерактивное меню на [ink](https://github.com/vadimdemedes/ink), команды фильтруются по контексту (workspace root / app / lib).
- **Commander** (с аргументами) — `capsule <subcmd>` для скриптов и CI.

## Установка

В workspace, созданный через `capsule create workspace`, CLI приходит как `workspace:*` зависимость, бинарь доступен через `pnpm capsule`.

Вне монорепы:

```bash
pnpm add -D @capsuletech/cli
pnpm capsule
```

## Quickstart

```bash
# Создать пустой workspace
mkdir my-app && cd my-app
npx @capsuletech/cli      # → меню → Create › Workspace

# Внутри workspace — добавить app
cd my-app
capsule                   # → меню → Create › App

# Внутри apps/<name> — dev-сервер
cd apps/my-app
capsule dev               # или: capsule (меню)
```

## Команды (commander)

```
capsule create workspace            # пустой Capsule-workspace
capsule create app <name>           # apps/<name> на capsule.app.ts шаблоне
capsule create lib <name>           # packages/<name> с vite-конфигом
capsule create page|entity|controller|feature|widget|shape <name>
                                    # новый файл слоя в текущем app

capsule dev                         # Vite dev-сервер (из apps/<name>)
capsule build                       # production-бандл (из apps/<name>)

capsule desktop dev [--url=...]     # Tauri shell поверх dev
capsule desktop build [--version=]  # MSI/NSIS-инсталлятор

capsule workspace info              # путь, версия, ветка, apps/packages

capsule git status|branches|switch|create|pull|push
capsule git sync|sync-main|pr|clean-merged|commit|log

capsule nx projects|affected|graph|report
capsule nx run <project:target>

capsule release plan                # dry-run бампа
capsule release                     # интерактивный мастер
capsule release tags                # последние 20 git-тегов

capsule --help                      # справка commander
```

Все эти команды также доступны в TUI — без флагов CLI открывает меню, и список пунктов меняется в зависимости от того, где ты находишься (`apps/X` → Dev/Build; в `workspace-root` → Create › App).

## Контексты

CLI автоматически определяет где ты:

| Контекст | Определение | Доступные категории |
|---|---|---|
| `no-workspace` | нет `nx.json` вверх по дереву | `Create › Workspace` |
| `workspace-root` | `nx.json` в текущей папке | Create app/lib, Git, Nx, Release, Navigate |
| `app` | `apps/<name>` | Dev, Build, Desktop, Create-слои, остальное |
| `lib` | `packages/<name>` | Git, Nx, Release, Navigate |
| `workspace-inner` | внутри workspace, но не в app/lib | Git, Nx, Release |

## Dev/Prod mode

CLI определяет режим автоматически:

- **dev** — внутри Capsule-монорепы (`packages/builders/vite/package.json` рядом → берётся живой TS через jiti).
- **prod** — опубликованная версия из npm.

Принудительно: `CAPSULE_MODE=development` или `CAPSULE_MODE=production`.

## Архитектура

Если хочешь добавить команду или понять как устроен CLI:

- [docs/08-system/cli.md](../../docs/08-system/cli.md) — архитектура, поток команда → action, добавление новой команды.
- [docs/_meta/cli.md](../../docs/_meta/cli.md) — AI-anchor: компактный референс контрактов и gotchas.
- [docs/08-system/git.md](../../docs/08-system/git.md) — git-флоу (`capsule git` команды).
- [docs/08-system/releases.md](../../docs/08-system/releases.md) — релизный флоу (`capsule release`).

## Лицензия

См. корень репозитория.
