---
tags: [hca, system, cli]
status: documented
type: guide
---

# 💻 CLI

> [!info]
> **Пакет:** `@capsuletech/cli` (`packages/cli`)
> **Бинарь:** `packages/cli/bin/capsule.mjs`
> **Что умеет:** scaffold workspace/app/lib/слоёв, dev/build, desktop (Tauri), git/nx/release-команды. Один бинарь — два режима: TUI (ink) без аргументов и commander с ними.

## Два режима

```
capsule                  → TUI меню (ink). Команды фильтруются по контексту.
capsule <subcmd> [args]  → commander, без интерактива (CI-friendly).
capsule --help           → справка commander.
```

Обе ветки **читают один и тот же массив `staticCommands`** ([src/commands/index.ts](../../packages/cli/src/commands/index.ts)). Команда определяется один раз — её видят и commander, и TUI.

## Точка входа

[bin/capsule.mjs](../../packages/cli/bin/capsule.mjs):

```
1. existsSync(src/cli/index.ts)?
   → yes: dev-режим, грузим через jiti (bin/dev.mjs)
   → no:  prod-режим, грузим dist/index.mjs

2. У argv есть позиционник или -h/-V?
   → yes: program.parseAsync(argv)   ← commander
   → no:  RunCli()                    ← TUI
```

[bin/dev.mjs](../../packages/cli/bin/dev.mjs) парсит `tsconfig.base.json → paths`, строит alias-мапу и инициализирует jiti с включённым JSX. Это позволяет запускать TS-исходники напрямую из монорепы без сборки.

## Поток одной команды

```
User → bin/capsule.mjs
         │
         ├─ commander mode:  program.parseAsync(argv)
         │                      ↓
         │                   commander.action(...) → runCommand(cmd, ctx, params)
         │
         └─ TUI mode:        RunCli() → runTuiMenu()
                                ↓
                              detect() → ctx
                                ↓
                              collectCommands(ctx)   ← filter by scope
                                ↓
                              <App> рисует tabs + список
                                ↓
                              user выбирает → runCommand(cmd, ctx)
                                ↓
                              loop (ctx может смениться, e.g. openProject делает chdir)
```

[runCommand](../../packages/cli/src/cli/runner.ts) общий для обоих режимов:
1. `resolveParams(cmd, provided)` — мерж `staticParams` + provided + интерактивные промпты на недостающее.
2. `cmd.action(ctx, params)` — собственно выполнение.
3. Если action бросает — логирует через `kit.log.error`, но **не падает**, TUI продолжает работать.

## Структура `packages/cli/src/`

