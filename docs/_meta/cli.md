---
tags: [meta, cli, ai-context]
status: documented
type: ai-anchor
audience: claude
---

# 🤖 CLI — AI context anchor

> [!ai]
> Шпаргалка для Claude-инстансов. Юзеру читать не обязательно — для них [[cli|cli.md]] и [packages/cli/README.md](../../packages/cli/README.md).

## TL;DR

`@capsuletech/cli` — бинарь `capsule` с двумя режимами: **TUI на ink** (без аргументов, scope-фильтр по контексту) и **commander** (с аргументами, CI-friendly). Оба читают один массив `staticCommands` ([src/commands/index.ts](../../packages/cli/src/commands/index.ts)). Контракт `Command` → action в `src/actions/`. Контекст определяется по `nx.json` вверх по дереву. Mode (dev/prod) auto-detect по наличию `packages/builders/vite/`.

## Где что лежит

| Файл/папка | Что |
|---|---|
| `bin/capsule.mjs` | Точка входа. Dev/prod детект, диспатч commander vs TUI |
| `bin/dev.mjs` | jiti-loader для dev. Парсит `tsconfig.base.json → paths` в alias-мапу |
| `src/index.ts` | `export { RunCli, program }` — публичный API пакета |
| `src/cli/index.ts` | `program = buildProgram()`, `RunCli = runTuiMenu` |
| `src/cli/program.ts` | tree builder: точечный id → вложенные commander-команды |
| `src/cli/runner.ts` | `runCommand` + `resolveParams` — общий путь для TUI и commander |
| `src/cli/defines.ts` | глобалы `defineCapsuleConfig`/`defineAppConfig` (no-op stubs для TS) |
| `src/cli/tui/` | ink-компоненты: App, CommandList, Detail, Header, Footer + icons/theme |
| `src/commands/types.ts` | `Command`, `CommandParam`, `Scope`, `Category` — **единый контракт** |
| `src/commands/index.ts` | `staticCommands` (плоский массив), `collectCommands` (+ navigation для TUI) |
| `src/commands/<category>.ts` | декларации команд по категориям |
| `src/context/detect.ts` | walks up по `nx.json`, mode = dev/prod детект |
| `src/kit/index.ts` | barrel: `kit = { ...ui, ...shell, printTable, chalk }` |
| `src/kit/prompts.tsx` | **ink-based** select/input/confirm (НЕ clack — см. грабли) |
| `src/kit/ui.ts` | clack-based note/log/spinner/intro/outro + обёртки ink-промптов |
| `src/kit/shell.ts` | `kit.task` — spinner вокруг execa |
| `src/actions/*.ts` | реализации `CommandAction` — на каждую `command.action` свой файл |
| `src/actions/_scaffold.ts` | `scaffoldEntity` — общая логика для create-workspace/app/lib |
| `src/templates/layers.ts` | inline-шаблоны слоёв (page/entity/...) — TS-строки |
| `src/templates/{workspace,app,lib}/` | файл-деревья для `create-workspace/app/lib` |
| `src/utils/cvd.ts` | `importModule(specifier, cwd)` — jiti-кэш per-cwd для TS-конфигов |
| `src/utils/templates.ts` | `resolveTemplateDir` — fallback dev (`src/templates`) vs prod (`dist/templates`) |
| `src/utils/vite-entry.ts` | `getViteEntry` — где брать `@capsuletech/vite-builder` |
| `vite.config.mts` | externals: react, ink, yoga, string-width и проч.; staticCopy `src/templates`→`dist/templates` |

## Контракт Command

```ts
interface Command {
  id: string;              // 'create.app' → 'capsule create app'; точки = иерархия
  label: string;           // строка в TUI list
  description: string;     // правая панель TUI / commander --help
  scope: Scope[];          // фильтр по ctx, '*' = всегда
  category: Category;      // вкладка в TUI
  params?: CommandParam[]; // позиционные args / prompts
  staticParams?: Record<string, unknown>; // зашитые kw-аргументы (одна action — N команд)
  action: (ctx: CliContext, params: Record<string, unknown>) => Promise<unknown>;
}
```

## Scopes (ctx-фильтр)

