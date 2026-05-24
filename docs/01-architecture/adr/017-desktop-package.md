---
tags: [hca, adr, implemented]
status: implemented
date: 2026-05-23
---

# ADR 017 — Desktop package extraction (`@capsuletech/desktop`)

> [!success] Status: implemented (2026-05-23)
> Phase 1 закрыт: 8 PR'ов merged (PR 1 ccdecee → PR 8 cleanup). `@capsuletech/desktop` живёт в `packages/desktop/`, CLI command `capsule desktop dev|build <app>`, Verdaccio publish работает, docs в `docs/09-backend/desktop.md` + `docs/_meta/desktop.md`. Phase 2 (multi-platform) — отдельный ADR при появлении триггера.

## Контекст

На текущий момент Tauri-shell для приложений capsule живёт в `backend/desktop/` — Rust-crate'е, шарящем `backend/Cargo.toml` workspace с `backend/scriber/` и `backend/fs/`. Запуск/сборка делаются через `scripts/desktop.mjs` (root) — он:

1. Читает `apps/<app>/package.json` (поля `name`, `capsule.productName`, `capsule.identifier`, `version`).
2. Пишет временный override `backend/desktop/.tauri.<app>.json` с параметризацией productName/identifier/version и build-секцией (`devUrl` для dev, `frontendDist` для build).
3. Вызывает `pnpm exec tauri <dev|build> --config <override>` внутри `backend/desktop/`.
4. Чистит override на любом exit (SIGINT/SIGTERM/uncaughtException/нормальный exit).

Альяcы в root `package.json`:

```jsonc
"desktop":       "node scripts/desktop.mjs dev",
"desktop:build": "node scripts/desktop.mjs build"
```

Сейчас этот flow работает **только внутри capsule monorepo** (один PC, один пользователь — framework developer). External user'ы (тестовые агенты в `capsule-agent-app`) доступа к shell'у не имеют, потому что:

- `backend/desktop/` не публикуется как npm-пакет.
- `scripts/desktop.mjs` лежит в `scripts/` root'а, не доступен снаружи.
- Tauri CLI требует `tauri.conf.json` рядом с Rust crate'ом — переезд за пределы monorepo текущим flow невозможен.

## Проблема

**1. External consumer'ы не могут использовать shell.** Запланирован `capsule-agent-app` — внешний repo на нашем же PC, который должен потреблять `@capsuletech/desktop` через локальный Verdaccio (как сейчас `capsule-test` потребляет `@capsuletech/cli`, `@capsuletech/web-*` и т.д.). Текущая раскладка этому не позволяет.

**2. `scripts/desktop.mjs` — root-level shared infra.** Это «костыль» эпохи single-developer. Логика scaffolding override + child-process orchestration должна быть **частью пакета**, а не root-script'а — иначе её невозможно версионировать вместе с потребителем.

**3. Параметризация через `apps/<app>/package.json:capsule.{productName, identifier}`** — недокументированный contract, разбросанный по `scripts/desktop.mjs:69-73`. User не знает где задать эти параметры. Нужна явная типизированная секция в `capsule.config.ts`.

**4. Команда `desktop` уже есть в `@capsuletech/cli` (см. `packages/cli/OWNERSHIP.md` — категория `desktop` с `desktop dev`/`desktop build`)** — но action'ы дёргают `scripts/desktop.mjs` через `execa`, а не используют structured API. Это второй слой костыля.

**5. У `apps/agent/` (будущий Tauri-desktop frontend для `backend/scriber/`) тот же запрос** — он сам внутри monorepo, но логически — внешний consumer shell'а. Текущий flow для него тоже работает только через root-script.

## Решение

### 1. Создаём `packages/desktop/` — самостоятельный npm-пакет `@capsuletech/desktop`

```
packages/desktop/
├── package.json              @capsuletech/desktop (library, не bin)
├── OWNERSHIP.md              owner: owner-desktop
├── tsconfig.json
├── vite.config.mts           lib build (через @capsuletech/lib-builder)
├── src/
│   ├── index.ts              public API: runDev, runBuild + types
│   ├── override.ts           логика scaffold override config (из scripts/desktop.mjs)
│   ├── runner.ts             child-process orchestration (из scripts/desktop.mjs)
│   └── types.ts              IDesktopConfig, RunDevOptions, RunBuildOptions
├── native/                   Rust crate (переезжает из backend/desktop/)
│   ├── Cargo.toml            standalone (не workspace-member backend/)
│   ├── tauri.conf.json
│   ├── build.rs
│   ├── capabilities/
│   ├── icons/
│   └── src/{main.rs, lib.rs}
└── dist/
    ├── index.mjs / index.d.ts     JS API
    └── bin/                       pre-built бинарь (current platform)
        └── capsule-desktop[.exe]
```

