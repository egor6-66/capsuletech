---
tags: [meta, releases, ai-context]
status: documented
type: ai-anchor
audience: claude
---

# 🤖 Releases — AI context anchor

> [!ai]
> Это короткая шпаргалка для Claude-инстансов. Без воды. Юзеру читать не обязательно — для них [[releases|releases.md]].

## TL;DR

Релизы рулятся **Nx Release** (`nx release` + `nx release publish`). Конфиг **инлайном в `nx.json`** (TS-файлы Nx не читает). Два registry-таргета: npm, verdaccio, nexus. Helper-скрипт `scripts/release.mjs` берёт URL и credentials из env.

## Где что лежит

| Файл | Что |
|---|---|
| `nx.json` → `release` | Главный конфиг — группы, conventional-commits, git-настройки |
| `scripts/release.mjs` | Обёртка: 2 шага (`nx release --skip-publish` → `nx release publish --registry`), inject auth в `.npmrc` |
| `scripts/publish.mjs` | **СТАРЫЙ** dev-publisher для verdaccio (snapshot-versioning, без git-тегов). Не путать с releases. |
| `package.json` → `scripts.release:*` | Готовые комбинации group×registry |
| `releases.ts` | **МЁРТВЫЙ файл** — Nx не умеет `release.extends` к TS. Юзер написал на старте, не успели снести. При случае удалить. |
| `docs/08-system/releases.md` | User-facing how-to |

## Группы (источник истины — `nx.json`)

```
cli       independent  tag={projectName}@{version}    [@capsuletech/cli, @capsuletech/file-manager]
web_base  fixed        tag=web@{version}              [core, router, ui, vite, style, profiler]
```

**Pattern depends on relationship:**
- `fixed` → single tag per group (`web@1.2.3`) — все пакеты группы делят версию
- `independent` → per-project tag (`@capsuletech/cli@0.0.2`) — у каждого своя

- **fixed** в `web_base` = ЛЮБОЙ commit с conventional-scope в любой из 7 пакетов бампает версию ВСЕХ 7. Это намеренно — core re-export'ит router/etc., поэтому ходят синхронно.
- **independent** в `cli` = один пакет, своя версия.
- `updateDependents: auto` — переписывает `workspace:*` → конкретную версию в опубликованных package.json.
- WIP-пакеты (`dnd`, `editor-state`, `inspector`, `manifests`, `query`, `renderer`, `state`, `zod`) **не в группах** — Nx их игнорит при релизе.

## Auth для registry

Helper парсит host из URL и пишет временный `.npmrc` в корень проекта (с восстановлением через `try/finally` + `SIGINT`). Env-переменные с `:` в ключе ломаются на Windows — поэтому не env-injection, а файл.

| Registry | Env vars |
|---|---|
| `npm` | `NPM_TOKEN` (опционально для public) |
| `verdaccio` | — (anonymous обычно) |
| `nexus` | `NEXUS_REGISTRY` (URL, обязательно) + `NEXUS_TOKEN` либо `NEXUS_USERNAME`+`NEXUS_PASSWORD` |

## Известные грабли

1. **`--registry` есть только у `nx release publish`**, не у top-level `nx release`. Поэтому в helper'е два вызова.
2. **Первый релиз требует `--first-release`** — без тега в репе Nx не знает baseline и падает.
3. **`@capsuletech/router/package.json`** указывает `main: ./src/index.ts` — упадёт при `npm install` потребителя. Чинить когда дойдёт до первой реальной публикации.
4. **`releases.ts` в git status (AM)** — мёртвый файл, см. выше.
5. **`prepublishOnly` в пакетах** дёргает `pnpm build` при публикации — может задвоить билд после `preVersionCommand`. Безопасно, но медленно.
6. **`packageRoot` переопределён** в `targetDefaults["nx-release-publish"]` на `{projectRoot}`. У нас `dist/` внутри пакета (`packages/cli/dist/`), а Nx по дефолту ждёт `dist/<projectRoot>/package.json` (стандартный Nx-layout с build-копированием package.json). Без override падает с `does not have a package.json file available in dist\packages\...`.
7. **`preVersionCommand` per-group** — schema-warning «Property not allowed» в IDE, но Nx 22 фактически исполняет команду из `release.groups.<name>.version.preVersionCommand`. Warning игнорим. Без per-group команда top-level пришлось бы билдить всё ради релиза одного пакета.
8. **`preVersionCommand: pnpm --filter <pkg> build`** (НЕ `nx run-many`). В графе есть цикл `@capsuletech/shared-vite ↔ @capsuletech/compliance` (vite зависит от compliance как **dependency**, compliance — от vite как **devDependency** для своего `vite.config.ts`). Nx считает оба одинаково и падает с "circular dependency". pnpm для topo-сортировки использует только runtime deps — цикла не видит и собирает корректно. Чинить архитектурно — убрать `@capsuletech/shared-vite` из compliance.devDependencies, использовать сырой `vite`.
9. **Кастомный publish executor через `nx:run-commands` вместо `@nx/js:release-publish`.** В `nx.json` → `targetDefaults["nx-release-publish"]`:
   ```json
   {
     "executor": "nx:run-commands",
     "options": {
       "packageRoot": "{projectRoot}",
       "command": "pnpm publish --no-git-checks --registry={args.registry}",
       "cwd": "{projectRoot}"
     }
   }
   ```
   **Почему:** стандартный `@nx/js:release-publish` зовёт `npm publish` под капотом — требует npm в PATH (у нас pnpm-only environment, npm отсутствует). Кастомный executor зовёт `pnpm publish` напрямую. `{args.registry}` интерполируется из `--registry` флага.

   **Важно:** этот подход с **executor + options** в targetDefaults применяется даже без explicit таргета в `project.json`. Поэтому все `nx-release-publish` блоки из project.json должны быть **удалены** — targetDefault их заменяет. (Только options без executor — НЕ применяется к synthesized таргетам, мы это раньше выяснили).

   Бонус: в `package.json` пакета — `publishConfig.packageManager: "pnpm"` сигналит pnpm как "official publish tool".

