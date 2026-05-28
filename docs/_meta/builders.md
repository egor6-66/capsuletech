---
tags: [meta, builders, ai-context]
status: documented
type: ai-anchor
audience: claude
---

# 🤖 @capsuletech/builders — AI context anchor

> [!ai]
> Шпаргалка для Claude-инстансов, которые лезут в `packages/builders/`. Без воды. Юзеру — [[builders|builders.md]].

## TL;DR

4 build-time пакета. `lib-builder` — zero-deps leaf (libConfig для любого пакета). `vite-builder` — рантайм для apps (dev-server + 9 плагинов). `compliance` — AST-линтер HCA-правил. `biome-config` — shared lint preset. Релизятся ОДНОЙ группой `cli` в `nx.json` (fixed, releaseTagPattern `cli@{version}`) вместе с `@capsuletech/cli` и `shared-file-manager`.

Главное правило: **build-time пакеты живут тут**. Runtime cross-group — в `packages/shared/`. Критерий — используется в `vite.config.mts` чужих пакетов / `capsule.config.ts` apps'ов, а не в их JSX.

## Топология (после ADR 010)

```
packages/builders/
  lib/         @capsuletech/lib-builder    zero-deps, libConfig() для Vite
  vite/        @capsuletech/vite-builder   capsuleConfig + 9 плагинов
  compliance/  @capsuletech/compliance     AST-линтер HCA-слоёв
  biome/       @capsuletech/biome-config   biome.json preset (НЕТ src/dist!)
```

Цепочка зависимостей (НЕ должна циклить):
```
vite-builder → compliance (runtime через CompliancePlugin)
compliance   → lib-builder (build-time, в vite.config.mts)
lib-builder  → ничего (zero-deps leaf)
biome-config → ничего (zero-deps, чисто config-файл)
```

Поэтому `libConfig` живёт ОТДЕЛЬНО от `vite-builder`. Если положить в один пакет — bootstrap-цикл. Re-export `vite-builder/defines/libConfig.ts` сохраняет публичный API.

## Где что лежит

| Файл | Что |
|---|---|
| `packages/builders/lib/src/libConfig.ts` | Vite `UserConfig`-фабрика для библиотек: external selector, dts, `cleanRootPkgForDist` |
| `packages/builders/lib/src/__tests__/libConfig.test.ts` | характеризационные тесты на external + cleanRootPkgForDist (S-3 регрессия) |
| `packages/builders/vite/src/defines/capsuleConfig.ts` | главный конфиг dev-сервера для apps; собирает плагины |
| `packages/builders/vite/src/defines/appConfig.ts` | минимальный конфиг для plain Vite apps без HCA |
| `packages/builders/vite/src/defines/libConfig.ts` | re-export `libConfig` из `@capsuletech/lib-builder` (legacy compat) |
| `packages/builders/vite/src/actions.ts` | `createDevCapsuleServer / buildCapsuleApp` — обёртки над Vite, дёргаются из CLI |
| `packages/builders/vite/src/plugins/constants.ts` | **SSOT** для `WRAPPER_NAMES`, `DEFINE_FACTORIES`, `LAYER_TO_NAMESPACE` |
| `packages/builders/vite/src/plugins/HMRWrapping.ts` | babel-AST pre-transform: `const X = Page(...)` → `(props) => Page(...)(props)` + `export default` |
| `packages/builders/vite/src/plugins/capsuleRegistry.ts` | **Unified codegen orchestrator.** Владеет ВСЕМ что генерируется в `.capsule/`. `LAYER_INIT_ORDER` — единственная точка контроля порядка инициализации. Stateless sub-generators: `generateWrappersRuntime`, `generateEndpointsRuntime`, `generateAppConfigRuntime`, `generateBootstrap`. Единый watcher на `src/**`. Заменяет ExportGeneratorPlugin + EndpointsRegistryPlugin + AppConfigPlugin (codegen). Генерирует `.capsule/bootstrap.tsx` детерминированно (не статический template). |
| `packages/builders/vite/src/plugins/__tests__/capsuleRegistry.test.ts` | Тесты sub-generators + LAYER_INIT_ORDER контракт + transform hooks + ordering regression |
| `packages/builders/vite/src/plugins/router/index.ts` | RouterPlugin: ensureRoot + page-mirror generator + TanStackRouterVite |
| `packages/builders/vite/src/plugins/router/template/__root.tsx.template` | шаблон корневого route |
| `packages/builders/vite/src/plugins/scaffold/index.ts` | EnsureScaffoldPlugin: копирует `index.html / index.ts / paths.config.json / styles.css` в `.capsule/` если их нет. `bootstrap.tsx` **НЕ** в списке — генерируется `CapsuleRegistryPlugin`. |
| `packages/builders/vite/src/plugins/scaffold/template/*.template` | 4 статических шаблона. `bootstrap.tsx.template` остаётся как историческая ссылка, больше не используется автоматически. |
| `packages/builders/vite/src/plugins/appConfig.ts` | **@deprecated.** Заменён `CapsuleRegistryPlugin`. Оставлен для backward compat внешних consumer'ов. |
| `packages/builders/vite/src/plugins/exportGenerator.ts` | **@deprecated.** Заменён `CapsuleRegistryPlugin`. Оставлен для backward compat. |
| `packages/builders/vite/src/plugins/endpointsRegistry.ts` | **@deprecated.** Заменён `CapsuleRegistryPlugin`. Оставлен для backward compat. |
| `packages/builders/vite/src/plugins/compliance.ts` | тонкая обёртка над `check()` — режимы warn/error |
| `packages/builders/vite/src/plugins/aliases.ts` | AliasesPlugin: мержит base + local paths → `.capsule/tsconfig.paths.json`; emit'ит Vite `resolve.alias` |
| `packages/builders/vite/src/plugins/staticCopy.ts` | `closeBundle`-копировальщик файлов; используется в собственном vite.config.mts |
| `packages/builders/vite/src/plugins/html.ts` | **МЁРТВЫЙ** — `HtmlPlugin` без потребителей |
| `packages/builders/vite/src/utils/walk.ts` | `walkFiles(dir)` — рекурсивный обход для initial-scan (chokidar `ignoreInitial: true` пропускает) |
| `packages/builders/vite/src/utils/watcher.ts` | singleton `WatcherManager` — один `server.watcher.on('all')` на много подписчиков |
| `packages/builders/vite/src/utils/generateFromTemplates.ts` | **МЁРТВЫЙ** — RouterPlugin перешёл на inline `ROUTE_TEMPLATE` |
| `packages/builders/compliance/src/classify.ts` | `classify(absPath) → Layer` + `extractGroup` (берёт имя группы из пути) |
| `packages/builders/compliance/src/rules.ts` | `RUNTIME_ALLOWED` (allowlist по слоям), `LAYER_PREFIXES`, `CROSS_LAYER_ALLOWED` |
| `packages/builders/compliance/src/check.ts` | главный чекер: babel parse → traverse → 5 видов violations |
| `packages/builders/compliance/src/format.ts` | `formatViolation/s` для лога Vite |
| `packages/builders/biome/biome.json` | сам preset; root репо делает `extends: ["./packages/builders/biome/biome.json"]` (filepath) |

