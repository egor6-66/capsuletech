---
name: @capsuletech/vite-builder
owner-agent: owner-builders
group: cli
status: pre-1.0
last-updated: 2026-05-20
---

# @capsuletech/vite-builder

Vite-конфиг и 9 плагинов для dev-сервера HCA-apps. Дёргается через CLI (`createDevCapsuleServer` / `buildCapsuleApp`).

## Зона ответственности

### Owns
- `packages/builders/vite/src/` — всё
- `packages/builders/vite/vite.config.mts` — self-build (deep-imports минуя barrel)
- `packages/builders/vite/package.json` exports / deps

### Не трогает
- `packages/builders/compliance/src/` — потребляет через CompliancePlugin, не правит
- `packages/builders/lib/src/` — потребляет `libConfig`, не правит
- Root-level `package.json`, `tsconfig.base.json`, `nx.json` (главный assistant)
- `apps/*/` (user / framework-developer scope)
- `scripts/release-local.mjs` и shared infra (главный assistant)

## Публичный API

Экспортируется через `.` entrypoint (`dist/index.mjs`):

- `capsuleConfig({ config, root, workspaceRoot, isDev }): UserConfig` — главная точка входа. Собирает Vite config с 9 плагинами для HCA-app dev-сервера.
- `createDevCapsuleServer(workspaceRoot, appName): Promise<ViteDevServer>` — CLI дёргает для `capsule dev`.
- `buildCapsuleApp(workspaceRoot, appName): Promise<void>` — CLI дёргает для `capsule build`.
- `appConfig(config, isDev): UserConfig` — минимальный конфиг для plain Vite apps без HCA.
- `libConfig` — re-export из `@capsuletech/lib-builder` для legacy compat.
- `type ICapsuleConfig` — тип опций capsuleConfig (включая `desktop?: IDesktopConfig` для Tauri-shell — ADR 017).
- `type IDesktopConfig` — реэкспорт из `@capsuletech/desktop` для удобства apps (одна точка типов).
- `type IDefineLibConfigOptions` — тип опций libConfig.
- `plugins` namespace — все плагины как named exports (через barrel `plugins/index.ts`).
- `defines` namespace — все define-хелперы.

### Плагины (порядок в `capsuleConfig.ts`)

| Плагин | Файл | Что делает |
|---|---|---|
| `AutoImport` | `capsuleConfig.ts` (inline) | Инжектит WRAPPER_NAMES + DEFINE_FACTORIES как глобальные имена |
| `HMRWrappingPlugin` | `plugins/HMRWrapping.ts` | babel-AST: `const X = Page(...)` → `(props) => Page(...)(props)` + `export default` |
| `AppConfigPlugin` | `plugins/appConfig.ts` | jiti-load `capsule.app.ts` → `.capsule/@types/app-tags.d.ts` + `app-config.gen.ts` |
| `tsconfigPaths` | `capsuleConfig.ts` (inline) | Резолв `@capsuletech/*` из `tsconfig.base.json` |
| `EnsureScaffoldPlugin` | `plugins/scaffold/index.ts` | Копирует 5 entry-файлов в `.capsule/` при первом запуске |
| `ExportGeneratorPlugin` | `plugins/exportGenerator.ts` | Scan + watcher: `wrappers.ts` + `slots.d.ts` в `.capsule/registry/` |
| `EndpointsRegistryPlugin` | `plugins/endpointsRegistry.ts` | Scan + watcher: `endpoints.ts` + `api.d.ts` в `.capsule/registry/` |
| `tailwindcss()` | `capsuleConfig.ts:134` | Tailwind v4 через `@tailwindcss/vite` |
| `AliasesPlugin` | `plugins/aliases.ts` | Мержит paths → `.capsule/tsconfig.paths.json` + Vite `resolve.alias` |
| `CompliancePlugin` | `plugins/compliance.ts` | pre-transform: `check()` на каждый файл, режим `warn` |
| `RouterPlugin` | `plugins/router/index.ts` | ensureRootRoutePlugin + page-mirror generator + TanStackRouterVite |
| `solidPlugin` | `capsuleConfig.ts` (inline) | Solid.js JSX transform |

## SSOT