```
src/
├── index.ts            re-export RunCli + program
├── cli/
│   ├── index.ts        RunCli = runTuiMenu, program = buildProgram()
│   ├── program.ts      tree builder для commander (id "create.app" → "capsule create app")
│   ├── runner.ts       resolveParams + runCommand (общий для TUI и commander)
│   ├── defines.ts      globalThis.defineCapsuleConfig / defineAppConfig stubs
│   └── tui/
│       ├── runTuiMenu  цикл detect→render→runCommand
│       ├── App         корневой ink-компонент (tabs + list + detail + footer)
│       ├── CommandList виртуальный список (computeWindow центрирует selected)
│       ├── Detail      правая панель: label + description
│       ├── Header      title + ctxLabel + tabs
│       ├── Footer      hints (↑↓ ←→ ↵ esc)
│       ├── icons.ts    политика иконок (RGI без VS16, см. ниже)
│       └── theme.ts    цветовая палитра ink
├── commands/
│   ├── types.ts        Command, CommandParam, Scope, Category — единый контракт
│   ├── index.ts        staticCommands[], CATEGORY_META, groupByCategory
│   ├── create.ts       workspace, app, lib, +6 слоёв (page/entity/...)
│   ├── dev.ts          dev
│   ├── build.ts        build
│   ├── desktop.ts      desktop dev/build
│   ├── workspace.ts    workspace info
│   ├── git.ts          12 git-команд (status, branches, switch, ...)
│   ├── nx.ts           nx projects/affected/graph/report/run
│   ├── release.ts      release plan/run/tags
│   └── navigation.ts   динамические "open apps/X" + "go to root"
├── context/
│   ├── types.ts        CtxType, CliContext
│   └── detect.ts       walks up по `nx.json`, классифицирует контекст
├── kit/
│   ├── index.ts        kit = { ...ui, ...shell, printTable, chalk }
│   ├── ui.ts           intro/outro/select/confirm/input/note/log/spinner
│   ├── prompts.tsx     ink-based select/input/confirm (НЕ clack — см. gotcha)
│   ├── shell.ts        task() — spinner вокруг execa
│   └── table.ts        printTable через console-table-printer
├── actions/            реализации каждой command.action
│   ├── _scaffold.ts    общая логика scaffoldEntity (templates → install)
│   ├── create-*.ts     create workspace/app/lib/layer
│   ├── dev-server.ts   импортит @capsuletech/vite-builder через cvd.importModule
│   ├── build-app.ts    то же, но buildCapsuleApp
│   ├── desktop.ts      spawn scripts/desktop.mjs <action> <app> [--flags]
│   ├── git.ts          12 git-actions через execa
│   ├── nx.ts           5 nx-actions
│   ├── release.ts      scripts/release.mjs обёртка
│   ├── open-project.ts process.chdir для навигации внутри TUI
│   └── workspace-info.ts
├── templates/
│   ├── layers.ts       inline-шаблоны для create-layer (Page/Entity/...)
│   ├── workspace/      файл-дерево для create-workspace (.template-суффикс)
│   ├── app/            файл-дерево для create-app
│   └── lib/            файл-дерево для create-lib
└── utils/
    ├── cvd.ts          импорт TS-модулей из пользовательского cwd через jiti
    ├── templates.ts    resolveTemplateDir (dev: src/, prod: dist/)
    └── vite-entry.ts   getViteEntry для dev-server и build-app
```

## Контракт `Command`

Из [src/commands/types.ts](../../packages/cli/src/commands/types.ts):

```ts
interface Command {
  id: string;          // "create.app" → "capsule create app" в commander
  label: string;       // что показывается в TUI
  icon?: string;       // обычно префикс к label (см. icons.ts policy)
  description: string; // правая панель Detail в TUI / commander help
  scope: Scope[];      // в каких ctx команда видна. '*' = всегда
  category: Category;  // create | dev | workspace | git | release | nx | navigation
  params?: CommandParam[];
  staticParams?: Record<string, unknown>; // зашитые значения (одна action — N команд)
  action: CommandAction;
}

type Scope = CtxType | '*';
type CtxType = 'no-workspace' | 'workspace-root' | 'app' | 'lib' | 'workspace-inner';

type CommandAction = (ctx: CliContext, params: Record<string, unknown>) => Promise<unknown>;
```

`CommandParam` описывает аргумент:

```ts
interface CommandParam {
  name: string;              // ключ в params
  description: string;
  required?: boolean;        // для commander обязательность позиционника
  positional?: boolean;      // переводится в commander.argument('<name>')
  prompt?: CommandPrompt;    // если задан — спрашивается в TUI; пусто = "системный" (только staticParams/provided)
  validate?: (v: string) => string | undefined;
  default?: unknown;
}
```

**Идея:** одна action — N "виртуальных" команд через `staticParams`. Пример из [commands/create.ts](../../packages/cli/src/commands/create.ts):

```ts
const layerCommand = (layer: Layer): Command => ({
  id: `create.${LAYER_LABELS[layer].toLowerCase()}`,
  staticParams: { layer },     // ← зашиваем сюда
  params: [{ name: 'name', ... }],
  action: createLayer,         // ← общая action видит и layer, и name
});
```

→ `capsule create page user/profile`, `capsule create widget forms/auth` — одна action, разные команды.

## Как добавить новую команду

1. **Создай action** в `src/actions/<my-thing>.ts`:

   ```ts
   import type { CommandAction } from '../commands/types';
   import { kit } from '../kit';

   export const myThing: CommandAction = async (ctx, params) => {
     if (ctx.type !== 'app') {
       kit.log.error('Только из apps/<name>/');
       return;
     }
     // твоя логика
   };
   ```

2. **Экспортни из** [src/actions/index.ts](../../packages/cli/src/actions/index.ts).