## Single Source of Truth

`packages/builders/vite/src/plugins/constants.ts` — **обязательно править ТОЛЬКО его**, не дублируй списки в плагинах:

- `WRAPPER_NAMES = ['Page', 'Widget', 'View', 'Controller', 'Feature', 'Shape', 'Entity']` — потребители: HMRWrappingPlugin, AutoImport в capsuleConfig
- `DEFINE_FACTORIES = { '@capsuletech/web-query': ['defineEndpoint'] }` — config-time фабрики: (1) попадают в AutoImport для TSX-файлов, (2) **`CapsuleRegistryPlugin.transform` инжектирует их в `src/endpoints/**` как enforce:'pre'** (TDZ-safe, без зависимости от AutoImport timing)
- `LAYER_TO_NAMESPACE = { widgets: 'Widgets', views: 'Views', controllers: 'Controllers', features: 'Features', shapes: 'Shapes', entities: 'Entities' }` — mapping для `CapsuleRegistryPlugin` (sub-generator wrappers)
- `EAGER_IMPORT_LAYERS = Set(['entities'])` — слои, для которых `CapsuleRegistryPlugin` генерирует eager `import X from '...'` вместо `lazy()`. Entity — plain value (zod schema), не Solid component.

Добавляешь новый слой → правишь ОДИН файл, плагины подхватят.

## Главный поток в dev (что собирается в каком порядке)

