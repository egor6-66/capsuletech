---
name: "@capsuletech/cli"
owner-agent: owner-cli
group: cli
status: pre-1.0
last-updated: 2026-05-20
---

# @capsuletech/cli

Бинарь `capsule` с двумя режимами: TUI на ink (без аргументов, scope-фильтр по контексту) и commander (с аргументами, CI-friendly). Оба читают один массив `staticCommands`.

## Зона ответственности

### Owns

- `packages/cli/src/` — полностью (commands, actions, kit, runner, context, templates, utils)
- `packages/cli/bin/capsule.mjs` — точка входа, dev/prod детект, диспатч commander vs TUI
- `packages/cli/bin/dev.mjs` — jiti-loader для dev, парсит `tsconfig.base.json → paths`
- `packages/cli/src/templates/app/` и `packages/cli/src/templates/workspace/` и `packages/cli/src/templates/lib/` — user-visible scaffold (one-time generation)
- `packages/cli/src/templates/layers.ts` — inline-шаблоны HCA-слоёв (page/widget/entity/controller/feature)
- `packages/cli/vite.config.mts` — externals, staticCopy `src/templates → dist/templates`
- `packages/cli/package.json` — exports, deps, bin field
- `packages/cli/e2e/` — smoke-сценарии (не `e2e/fixture/node_modules/`)

### Не трогает

- `packages/builders/vite/src/plugins/scaffold/` — runtime scaffold при dev/build (owner-builders)
- `packages/builders/vite/` вообще — owner-builders
- `packages/shared/` — owner-shared (shared-file-manager inlined в CLI как `src/utils/generateFromTemplates.ts`, зависимости больше нет)
- Root-level `package.json`, `tsconfig.base.json`, `nx.json` — главный assistant
- `apps/*/` — framework-developer / user scope
- `scripts/release-local.mjs` — главный assistant

## Публичный API

Package `exports` (из `package.json`, основной):

- `.` (main) — `dist/index.mjs` / `dist/index.d.ts`
  - `RunCli` — TUI-режим (без аргументов), запускает ink-меню с вкладками по categories
  - `program` — commander instance, для CI / прямого вызова с аргументами

Subpath exports через `src/cli/defines.ts`:

- `@capsuletech/cli/defines` — `defineCapsuleConfig`, `defineAppConfig` (no-op identity stubs для TS-идентификации в capsule.config.ts / capsule.app.ts)

Bin:

- `capsule` → `bin/capsule.mjs`

Список CLI-команд (categories):

| Category | Команды |
|---|---|
| `create` | `create workspace`, `create app`, `create lib`, `create page`, `create widget`, `create entity`, `create controller`, `create feature`, `create shape` |
| `dev` | `dev` (запуск dev-server через vite-builder) |
| `build` | `build` (сборка через vite-builder) |
| `desktop` | `desktop dev`, `desktop build` |
| `workspace` | `workspace info` |
| `git` | `git commit`, `git pr`, `git push`, `git pull`, `git branch`, `git checkout`, `git status`, `git log`, `git stash` |
| `release` | `release local`, `release prod` |
| `nx` | `nx graph`, `nx affected`, `nx run` |
| `navigation` | `open.app.<name>`, `open.root` (динамические, строятся по контексту) |

## Quirks / gotchas

1. **TUI vs commander dispatch в `bin/capsule.mjs:39-46`.** Если в `process.argv.slice(2)` есть хоть один positional (не начинается с `-`) или флаг `-h/--help/-V/--version` — идёт в commander. Иначе — TUI. Следствие: `capsule --version` работает, `capsule -v` нет (не зарегистрирован как short alias).

2. **`CAPSULE_CI=1` переключает на non-interactive.** `isCi()` в `src/cli/runner.ts:10-11` проверяет `CAPSULE_CI === '1'` или `CI === 'true'`. При `params === null` (обязательный param не заполнен) в CI-режиме делает `process.exit(1)` — см. `runner.ts:67`.

3. **`process.exit(1)` при ошибке action.** `runCommand` в `runner.ts:72-75` ловит любой throw и делает `process.exit(1)` после `kit.log.error`. В TUI-режиме цикл при этом не продолжается — процесс завершается.

4. **15+ команд содержат `kit.confirm`/`kit.select` без CI bypass.** Gap: `git commit`, `git pr`, `release local/prod`, `desktop dev/build`, `create *` с prompts — в CI-режиме зависнут на ink-промпте. Полный список — в audit (2026-05-20).