`packages/builders/vite/src/plugins/constants.ts` — **единственный файл**, где объявлены:
- `WRAPPER_NAMES` — `['Page', 'Widget', 'View', 'Controller', 'Feature', 'Shape', 'Entity']`
- `DEFINE_FACTORIES` — `{ '@capsuletech/web-query': ['defineEndpoint'] }`
- `LAYER_TO_NAMESPACE` — `{ widgets: 'Widgets', views: 'Views', controllers: 'Controllers', features: 'Features', shapes: 'Shapes', entities: 'Entities' }`
- `EAGER_IMPORT_LAYERS` — `Set<string>(['entities'])` — слои, генерирующие eager imports вместо lazy()

Добавляешь новый слой → правишь только этот файл.

## Quirks / gotchas

- **Scaffold/router templates путь в dist.** `EnsureScaffoldPlugin` в runtime читает `.template`-файлы через `__dirname` → `dist/plugins/scaffold/template/` (вычислено от `dist/index.mjs`). Но libConfig/rollup не копирует non-JS ресурсы. Явный `staticCopyPlugin` в `vite.config.mts` копирует `src/plugins/scaffold/template` и `src/plugins/router/template` в `dist/template/`. При добавлении нового `.template`-файла обязательно добавить запись в `staticCopyPlugin`, иначе `ENOENT` в рантайме. Фикс применён 2026-05-20.

- **`vite.config.mts` deep-imports.** Файл импортирует `staticCopyPlugin` напрямую через `'./src/plugins/staticCopy'`, минуя `plugins/index.ts` barrel. Это намеренно: esbuild при использовании barrel'а вытянет `CompliancePlugin → compliance/dist`, нарушая bootstrap-порядок сборки. Не добавляй transit-импорты через barrel в `vite.config.mts`.

- **`@babel/traverse` и `@babel/generator` — CJS.** В `HMRWrapping.ts` и `compliance/check.ts` есть interop: `_traverse.default ?? _traverse`. ESM-import возвращает namespace-объект, не функцию. Не убирай interop без понимания.

- **HMRWrappingPlugin матчит wrapper по identifier-name.** `import { Page as MyPage }` — HMR молча сломается. AutoImport инжектит чистые имена — edge case, но важен при нестандартных импортах.

- **Двойной initial-scan в dev.** ExportGeneratorPlugin и EndpointsRegistryPlugin делают `walkFiles` и в `buildStart`, и в `configureServer`. Это перформанс-косяк на холодном старте, не баг — не чини без roadmap-задачи.

- **`AppConfigPlugin.transform` — regex replace.** `defineAppConfig` в комментариях тоже заменяется identity-wrap `((__x__)=>__x__)`. Безобидно, но мусорит. Миграция на AST-rewrite в Roadmap. ADR 013.

- **`AppConfigPlugin.BROWSER_FACTORY_NAMES` содержит `defineCapsuleConfig`.** Ветка для `capsule.config.ts`, но плагин transform'ит только `capsule.app.ts` (configPath). Эта ветка не отрабатывает — либо убрать, либо задокументировать.

- **`bundleDependencies` в `vite.config.mts` — проверяй при правках.** Список должен включать `/^@capsuletech\/compliance/` и `/^@capsuletech\/lib-builder/`. Исторически бывали stale-имена от переименований пакетов.

- **`dist/` rebuild обязателен после правок `src/`.** Apps читают `dist/index.mjs`, не `src/`. После изменений: `pnpm --filter @capsuletech/vite-builder build` + рестарт dev-сервера. Smoke: `console.log('[plugin] loaded')` на верхнем уровне плагина.

- **`optimizeDeps.exclude`** — список `@capsuletech/web-*` пакетов в `capsuleConfig.ts`. При добавлении нового workspace-пакета добавь его сюда, иначе esbuild попытается пре-бандлить и сломает JSX-транспиляцию.

- **`solidPlugin` exclude для `entities/`.** `vite-plugin-solid` внутри использует `solid-refresh`, который оборачивает любой `const X = SomeCall(...)` в `.tsx`-файле в `(props) => SomeCall(...)(props)` для поддержки HMR компонентов. `Entity` возвращает plain config object (`{ schema, defaults }`), а не Solid-компонент — после такой обёртки `Entities.Users` становится функцией, и любой доступ к `.schema`/`.defaults` падает TypeError. `HMRWrappingPlugin` entity уже скипает (использует только `RENDER_WRAPPER_NAMES`), но `solid-refresh` — отдельный babel-pass внутри `solidPlugin`. Поэтому `solidPlugin` получает `exclude: [/[\\/]entities[\\/]/]`. Регекс покрывает оба сепаратора (Win/Unix). При добавлении других data-layer слоёв (не возвращающих Solid-компонент) — добавлять в этот же exclude-список.