### 2. Public API `@capsuletech/desktop`

```ts
// packages/desktop/src/types.ts
export interface IDesktopConfig {
  productName: string;        // имя в window title + identifier fallback
  identifier: string;         // bundle identifier (com.example.app)
  icon?: string;              // path to .ico/.icns (default — built-in capsule icon)
  window?: {
    width?: number;           // default 1280
    height?: number;          // default 800
    minWidth?: number;        // default 800
    minHeight?: number;       // default 600
    title?: string;           // default — productName
  };
}

export interface RunDevOptions {
  app: string;                // имя app'а (для override file)
  devUrl: string;             // URL Vite-сервера, к которому подключается shell
  desktop: IDesktopConfig;    // секция из capsule.config.ts
  cwd?: string;               // workspace root (default process.cwd())
}

export interface RunBuildOptions {
  app: string;
  dist: string;               // absolute path к собранному фронту
  desktop: IDesktopConfig;
  version: string;            // bundle version (semver)
  cwd?: string;
}

export function runDev(opts: RunDevOptions): Promise<void>;
export function runBuild(opts: RunBuildOptions): Promise<void>;
```

Никакого `bin` поля — это library, дёргается из `@capsuletech/cli`.

### 3. Tauri-shell — distrib через `dist/bin/`

`pnpm build` пакета:

1. `cargo build --release --manifest-path native/Cargo.toml`
2. Копирует `native/target/release/capsule-desktop[.exe]` → `dist/bin/capsule-desktop[.exe]`
3. Vite-builder собирает `src/` → `dist/index.mjs` + types

При publish в Verdaccio:
- `package.json:files` включает `dist/` (с `dist/bin/`)
- `dist/bin/capsule-desktop[.exe]` едет в tarball
- Размер пакета: ~10-30MB (Tauri binary minimal без bundle assets)

**Single-platform на фазе 1.** Бинарь собирается на машине разработчика (Windows-x64) и работает только на той же платформе. `capsule-agent-app` и `capsule-test` — на том же PC, конфликта нет.

### 4. Параметризация — секция `desktop` в `capsule.config.ts`

```ts
// apps/sandbox/capsule.config.ts
export default defineCapsuleConfig({
  devServerPort: 3000,
  desktop: {
    productName: 'Sandbox',
    identifier: 'tech.capsule.sandbox',
    icon: 'src/assets/icon.ico',
  },
});
```

`@capsuletech/vite-builder` расширяет тип `defineCapsuleConfig` опциональным полем `desktop?: IDesktopConfig` (реэкспортирует тип из `@capsuletech/desktop`). Сам vite-builder секцию не использует — её читает `@capsuletech/cli` через `importModule('capsule.config.ts')`.

### 5. CLI команда `capsule desktop dev|build <app>`