3. **Опиши команду** в подходящем `src/commands/<category>.ts` или создай новый файл:

   ```ts
   import { myThing } from '../actions';
   import { ICONS } from '../cli/tui/icons';
   import type { Command } from './types';

   export const myCommands: Command[] = [{
     id: 'my.thing',
     label: `${ICONS.someIcon} My thing`,
     description: 'Что делает',
     scope: ['app'],
     category: 'dev',
     action: myThing,
   }];
   ```

4. **Подключи массив** в [src/commands/index.ts](../../packages/cli/src/commands/index.ts) → `staticCommands`.

5. **Иконку**, если новая, добавь в [src/cli/tui/icons.ts](../../packages/cli/src/cli/tui/icons.ts) — **обязательно** RGI emoji без VS16 (см. gotcha ниже).

6. **Build не нужен** в dev-режиме (jiti). В prod — `pnpm --filter @capsuletech/cli build`.

Всё. Команда автоматически появится в TUI (в нужном tab) и в commander (`capsule my thing`).

## Шаблоны (templates)

Два типа:

| Тип | Где | Когда используется | Формат |
|---|---|---|---|
| **Inline-шаблоны слоёв** | [src/templates/layers.ts](../../packages/cli/src/templates/layers.ts) | `create-layer` (page/entity/controller/feature/widget/shape) | TS-строки в коде |
| **Файл-деревья** | `src/templates/{workspace,app,lib}/` | `create-workspace/app/lib` | `*.template`-файлы, копируются через `@capsuletech/shared-file-manager` |

Для файл-деревьев работает [`resolveTemplateDir`](../../packages/cli/src/utils/templates.ts) — пробует `<caller>/templates/<name>` (prod, vite-bundle), потом `../templates/<name>` (dev, src). В prod-сборке шаблоны копируются в `dist/templates/` плагином `staticCopyPlugin` из vite-builder.

Префикс `__dot__` в имени → `.` при материализации (`__dot__gitignore.template` → `.gitignore`). Это потому что pnpm/npm fight `.foo`-файлы в публикуемых пакетах.

## Kit (UI helpers)

`kit` — namespace для всего, что рисует/вызывает sh. Импортируется из [src/kit](../../packages/cli/src/kit):

```ts
import { kit } from '../kit';

await kit.intro('Заголовок');
const name = await kit.input('Имя?', 'placeholder', (v) => v ? undefined : 'обязательно');
const yes = await kit.confirm('Точно?');
const choice = await kit.select('Что?', [{ value: 'a', label: 'A' }, ...]);
await kit.task('Делаю штуку', async (spinner) => { /* ... */ });
kit.note('Текст', 'Заголовок');
kit.log.info('...'); kit.log.warn('...'); kit.log.error('...');
kit.printTable([{ col1: 'a', col2: 'b' }]);
```

**Прим.:** select/input/confirm — на **ink**, не на clack (см. gotcha). Note/log/spinner/intro/outro — clack.

## TUI устройство

[runTuiMenu](../../packages/cli/src/cli/tui/runTuiMenu.tsx) — простой цикл:

```
while (true) {
  ctx = detect();                  ← каждую итерацию заново
  pick = await askPick(ctx);       ← рендерит <App>, ждёт выбора или exit
  if (exit) break;
  await runCommand(pick.command, ctx);
}
```

`detect()` каждую итерацию = navigation-команды (`open.app.X`, `open.root`) работают: они делают `process.chdir`, следующий `detect()` видит уже новый контекст.

[App](../../packages/cli/src/cli/tui/App.tsx) — Header (tabs) + Box{CommandList, Detail} + Footer. Управление: `↑↓` items, `←→` tabs, `↵` run, `esc/q` exit, цифры — jump-by-index в tabs.

## Контекст и режим

[detect()](../../packages/cli/src/context/detect.ts) идёт вверх по дереву ищет `nx.json` — это и есть workspace root. Дальше классифицирует:

| Условие | `ctx.type` |
|---|---|
| `nx.json` не найден | `no-workspace` |
| `nx.json` в cwd | `workspace-root` |
| cwd под `apps/<name>` | `app` (с `ctx.name = <name>`) |
| cwd под `packages/<name>` | `lib` |
| остальное под workspace | `workspace-inner` |