5. **Промпты — ink, не clack.** `kit.select/input/confirm` → `src/kit/prompts.tsx`. ink-меню и clack-промпт делят stdin в raw mode → после clack-промпта стрелки в ink перестают работать. Не заменять на `@clack/prompts`.

6. **Иконки — только RGI Emoji_Presentation, без VS16.** `string-width` врёт для default-text emoji (`🕸️ ▶️ ⬆️ 🎛️`). Добавляя иконку — проверять в emoji-data.txt поле `Emoji_Presentation=Yes`. Список разрешённых — `src/cli/tui/icons.ts`.

7. **Templates copy через staticCopyPlugin.** В prod `dist/templates/` копируется vite-builder плагином при сборке CLI (`vite.config.mts`). `resolveTemplateDir` в `src/utils/templates.ts` имеет fallback-цепочку: dev → `src/templates/<name>`, prod → `dist/templates/<name>`.

8. **Layer-шаблоны inline в `templates/layers.ts`, остальные — файл-деревом.** Не унифицировано. Правишь шаблон Entity/Controller/Feature/Widget/Page — лезь в `layers.ts`. Правишь структуру app/lib/workspace — `templates/<kind>/*.template`.

9. **`__dot__` prefix в template-именах** → `.` при материализации (`__dot__gitignore.template` → `.gitignore`). Обработка в `src/utils/generateFromTemplates.ts` (inlined из shared-file-manager после refactor `7f44f27`).

10. **`getViteEntry` требует dist vite-builder в dev.** Dev → `packages/builders/vite/dist/index.mjs` (dist, не src). Если vite-builder не собран — CLI упадёт. Решение: `pnpm --filter @capsuletech/vite-builder build`.

11. **`CAPSULE_MODE` env var переопределяет авто-детект** (`development`/`production`). Используется для тестирования prod-сценариев с dev-бинарём.

12. **jiti-кэш в `cvd.importModule` — `Map<cwd, jiti>`.** Один инстанс на workspace. Не сбрасывать — иначе esbuild инициализируется на каждый вызов.

13. **`bin/*.mjs` не в tsconfig.include.** JS без `checkJs`. Правки проверять вручную.

14. **TUI делает `detect()` на каждой итерации.** Navigation-команды работают через `process.chdir` — следующий `detect()` видит новый контекст. ctx не кэшировать снаружи.

15. **Workspace-internal apps (capsule monorepo сама)** используют `node ../../packages/cli/bin/capsule.mjs` — не hardcoded, это dev-quirk (см. memory `project_global_cli_stale`). Не переключать на `pnpm capsule` глобально.

16. **`gitCommit` action делает `git add -A`.** Закоммитит всё включая `.env`. Удобно по UX, опасно "по уму" — `src/actions/git.ts`.

19. **`devServer` exit — Vite runs in-process, holds event loop.** `createDevCapsuleServer` в vite-builder возвращает `Promise<void>` сразу после `server.listen()`, но HTTP-сервер держит event loop открытым. CLI регистрирует `SIGINT`/`SIGTERM` → `process.exit(0)` перед вызовом и снимает их в `finally`. `runTuiMenu` тоже вызывает `process.exit(0)` при выходе из цикла.

18. **`welcome.tsx.template` — Matrix slot object-form only (2026-05-21).** `@capsuletech/web-ui` breaking change: `SlotValue` теперь только `IResizableSlotConfig` (object form). JSX-shorthand `slots={{ main: <X /> }}` больше не работает. Шаблон обновлён на `slots={{ main: { children: <X /> } }}`.

17. **`desktop dev/build` action блокирующий.** `runDev`/`runBuild` из `@capsuletech/desktop` возвращают Promise, который resolved только при завершении tauri-процесса. CLI висит до выхода tauri — это ожидаемое поведение (пользователь видит stdout tauri напрямую через `stdio: 'inherit'`).

18. **`desktop` action читает capsule.config.ts через `importModule` (jiti).** Если `apps/<name>/capsule.config.ts` отсутствует или не резолвится — выводится понятная ошибка. Если секция `desktop` присутствует в config, но пакет `@capsuletech/desktop` не собран — `runDev`/`runBuild` упадут в runtime (не в import-time, т.к. desktop в externals CLI-бандла).