- **`desktop?: IDesktopConfig` — type-only без peerDep.** Vite-builder секцию НЕ читает в runtime — только тип. CLI читает её через `importModule('capsule.config.ts')` и передаёт в `runDev`/`runBuild` пакета `@capsuletech/desktop` (PR 5). **Никакого peerDep на `@capsuletech/desktop`** — пробовали, ловили Nx circular dependency (`vite-builder → desktop → vite-builder`, т.к. desktop сам использует vite-builder для сборки). Type-only `import type` работает через `tsconfigPaths` в workspace; Verdaccio consumers защищены `skipLibCheck: true` в `tsconfig.base.json` (apps без install'а `@capsuletech/desktop` не получают TS error на transitive reference).

- **Мёртвый код к удалению:** `vite/src/utils/generateFromTemplates.ts`, `vite/src/plugins/html.ts` (HtmlPlugin), `vite/src/defines/appConfig.ts:1` (`import { builtinModules }`).

## План рефакторинга / оптимизаций

- [ ] **Удалить мёртвый код** — `html.ts`, `generateFromTemplates.ts`, стрельнувший `import { builtinModules }` в `appConfig.ts`. (priority: low)
- [ ] **AppConfigPlugin transform → AST-rewrite** вместо regex. ADR 013 — закрыт через explicit-import, legacy-bridge остаётся. (priority: medium)
- [ ] **Убрать `BROWSER_FACTORY_NAMES: defineCapsuleConfig`** или добавить обработку `capsule.config.ts`. (priority: low)
- [ ] **Reduce double initial-scan** в ExportGenerator / EndpointsRegistry — `walkFiles` дублируется при холодном старте. (priority: medium)
- [ ] **Добавить тесты vite-builder** — AutoImport генерация, HMRWrapping AST-transform, AppConfigPlugin transform/jiti, plugins ordering smoke. (priority: high)
- [ ] **Bump CompliancePlugin mode `warn` → `error`** после стабилизации allowlist. ADR 004. (priority: medium)

### Закрытые задачи

- [x] **Layer init ordering (TDZ fix) — 2026-05-28.** ESM hoisting: endpoints → features → widgets → pages → routeTree evaluate до `Object.assign(globalThis, _registry)` в bootstrap body → `Entities.X` = undefined / ReferenceError. Fix: `ExportGeneratorPlugin.renderRuntime` добавляет `Object.assign(globalThis, { Widgets, Views, ... })` как последнюю строку генерируемого `wrappers.ts`. `bootstrap.tsx` (template + pre-existing apps) переведён на bare side-effect `import './registry/wrappers'` — explicit `Object.assign` убран как redundant. 4 новых теста в `exportGenerator.test.ts` (22 total, все green).

## Test coverage

| Тип | Где | Что покрывает |
|---|---|---|
| Unit | `src/plugins/__tests__/appConfig.test.ts` | AppConfigPlugin transform (id matching, Windows paths, HMR suffixes) |
| Unit | `src/plugins/__tests__/exportGenerator.test.ts` | ExportGeneratorPlugin — entities scan: flat, nested namespace, empty folder; eager vs lazy regression; renderRuntime + renderTypes; Object.assign(globalThis) side-effect ordering |

Текущее покрытие: AppConfigPlugin + ExportGeneratorPlugin (entities layer).
Перед изменением любого плагина: `pnpm --filter @capsuletech/vite-builder test`.
Перед release: `pnpm test:e2e:cli` обязателен.

## Cross-package dependencies

| Зона | Owner |
|---|---|
| CLI (дёргает `createDevCapsuleServer` / `buildCapsuleApp`) | owner-cli |
| compliance (встроен в dist через bundleDependencies) | owner-builders |
| lib-builder (встроен в dist через bundleDependencies) | owner-builders |
| web-style (CSS pipeline, `@source` paths в scaffold template) | owner-web-style |
| web-core (WRAPPER_NAMES, AutoImport) | owner-web-core |

## Release group

- `cli` — fixed group: cli + compliance + lib-builder + shared-file-manager + vite-builder

Breaking change в публичном API (`capsuleConfig`, `createDevCapsuleServer`, `buildCapsuleApp`) — согласовать с owner-cli перед release.