| Scope | Когда |
|---|---|
| `no-workspace` | нет `nx.json` вверх по дереву |
| `workspace-root` | в корне (`nx.json` рядом) |
| `app` | под `apps/<name>/` |
| `lib` | под `packages/<name>/` |
| `workspace-inner` | внутри workspace, но не app/lib |
| `*` | всегда |

## Categories (вкладки TUI)

`create | dev | workspace | git | release | nx | navigation` — порядок и иконки в `CATEGORY_META` ([commands/index.ts](../../packages/cli/src/commands/index.ts)).

## Kit API

```
kit.intro(title) / kit.outro(msg)            ← clack
kit.note(msg, title)                         ← clack
kit.log.{info|warn|error|success}            ← clack
kit.spinner()                                ← clack (используется в kit.task)
kit.select<T>(msg, options)                  ← ink (НЕ clack)
kit.input(msg, placeholder?, validate?)      ← ink
kit.confirm(msg)                             ← ink
kit.task(title, action|cmd, args?)           ← execa + clack spinner
kit.printTable(rows)                         ← console-table-printer
kit.chalk                                    ← chalk re-export
```

Если нажат esc/ctrl+c в ink-промпте → `kit.ui.cancel()` → `process.exit(0)`. **Action не получит null** — он просто не выполнится.

## Известные грабли