10. **`preserveLocalDependencyProtocols: true`** в nx.json — критично для локального dev. При `false` Nx переписывает `workspace:*` → конкретная версия В SOURCE package.json после релиза. pnpm после этого работает только по version-match (лотерея). При `true` source файлы остаются с `workspace:*`, а в опубликованном tarball pnpm конвертирует сам.
11. **`updateDependents` ловушка cross-group.** При `auto` Nx при бампе одного пакета каскадно бампает всех его dependents, **даже из других групп**. Пример: релиз cli группы → file-manager бампается → core (web_base) зависит → web_base fixed → все 6 пакетов web_base в графе → валидация падает на их `manifestRootsToUpdate: dist/{projectRoot}`. Сейчас глобально `updateDependents: "never"` — каскада нет нигде. Когда дойдём до web_base — можно включать `auto` локально для группы, если нужно.
12. **`You cannot publish over the previously published versions` после первого релиза.** Conventional-commits ждёт `feat:`/`fix:`/`BREAKING CHANGE:` коммит с момента последнего git-tag'а. Если ничего такого не было — Nx не бампает версию → версия в `package.json` совпадает с уже опубликованной → npm/verdaccio отказывает. Решение: либо коммитить с правильным conventional-prefix, либо передать явный specifier: `pnpm release:local -- patch`. Наш `release.mjs` передаёт первый non-flag positional как specifier в `nx release`.
13. **`--first-release` нельзя оставлять в постоянных скриптах.** Флаг для САМОГО первого релиза (когда нет git-tag'а). С ним Nx fallback'ается на disk-version resolver и игнорит существующие теги — поэтому conventional-commits с ним работают неправильно для последующих релизов. Использовать одноразово: `pnpm release:local -- --first-release`.
14. **`releaseTagPattern` зависит от `projectsRelationship`.** Для `fixed` группы — единый тег на всю группу: `"web@{version}"`. Для `independent` — обязательно с `{projectName}` placeholder: `"{projectName}@{version}"` → теги вида `@capsuletech/cli@0.0.2`, `@capsuletech/file-manager@0.0.2`. Без `{projectName}` в independent-группе пакеты конфликтуют на одном и том же теге, и Nx падает либо даёт неверный diff. Сейчас в `nx.json`: `cli` → `{projectName}@{version}`, `web_base` → `web@{version}`.

## Что менять когда

| Хочу… | Куда лезть |
|---|---|
| Новая группа (node-server, editor, …) | `nx.json` → `release.groups` + новые `release:<name>:*` в `package.json` |
| Поменять nexus URL по-умолчанию | Только через `NEXUS_REGISTRY` env, дефолта нет (намеренно) |
| Поменять формат git-тега | `releaseTagPattern` в группе |
| Отказаться от auto-push | `release.git.push` уже `false`, юзер пушит руками |
| Включить workspace-changelog | `release.changelog.workspaceChangelog: true` (сейчас выкл, только per-project) |

## Cross-links

- User-doc: [[releases]]
- Связанное: [[cli]] (publish.mjs живёт там же в скриптах), [[golden-rules]] (что между группами не каскадится)