19. **`scripts/desktop.mjs` больше не используется CLI-ом** (начиная с PR 5 — ADR 017). Скрипт остаётся рабочим legacy-entry до PR 8 cleanup. CLI теперь импортирует `@capsuletech/desktop` напрямую.

## План рефакторинга / оптимизаций

- [ ] **CI bypass для всех команд с prompts** — `git commit`, `git pr`, `release local/prod`, `desktop dev/build`, `create *` с обязательными params. Проверять `isCi()` перед каждым `kit.select/confirm` и падать с понятным сообщением вместо зависания. (priority: high)
- [x] **`desktop dev/build` переписан на `@capsuletech/desktop` API** — убран `execa scripts/desktop.mjs`, action теперь импортирует `runDev`/`runBuild` напрямую. URL/version/dist опциональны, дефолты из `capsule.config.ts` и `package.json`. (PR 5 — ADR 017, 2026-05-23)
- [ ] **Унифицировать templates** — inline `layers.ts` vs файл-дерево `{app,lib,workspace}`. Обсудить: все inline или все файлы. (priority: low)
- [ ] **Subcommand drill-in в TUI** — сейчас плоский Detail-pane, нет вложенного меню. Расширение — переделать `src/cli/tui/App.tsx`. (priority: low)
- [ ] **`gitCommit` — confirm перед `git add -A`** или whitelist режим. (priority: medium)
- [ ] **`bin/*.mjs` под checkJs** — поймать typo раньше пользователя. (priority: low)
- [x] **Инлайн `generateFromTemplates`** — убрана зависимость от `@capsuletech/shared-file-manager`, логика в `src/utils/generateFromTemplates.ts` (2026-05-19, `7f44f27`).
- [x] **`CAPSULE_CI=1` + `process.exit(1)` в runner** — добавлены `isCi()` + exit в `runner.ts` (2026-05-20, `dee956c`).
- [x] **Peer deps sweep** — CLI templates восстановлены корректно (`@tanstack/solid-router`, `xstate`, `@xstate/solid`) — PRs #91/#92/#93.
- [x] **Orphan process fix** — `devServer` регистрирует `SIGINT`/`SIGTERM` → `process.exit(0)` пока Vite держит event loop; `runTuiMenu` вызывает `process.exit(0)` при выходе; `nxGraph`/`desktopDev/Build` используют `cleanup: true` в execa (2026-05-22).

## Test coverage

| Тип | Где | Что покрывает |
|---|---|---|
| Unit | `src/cli/__tests__/runner.test.ts` | `isCi()` — CAPSULE_CI, CI env vars |
| E2E | `e2e/smoke.mjs` | self-contained scenarios (create-workspace, dev smoke) |

Перед изменением runner.ts / resolveParams — unit tests должны быть green:

```bash
pnpm --filter @capsuletech/cli test
```

Перед release:

```bash
node packages/cli/e2e/smoke.mjs
node packages/cli/bin/capsule.mjs --help
node packages/cli/bin/capsule.mjs workspace info
```

## Cross-package dependencies

| Зона | Owner |
|---|---|
| `@capsuletech/vite-builder` — `createDevCapsuleServer`, `buildCapsuleApp` | owner-builders |
| `@capsuletech/vite-builder` — scaffold-plugin (runtime) | owner-builders |
| `@capsuletech/vite-builder` — `ICapsuleConfig` type (incl. `desktop?` section) | owner-builders |
| `@capsuletech/desktop` — `runDev`, `runBuild`, `RunDevOptions`, `RunBuildOptions` | owner-desktop |
| `@capsuletech/compliance` — peer dep в release-group | owner-builders |
| `@capsuletech/lib-builder` — peer dep в release-group | owner-builders |
| Template `__dot__` prefix convention | owner-shared (было shared-file-manager, сейчас inlined) |
| Root `tsconfig.base.json` — aliases для jiti в `bin/dev.mjs` | главный assistant |
| `apps/*/capsule.config.ts` — читается через `importModule` | framework-developer scope |

## Release group

`cli` (fixed versioning, tag `cli@{version}`):
- `@capsuletech/cli` (this package)
- `@capsuletech/compliance`
- `@capsuletech/lib-builder`
- `@capsuletech/shared-file-manager`
- `@capsuletech/vite-builder`

Все пять релизятся одной версией. Bump координируется через главного:

```bash
pnpm release:local:cli   # Verdaccio publish
```

При breaking change в vite-builder API — согласовать с owner-builders перед release.