```ts
// packages/cli/src/actions/desktop.ts
import { runDev, runBuild } from '@capsuletech/desktop';
import { importModule } from '../utils/cvd.ts';

export const desktopDev: CommandAction = async (ctx, { app, url }) => {
  const config = await importModule(`apps/${app}/capsule.config.ts`, ctx.workspaceRoot);
  if (!config.desktop) throw new Error(`apps/${app}/capsule.config.ts — missing 'desktop' section`);
  await runDev({
    app,
    devUrl: url ?? `http://localhost:${config.devServerPort ?? 5173}`,
    desktop: config.desktop,
    cwd: ctx.workspaceRoot,
  });
};
```

Аналогично `desktopBuild`. Существующая category `desktop` в CLI остаётся — меняется только action implementation (с `execa scripts/desktop.mjs` → direct import).

### 6. Release group — `cli` (fixed)

`@capsuletech/desktop` добавляется в `nx.json:release.groups.cli.projects` рядом с `@capsuletech/cli`, `@capsuletech/vite-builder`, `@capsuletech/compliance`, `@capsuletech/lib-builder`. Bump одной версией, tag `cli@{version}`.

Причина — CLI command `capsule desktop` напрямую импортирует `@capsuletech/desktop`. Drift версий = runtime breakage. Fixed group этого избегает.

### 7. Cleanup root

После завершения migration:
- `scripts/desktop.mjs` — удалить.
- `package.json:scripts.desktop` / `desktop:build` — удалить.
- `backend/desktop/` — удалить (переехало в `packages/desktop/native/`).
- `backend/Cargo.toml:workspace.members` — убрать `"desktop"`.
- `CLAUDE.md` — обновить раздел Desktop под новый flow (`cd apps/<app> && pnpm capsule desktop dev` вместо `pnpm desktop <app>`). Имя app'а auto-detect через `ctx.name`, не positional argument.

## Реализационные детали

### Order of work (8 PR'ов)

| # | PR | Owner | Scope |
|---|---|---|---|
| 1 | ADR 017 + skeleton + owner-desktop agent | architect | этот файл + `packages/desktop/{package.json,OWNERSHIP.md}` + `.claude/agents/owner-desktop.md` |
| 2 | Crate move | owner-desktop | `backend/desktop/` → `packages/desktop/native/`. `backend/Cargo.toml` обновить. `scripts/desktop.mjs` временно правится на новый путь до PR 3 |
| 3 | JS wrapper + build pipeline | owner-desktop | `scripts/desktop.mjs` логика → `packages/desktop/src/`. Public API `runDev`/`runBuild`. `pnpm build` собирает Rust crate + копирует бинарь в `dist/bin/` |
| 4 | Config type | owner-builders + architect | секция `desktop` в типе `defineCapsuleConfig`. Тип реэкспортируется из `@capsuletech/desktop` |
| 5 | CLI command | owner-cli | `capsule desktop dev/build` action импортирует `@capsuletech/desktop` напрямую (вместо `execa scripts/desktop.mjs`). Имя app'а auto-detect через `ctx.name` (`cd apps/<app>/` обязателен), positional argument **не принимается** — фикс bug #17 |
| 6 | Verdaccio + smoke | owner-tests | `@capsuletech/desktop` в `nx.json:release.groups.cli`. Smoke в `capsule-test`: `cd apps/sandbox && capsule desktop dev` → Tauri окно открывается + devUrl connects |
| 7 | Docs | docs-writer | `docs/_meta/desktop.md` (AI-anchor) + `docs/09-backend/desktop.md` (user-guide для агентов `capsule-agent-app`) |
| 8 | Cleanup | architect | удалить `scripts/desktop.mjs`, alias из root `package.json`, обновить `CLAUDE.md` |

PR'ы мерджатся **строго последовательно** (каждый ждёт CI green предыдущего перед стартом), потому что:
- PR 2 не стартует пока PR 1 (skeleton) не в main — иначе owner-desktop делает изменения в несуществующей директории.
- PR 3 зависит от PR 2 (Rust crate уже в `packages/desktop/native/`).
- PR 5 зависит от PR 3 (импортирует `@capsuletech/desktop`).
- PR 6 зависит от PR 5 (smoke сценарий тестирует CLI команду).
- PR 8 зависит от PR 6 (cleanup только когда новый flow доказан smoke'ом).

### Rust workspace decision

`packages/desktop/native/Cargo.toml` — **standalone**, **не member** `backend/Cargo.toml` workspace'а. Причина: пакет должен билдиться независимо от `backend/scriber/*` (consumer'у `@capsuletech/desktop` Rust toolchain не нужен для install'а; нам — нужен только для нашего собственного build pipeline).

Workspace inheritance (`edition.workspace`, `version.workspace`) теряется — заменяется на явные `edition = "2021"` и `version = "0.1.0"` в `packages/desktop/native/Cargo.toml`. Это OK — version там вообще не важна (Rust crate не публикуется как Rust crate).

`backend/desktop/` исчезает из `backend/Cargo.toml:workspace.members`. `backend/fs/` остаётся для `scriber/`, dep на `backend/fs/` у desktop нет (проверено в `backend/desktop/Cargo.toml` — только `tauri`, `serde`, `serde_json`).

### Build pipeline нюанс

`pnpm build` пакета `@capsuletech/desktop` запускает:

```bash
# vite build (для JS API)
vite build

# cargo build (для Rust binary), затем копирование
cargo build --release --manifest-path native/Cargo.toml
cp native/target/release/capsule-desktop{.exe,} dist/bin/  # platform-dependent
```

Реализуется через `package.json:scripts.build`:

```json
"build": "vite build && node scripts/build-native.mjs"
```

`scripts/build-native.mjs` в пакете — small helper, скрывает platform-зависимую logic (Windows .exe vs Unix без расширения).

### Distribution стратегия — фаза 1 vs фаза 2

**Фаза 1 (этот ADR):** Бинарь компилится на машине разработчика (Windows-x64) и кладётся в `packages/desktop/dist/bin/capsule-desktop.exe`. При publish в Verdaccio (`release-local.mjs --group=cli`) `dist/bin/` едет в tarball. Consumer (`capsule-agent-app` на том же PC) `pnpm add @capsuletech/desktop` — получает рабочий бинарь.

**Phase 2 (отдельный ADR):** Matrix-build в CI (GitHub Actions runs-on: macos-14, macos-13, ubuntu-latest, windows-latest) собирает per-platform бинари. Optional deps per platform: `@capsuletech/desktop` становится thin orchestrator, который `package.json:optionalDependencies` ссылается на `@capsuletech/desktop-{darwin-arm64,darwin-x64,linux-x64,win32-x64}`. pnpm ставит только подходящий. Industry-standard (esbuild, swc, biome, @rollup/rollup-*).

Архитектура `dist/bin/` это позволяет без breaking change: фаза 2 заменит копирование бинаря в `dist/bin/` своего пакета на runtime-resolve через `require.resolve('@capsuletech/desktop-${platform}')`.

### Существующая category `desktop` в `@capsuletech/cli`

`packages/cli/OWNERSHIP.md` упоминает category `desktop` с командами `desktop dev`, `desktop build`. Сейчас они дёргают `scripts/desktop.mjs` через `execa`. PR 5 меняет action implementation — сами команды (id, label, scope, category) остаются. UX user'а в TUI не меняется.

Ещё в `packages/cli/OWNERSHIP.md` упомянут open issue:
> 17. **`desktop dev/build` — positional bug.** `url` и `version` не являются настоящими positional args в commander-дереве.

Этот баг fix'ится попутно в PR 5 — `runDev/runBuild` принимают option flags чисто, без positional confusion.

### `apps/agent/` — будущий consumer

`apps/agent/` (Tauri desktop для `backend/scriber/`, см. owner-scriber.md Roadmap PR-4) — внутренний consumer `@capsuletech/desktop`. Он `workspace:*` ссылается на пакет (как любой другой apps/*). После фазы 1 — flow тот же что у sandbox'а.

### Backwards compatibility

**Hard breaking change для framework-developer workflow.**

- `pnpm desktop sandbox` → `cd apps/sandbox && pnpm capsule desktop dev` (новый UX, имя app'а через `ctx.name`).
- Параметризация через `apps/<app>/package.json:capsule.{productName, identifier}` — **удаляется**. Только через `capsule.config.ts:desktop`. Migration: переместить 2-3 поля в новый файл.
- Default `devUrl` меняется с `http://localhost:5173` (хардкод в `scripts/desktop.mjs`) на `http://localhost:${config.devServerPort ?? 5173}` (использует `devServerPort` из `capsule.config.ts`). Это исправление, не регрессия.

Из real consumer'ов — только `apps/sandbox/`. Migration тривиальная.

### Не делаем сейчас

- **Multi-platform distribution** — фаза 2.
- **Installer'ы (.dmg / .msi / .AppImage)** — `runBuild` возвращает raw binary. Полные bundle target'ы (через `cargo tauri build --bundles all`) добавляются после обкатки flow.
- **Code signing** — для installer'ов в фазе 2.
- **Custom Rust extensions для user'а** — shell `native/` зафиксирован, user не может добавить свой Tauri command/plugin. Если запрос появится — отдельный ADR (потенциальный escape hatch: `capsule desktop eject` который копирует `native/` в user-repo).
- **Tauri plugins** (keyring, fs, dialog, etc.) — добавляются по запросу как `tauri` features в `packages/desktop/native/Cargo.toml`.

## Альтернативы, которые мы НЕ взяли

### A. Оставить `backend/desktop/` как есть + публиковать через npm как zip-tarball

Hack. `npm publish` для не-JS-пакета без `package.json` не работает корректно. И главное — не решает проблему параметризации и UX.

### B. CLI scaffold: `capsule desktop init` копирует Rust crate в user-repo

User получает `backend/desktop/` в своём repo + Rust toolchain становится обязательным. Противоречит решению из дискуссии («Rust toolchain у user'а НЕТ»).

### C. Всё в `@capsuletech/cli` (Rust crate как assets пакета cli)

Раздувает cli (~30MB Rust binary в каждом install'е). Cli ставится во **всех** workspace'ах, desktop нужен **не во всех** — это deopt.

### D. `@capsuletech/desktop` без Rust crate — голый JS wrapper, скачивает бинарь из GitHub Releases

Усложняет infra (релиз через GH release-flow для Rust binary параллельно с npm-publish группы cli). Фаза 2 — может быть. Фаза 1 — overkill.

### E. Сохранить параметризацию через `apps/<app>/package.json:capsule.*`

Не типизировано, не документировано, скрытый contract. `capsule.config.ts` — explicit, типизированный, единая точка настройки.

### F. Команда `capsule desktop` без `@capsuletech/desktop` (cli напрямую дёргает Rust binary)

Дублирование. Логика scaffolding override + child-process orchestration — нетривиальная, нужна structured API + tests. Это пакет.

## Последствия

### Положительные

- **External consumer'ы получают доступ.** `capsule-agent-app` через Verdaccio `pnpm add @capsuletech/desktop` → `capsule desktop dev` работает.
- **Параметризация явная и типизированная.** `capsule.config.ts:desktop` — single source of truth, autocomplete, type-checking.
- **CLI command — structured impl.** `runDev/runBuild` — testable API, не shell-orchestration.
- **`apps/agent/` integration cleaner.** Тот же flow что у sandbox, no `scripts/`-coupling.
- **Готова к фазе 2.** Архитектура `dist/bin/` → optional deps per platform — drop-in замена.
- **`backend/` чище.** Остаётся только `scriber/` + `fs/` (LLM-router зона), без mix'а с Tauri shell'ом.

### Отрицательные

- **Hard breaking change** для framework-developer workflow: `pnpm desktop sandbox` → `cd apps/sandbox && pnpm capsule desktop dev`.
- **Параметризация migration** для `apps/sandbox/`: поля из `package.json:capsule` → `capsule.config.ts:desktop`.
- **Build pipeline сложнее** — `pnpm build` пакета теперь дёргает `cargo build`. Нужен Rust toolchain у любого, кто билдит `@capsuletech/desktop` (но не у consumer'а — пакет приходит pre-built).
- **`dist/bin/capsule-desktop.exe` ~10-30MB в tarball.** Размер npm-пакета группы cli растёт на эту величину. Mitigation: фаза 2 переносит в per-platform optional deps (consumer ставит один).
- **Single-platform на фазе 1.** Бинарь работает только на платформе разработчика. Принято осознанно — `capsule-agent-app` и `capsule-test` на том же PC.

### Migration / Roadmap

**Phase 1 — этот ADR (8 PR'ов).** Workspace + Verdaccio + single-platform binary + docs. ETA — несколько сессий.

**Phase 2 — multi-platform distribution.** Matrix-build в CI, optional deps per platform, peer-deps audit. Отдельный ADR. Триггер: запрос на установку с другой OS (включая CI runners для smoke).

**Phase 3 — installer'ы.** `runBuild` опционально emit'ит `.dmg`/`.msi`/`.AppImage` через `cargo tauri build --bundles <list>`. Code signing infrastructure. Триггер: появление готового app'а для дистрибуции (`apps/agent/` финальная упаковка).

**Phase 4 (опционально) — escape hatch.** `capsule desktop eject` для user'ов которым нужен custom Rust. Триггер: первый конкретный запрос.

ADR переходит в `status: implemented` после Phase 1 (PR 8 merged).

## Связанное

- [[004-compliance-linter|ADR 004]] — Compliance (новый пакет проходит обычный compliance check, нет HCA-слоёв)
- [[013-explicit-define-app-config|ADR 013]] — `defineAppConfig` (паттерн для `defineCapsuleConfig.desktop` секции)
- `backend/desktop/` — текущая раскладка (исчезает в PR 2/8)
- `scripts/desktop.mjs` — текущий entry (исчезает в PR 8)
- `packages/cli/OWNERSHIP.md` — category `desktop` + open issue про positional args
- `.claude/agents/owner-scriber.md` — sibling Rust crate ownership, образец для `owner-desktop`
- [Tauri 2 docs](https://v2.tauri.app/) — runtime contract