```
1. CLI (apps/<app>/project.json dev-таргет) дёргает createDevCapsuleServer
2. capsuleConfig() собирает плагины:
   - AutoImport              (импорты wrapper'ов и define-фабрик)
   - HMRWrappingPlugin       (pre-transform всех .tsx/.ts)
   - tsconfigPaths           (резолв @capsuletech/* и @entities/* из tsconfig)
   - EnsureScaffoldPlugin    (config-хук: гарантирует статические scaffold-файлы в .capsule/)
   - CapsuleRegistryPlugin   (enforce:'pre' transform + buildStart/configureServer:
                               - scan src/** → registry/wrappers.ts + slots.d.ts
                               - scan endpoints/** → registry/endpoints.ts + api.d.ts
                               - jiti-load capsule.app.ts → app-config.gen.ts + app-tags.d.ts
                               - ГЕНЕРИРУЕТ bootstrap.tsx по LAYER_INIT_ORDER
                               - единый watcher на src/**)
   - tailwindcss
   - AliasesPlugin           (config-хук: tsconfig.paths.json + resolve.alias)
   - CompliancePlugin        (pre-transform: check() на каждый файл)
   - RouterPlugin            ([ensureRootRoutePlugin, GeneratorPlugin, TanStackRouterVite])
   - solidPlugin
3. Vite root = apps/<app>/.capsule/, outDir = apps/<app>/dist/
4. bootstrap.tsx (сгенерирован CapsuleRegistryPlugin, import order = LAYER_INIT_ORDER):
   - Phase globals:   import './registry/wrappers'   ← Object.assign(globalThis, ...) здесь
   - Phase subsystems: import './app-config.gen'     ← registerAliases + createApi
   - Phase render:    import { routeTree } ...       ← TanStack Router
```

**LAYER_INIT_ORDER** — единственная точка контроля порядка загрузки. Добавляешь новый слой → добавляешь запись в `LAYER_INIT_ORDER` в `capsuleRegistry.ts` + пишешь sub-generator. Порядок в `bootstrap.tsx` обновится автоматически.

## Известные грабли

### 🔴 Стабильные

1. **biome-config — config-only пакет.** Нет `src/`/`dist/`. `package.json`: `files: ["biome.json"]` + `exports: { "./biome.json": "./biome.json" }`. Тарбол содержит `biome.json`, внешний consumer пишет `"extends": ["@capsuletech/biome-config/biome.json"]`. `dev:builders` в root исключает пакет (`--filter "!@capsuletech/biome-config"`), потому что у него нет `build`/`dev` — это нормально, не баг.

2. **Compliance allowlist outdated** ([rules.ts](../../packages/builders/compliance/src/rules.ts)) — ссылки на `@capsuletech/style/state/router/ui`, но реальные пакеты теперь `@capsuletech/web-*`. Regex не матчит → каждый widget/page-импорт `@capsuletech/web-ui` → `disallowed-import`. Не падает только потому что `mode: 'warn'`. Тесты `check.test.ts` тоже на старых именах. Фикс — обновить regex + тесты.

3. **vite-builder `bundleDependencies` stale** ([vite.config.mts:23](../../packages/builders/vite/vite.config.mts:23)) — `/^@capsuletech\/shared-compliance/` от старого имени. Должно быть `/^@capsuletech\/compliance/`. Сейчас compliance остаётся external в dist (работает через workspace, но intent комментария нарушен).

### 🟡 По месту

4. **HMRWrappingPlugin матчит wrapper по identifier-name.** Если пишешь `import { Page as MyPage }` — HMR молча сломается. AutoImport инжектит чистые имена, edge case, но знай.

5. **`@babel/traverse` и `@babel/generator` — CJS** — оба плагина (`HMRWrapping`, `compliance/check`) делают `_traverse.default ?? _traverse` interop. Не трогай без понимания, оборачивается ещё одним слоем после ESM-import default.

6. **CapsuleRegistryPlugin.transform defineAppConfig — known limitation** — regex replace bare-identifier; `defineAppConfig` в комментариях тоже превратится в `((__x__)=>__x__)`. Безобидно (identity), но мусорит код. ADR 013 — миграция на explicit-import закрывает class бага. Legacy-bridge остаётся для existing apps.

7. **`vite.config.mts` deep-imports** — `import { staticCopyPlugin } from './src/plugins/staticCopy'` минуя barrel, чтобы esbuild не вытянул `CompliancePlugin → compliance/dist`. Магия не видна из barrel'а. Если кто-то трогает plugins/index.ts — может сломать silently.

8. **Двойной initial-scan ЗАКРЫТ** — `CapsuleRegistryPlugin` использует единый флаг `scanned` и один `walkFiles` на `buildStart`. Больше не дублируется.

9. **Мёртвый код** — `vite/src/utils/generateFromTemplates.ts`, `vite/src/plugins/html.ts` (HtmlPlugin), `vite/src/defines/appConfig.ts:1` (`import { builtinModules }`). Можно удалять без последствий. Файлы `exportGenerator.ts`, `endpointsRegistry.ts`, `appConfig.ts` помечены `@deprecated` в barrel — тоже кандидаты на удаление в следующем major.

10. **CHANGELOG.md в compliance/vite** — 60+ записей "version bump only". Побочка release-group `cli` (fixed). Не actionable.

11. **[[shared-vite-dist]] цикл** — после правок в `packages/builders/vite/src/` обязательно `pnpm --filter @capsuletech/vite-builder build` + рестарт dev-сервера. Без ребилда твоё изменение не видно — apps читают dist/, не src/. Smoke-test: `console.log('[plugin] loaded')` на верхнем уровне (вне transform).