**Mode** (`dev`/`prod`):
- `CAPSULE_MODE=development|production` — принудительно.
- иначе: `packages/builders/vite/package.json` существует → `dev`, нет → `prod`.

Где `mode` используется:
- [`getViteEntry`](../../packages/cli/src/utils/vite-entry.ts) — dev импортит исходный `dist/index.mjs` vite-builder из монорепы, prod резолвит через `require.resolve('@capsuletech/vite-builder')`.
- [`scaffoldEntity`](../../packages/cli/src/actions/_scaffold.ts) — dev подставляет в скаффолд `workspace:*` для `@capsuletech/*`-deps, prod ставит `latest`.

## Gotchas

### Иконки: только RGI Emoji_Presentation, без VS16

[icons.ts](../../packages/cli/src/cli/tui/icons.ts) комментарий объясняет — но коротко: эмодзи с `Emoji_Presentation=Yes` рендерятся как 2 ячейки во всех современных терминалах, `string-width` тоже возвращает 2. Эмодзи default-text (`🕸️ ▶️ ⬆️ 🎛️`) требуют VS16 для emoji-presentation, и тут начинаются съезды разделителей.

**Если добавляешь иконку — проверяй в [emoji-data.txt](https://unicode.org/Public/emoji/15.0/emoji-data.txt) что `Emoji_Presentation=Yes`. Не угадывай.**

### Промпты — ink, не clack

`@clack/prompts` отлично работает сам по себе, но как только ты заходишь в clack-промпт **после** ink-меню — стрелки перестают переключать пункты в следующем ink-меню. Stdin contention: они оба claim raw mode.

Поэтому в [kit/prompts.tsx](../../packages/cli/src/kit/prompts.tsx) написаны свои `inkSelect/inkInput/inkConfirm` на ink-компонентах + ink-text-input. `kit.note/log/spinner/intro/outro` остались на clack — они не интерактивные, конфликта нет.

### jiti-кэш в `cvd.importModule`

[utils/cvd.ts](../../packages/cli/src/utils/cvd.ts) держит **Map<cwd, jitiInstance>** — иначе каждый импорт пользовательского `capsule.config.ts` инициализирует свой esbuild, тормоза. Кэш живёт на время процесса.

### `CAPSULE_MODE`

Не задокументировано в `--help`, но критично если CLI ставится из npm в свой капсул-репо (или наоборот, dev-CLI тестится в "prod"-сценарии). См. [context/detect.ts:6](../../packages/cli/src/context/detect.ts).

### Иерархия команд через точки

`id: "create.app"` → `capsule create app` в commander, "create › App" в TUI tab "Create". Точки бить можно глубже (`open.app.sandbox`), commander построит вложенные группы автоматически — [src/cli/program.ts:14](../../packages/cli/src/cli/program.ts).

### `git commit` делает `git add -A`

[actions/git.ts:371](../../packages/cli/src/actions/git.ts) добавляет **все** изменения перед коммитом. Это удобно для small-edit циклов, но рискованно при наличии незакоммиченных `.env`/секретов. Если коммитишь "руками" — лучше `git add <file>` + `git commit` напрямую, минуя CLI.

## Известные шероховатости

- `@nx/devkit` в [packages/cli/package.json](../../packages/cli/package.json) **не нужен** (был fixed: перенесён в `vite-builder`/`shared-file-manager` где реально импортируется).
- Layer-шаблоны inline-строками в [layers.ts](../../packages/cli/src/templates/layers.ts) — остальные шаблоны лежат файл-деревом. Можно унифицировать, но не приоритет.
- TUI не сохраняет позицию tab/item между итерациями — после команды tab сбрасывается на 0. Минор UX.
- `bin/*.mjs` не покрыт tsconfig — JS без `checkJs`. Если хочется усиления — добавить `bin/` в `include` и `checkJs: true`.

## Связанное

- [[git|capsule git — workflow]] — гайд по git-команде
- [[releases|capsule release — релизы]] — релизный флоу
- [[desktop|capsule desktop — Tauri shell]] — desktop-shell
- [[vite-plugins]] — что делает `@capsuletech/vite-builder`, которого `dev`/`build` импортируют
- [[layers|HCA-слои]] — куда идут команды `create page/entity/...`
- AI-anchor: [[_meta/cli|cli.md в _meta]] — компактный референс для агентов