1. **Иконки = только RGI Emoji_Presentation, без VS16.** `string-width` для default-text эмодзи (`🕸️ ▶️ ⬆️ 🎛️`) врёт, разделители в TUI едут. См. `cli/tui/icons.ts` комментарий — список разрешённых там же. При добавлении новой иконки **проверять в [emoji-data.txt](https://unicode.org/Public/emoji/15.0/emoji-data.txt) поле `Emoji_Presentation=Yes`**.

2. **Промпты — ink, не clack.** ink-меню и clack-промпт делят stdin в raw mode → после clack-промпта стрелки в ink перестают переключать. Свои `inkSelect/inkInput/inkConfirm` в `kit/prompts.tsx`. Не пытайся заменить на `@clack/prompts`.

3. **jiti-кэш в `cvd.importModule` — `Map<cwd, jiti>`.** Один инстанс на каждый workspace, иначе esbuild инициализируется при каждом `importModule` (тормоза). Не сбрасывай кэш — он живёт на процесс.

4. **`CAPSULE_MODE` env var переопределяет авто-детект.** `development` / `production`. Используется когда нужно прогнать dev-CLI в "prod"-сценарии (e.g. тест scaffold-templates с `latest` deps).

5. **Layer-шаблоны inline в `templates/layers.ts`, остальные — файл-деревом.** Не унифицировано исторически. Если правишь шаблон Entity/Controller/etc. — лезь в layers.ts, не в `templates/<layer>/`.

6. **Префикс `__dot__` в template-именах** → `.` при материализации (`__dot__gitignore.template` → `.gitignore`). Иначе pnpm publish либо ignore-rules матерятся. Обработка — в `@capsuletech/shared-file-manager.generateFromTemplates`.

7. **`resolveTemplateDir` fallback-цепочка.** Dev: `src/actions/` → `../templates/<name>`. Prod (vite-bundle): `dist/index.mjs` → `templates/<name>`. Все шаблоны в prod копируются `staticCopyPlugin` из vite-builder — см. [vite.config.mts](../../packages/cli/vite.config.mts).

8. **`bin/dev.mjs` парсит `tsconfig.base.json`** строкой через regex (с удалением `//` и `/* */`-комментариев). Хрупко, но работает; fallback на `paths.config.json` есть, но в текущих шаблонах его нет.

9. **TUI делает `detect()` каждую итерацию цикла.** Поэтому navigation-команды (`open.app.X`, `open.root`) работают через `process.chdir` — следующий `detect()` видит новый контекст. Не пытайся кэшировать `ctx` снаружи.

10. **`gitCommit` (action) делает `git add -A`.** Закоммитит всё, включая случайные `.env`. По UX это удобно для small-edit, но если коммитишь "по уму" — обходи через сырой `git`. См. [actions/git.ts:371](../../packages/cli/src/actions/git.ts).

11. **`getViteEntry` dev vs prod.** Dev → `<root>/packages/builders/vite/dist/index.mjs` (важно: **`dist/`** — не сорец, требуется хотя бы один build vite-builder'а перед запуском CLI). Prod → `require.resolve('@capsuletech/vite-builder')`. Если dev-сборка vite-builder пропала — CLI упадёт `shared-vite не экспортирует createDevCapsuleServer`. Решение: `pnpm --filter @capsuletech/vite-builder build`.

12. **Action не должен бросать без обработки** — `runCommand` ловит `err` и пишет через `kit.log.error`, но это **последний ров обороны**. В TUI после exception action завершается, цикл продолжает работать. Не полагайся на throw как на flow-control.

13. **`commander.exitOverride`** в `buildProgram` — суппрессит `commander.helpDisplayed/help`, но всё остальное логирует и `process.exit(err.exitCode ?? 1)`. Поэтому неожиданный exit при кривых аргументах = это commander, а не наша логика.

14. **`@nx/devkit` и `ts-morph` уехали из CLI deps** (раньше были workaround). `@nx/devkit` теперь в `vite-builder` + `shared-file-manager`, `ts-morph` фактически нигде не используется. Не возвращай в CLI.

15. **`solid-js` peerDep удалён** — CLI на React (ink). Если кто-то полезет добавлять обратно — спросить зачем.

16. **`bin/*.mjs` не в tsconfig.include.** JS-файлы без `checkJs`. Если правишь — проверяй вручную, ошибок никто не поймает.

## Как добавить команду (минимум шагов)

1. `src/actions/<thing>.ts` → экспорт `CommandAction`.
2. Зарегистрировать в `src/actions/index.ts`.
3. `src/commands/<category>.ts` → объект `Command` с `id`, `label`, `description`, `scope`, `category`, `action`.
4. Подключить массив в `staticCommands` ([commands/index.ts](../../packages/cli/src/commands/index.ts)).
5. (опц.) иконка в `cli/tui/icons.ts` — **только RGI emoji**.

В dev jiti подхватит сразу. В prod — `pnpm --filter @capsuletech/cli build`.

## Что менять когда

| Хочу… | Куда лезть |
|---|---|
| Новую category в TUI | `src/commands/types.ts` (Category type) + `CATEGORY_META` в `commands/index.ts` |
| Новый scope (например `desktop-shell`) | `src/context/types.ts` (CtxType) + ветка в `context/detect.ts` |
| Изменить порядок tabs в TUI | `CATEGORY_META.<name>.order` |
| Поменять колоры | `cli/tui/theme.ts` |
| Шаблон нового слоя | inline в `templates/layers.ts` |
| Шаблон файл-дерева (app/lib/workspace) | `templates/<kind>/*.template` |
| Подменю команд внутри TUI | сейчас плоский — Detail-pane без drill-in. Расширение — переделать `App.tsx` |
| Новая прокладка над external tool (gh, docker, …) | `actions/<tool>.ts` через `execa`, никаких прямых child-process |

## Тестирование локально

```bash
# Без сборки (jiti grabs src/):
node packages/cli/bin/capsule.mjs <subcmd>

# Со сборкой:
pnpm --filter @capsuletech/cli build
# теперь dist/ свежий, prod-сценарий валидируется

# Smoke:
node packages/cli/bin/capsule.mjs --help
node packages/cli/bin/capsule.mjs workspace info
```

В TUI-режиме (без аргументов) — потребуется TTY. JetBrains-консоль обманывается через `JETBRAINS_IDE` env-флаг в `bin/capsule.mjs`.

## Cross-links

- User-doc для людей: [[08-system/cli|docs/08-system/cli.md]]
- README пакета: [packages/cli/README.md](../../packages/cli/README.md)
- Git-команды: [[08-system/git|docs/08-system/git.md]] + AI-anchor [[_meta/releases|releases.md]]
- Vite-плагины (что dev/build вызывают): [[vite-plugins]]
- HCA-слои (что create-layer создаёт): [[layers]]
- Workspace-templates: см. `templates/workspace/`, `templates/app/`, `templates/lib/` — что туда попадёт, видно в [templates/index.ts](../../packages/cli/src/templates/index.ts)