12. **Scaffold templates не попадают в dist автоматически** — `EnsureScaffoldPlugin` при runtime'е читает `.template`-файлы из `dist/plugins/scaffold/template/` (через `__dirname`). Но `libConfig` / rollup не копируют non-JS ресурсы — нужна явная запись в `staticCopyPlugin` в `vite/vite.config.mts`. Если добавить новый `.template`-файл в `src/` без добавления в `staticCopyPlugin` → `copyFile` бросит ENOENT при запуске dev-сервера, scaffold тихо ломается. Фикс уже применён (2026-05-20): `scaffold/template` копируется в `dist/plugins/scaffold/template/`.

13. **[CLOSED 2026-05-28] Layer init ordering — ESM hoisting TDZ.** Fix: `wrappers.ts` выполняет `Object.assign(globalThis, ...)` как top-level side-effect. `bootstrap.tsx` теперь **генерируется** `CapsuleRegistryPlugin` по `LAYER_INIT_ORDER` — порядок фаз (globals → subsystems → render) невозможно нарушить случайно.

## Что менять когда

| Хочу… | Куда лезть |
|---|---|
| Добавить новый wrapper-слой (например `Layout`) | `vite/src/plugins/constants.ts > WRAPPER_NAMES` + `LAYER_TO_NAMESPACE` (если нужен registry) |
| Добавить новую define-фабрику (`defineRoute`/`defineShape`) | `vite/src/plugins/constants.ts > DEFINE_FACTORIES` |
| **Добавить новый генерируемый слой с контролем порядка загрузки** | `vite/src/plugins/capsuleRegistry.ts > LAYER_INIT_ORDER` (новая запись) + stateless sub-generator + `generateBootstrap()` подхватит автоматически |
| Добавить новый Vite-плагин (не codegen) | `vite/src/plugins/<name>.ts` + barrel `plugins/index.ts` + регистрация в `capsuleConfig.ts > plugins[]` |
| Расширить compliance allowlist для app | НЕ править `rules.ts`. Передавай `extraAllowed: { feature: [/^@my\/api/] }` в `CompliancePlugin({ extraAllowed })` |
| Добавить новое нарушение в линтер | `compliance/src/check.ts > IViolation['kind']` + handler в `traverse()` + `format.ts > ICONS` + тест в `check.test.ts` |
| Поменять Rollup external-policy для lib | `lib/src/libConfig.ts > rollupExternalSelector` или передавай `bundleDependencies: […]` |
| Добавить новый статический scaffold-файл | `vite/src/plugins/scaffold/template/<name>.template` + `vite/src/plugins/scaffold/index.ts > FILES` + `vite/vite.config.mts > staticCopyPlugin` |
| Поменять формат route-файла | `vite/src/plugins/router/index.ts > ROUTE_TEMPLATE` (inline string) |
| Поменять формат `wrappers.ts` или `slots.d.ts` | `vite/src/plugins/capsuleRegistry.ts > generateWrappersRuntime / generateWrappersTypes` |
| Поменять формат `endpoints.ts` или `api.d.ts` | `vite/src/plugins/capsuleRegistry.ts > generateEndpointsRuntime / generateEndpointsTypes` |
| Поменять формат `app-config.gen.ts` | `vite/src/plugins/capsuleRegistry.ts > generateAppConfigRuntime` |
| Поменять порядок import'ов в `bootstrap.tsx` | `vite/src/plugins/capsuleRegistry.ts > LAYER_INIT_ORDER` |
| Поменять biome-правила | `biome/biome.json` (root репо подхватит через extends) |

## Связь с другими подсистемами

- [[api-middleware]] — `CapsuleRegistryPlugin` (generateEndpointsRuntime + generateAppConfigRuntime) собирают рантайм для `services.api`
- [[004-compliance-linter|ADR 004]] — обоснование линтера (warn → error)
- [[010-builders-split|ADR 010]] — почему 4 пакета вместо 1, почему `lib-builder` zero-deps
- [[013-explicit-define-app-config|ADR 013]] — почему `defineAppConfig` теперь explicit-import, что осталось от legacy-bridge
- [[vite-plugins]] — user-facing description 5 плагинов (compliance/HMR/router/export/scaffold/etc)
- [[compliance|@capsuletech/compliance]] — user-facing
- [[cli|@capsuletech/cli]] — actions из `actions.ts` дёргаются именно оттуда

## Cross-links

- User-doc: [[builders]]
- Релиз-группа: см. `nx.json > release.groups.cli` — `vite-builder`/`compliance`/`lib-builder` версионируются вместе с CLI
