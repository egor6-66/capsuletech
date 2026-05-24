---
name: "@capsuletech/desktop"
owner-agent: owner-desktop
group: cli
status: pre-1.0
last-updated: 2026-05-23
---

# @capsuletech/desktop

Tauri-shell host для capsule apps. Library с public API `runDev`/`runBuild` (orchestrate Vite + Tauri) + pre-built бинарь (`dist/bin/capsule-desktop[.exe]`). Дёргается из `@capsuletech/cli` командой `capsule desktop dev|build <app>`.

> [!info] Status: JS wrapper + build pipeline implemented (PR 3/8)
> JS wrapper (`src/`) + build pipeline (`scripts/`) завершены. `runDev`/`runBuild` API готов. Следующее: PR 4 (config type, owner-builders) → PR 5 (CLI action, owner-cli).

## Зона ответственности

### Owns

- `packages/desktop/src/` — JS wrapper (PR 3): `runDev`, `runBuild`, override scaffolding, child-process orchestration, types
- `packages/desktop/native/` — Rust crate (PR 2): Tauri shell, `Cargo.toml`, `tauri.conf.json`, `src/{main.rs,lib.rs}`, `capabilities/`, `icons/`, `build.rs`
- `packages/desktop/scripts/` — build helpers (PR 3): `build-native.mjs` (platform-dependent копирование бинаря)
- `packages/desktop/vite.config.mts` (PR 3) — lib build через `@capsuletech/lib-builder`
- `packages/desktop/package.json` — exports / deps / scripts
- `packages/desktop/tsconfig.json` (PR 3)

### Не трогает

- `packages/cli/src/actions/desktop.ts` — CLI action (owner-cli)
- `packages/cli/src/commands/desktop.ts` — Command декларация (owner-cli)
- `backend/scriber/`, `backend/fs/` — sibling Rust зоны (owner-scriber для scriber, главный для shared fs)
- `backend/Cargo.toml` — workspace members + deps (главный, в PR 2 убирает `"desktop"` из members)
- `apps/<app>/capsule.config.ts` — framework-developer scope (но **тип** `desktop` section реэкспортируется отсюда — coordinated через owner-builders в PR 4)
- `nx.json:release.groups.cli` — главный (в PR 6 добавляет `@capsuletech/desktop` в group)
- Root-level `package.json`, `tsconfig.base.json`, `CLAUDE.md` — главный

## Публичный API (планируемый, финализируется в PR 3)

```ts
// @capsuletech/desktop (.)
export interface IDesktopConfig {
  productName: string;
  identifier: string;
  icon?: string;
  window?: {
    width?: number;
    height?: number;
    minWidth?: number;
    minHeight?: number;
    title?: string;
  };
}

export interface RunDevOptions {
  app: string;
  devUrl: string;
  desktop: IDesktopConfig;
  cwd?: string;
}

export interface RunBuildOptions {
  app: string;
  dist: string;
  desktop: IDesktopConfig;
  version: string;
  cwd?: string;
}

export function runDev(opts: RunDevOptions): Promise<void>;
export function runBuild(opts: RunBuildOptions): Promise<void>;
```

Никакого `bin` поля — это library. `dist/bin/capsule-desktop[.exe]` — internal asset, не CLI entry.

## Quirks / gotchas

Мигрированы из `scripts/desktop.mjs` + новые из PR 3:

1. **Override-файл cleanup идемпотентный.** `cleanedUp` flag + `existsSync` + try/catch в `runner.ts:cleanupOverride`. SIGINT/SIGTERM/exit/uncaughtException — все сходятся в одну функцию. Без идемпотентности double-unlink бросает.

2. **Windows `--bundles` явный CLI flag.** `process.platform === 'win32' && kind === 'build'` → `['--bundles', 'msi,nsis']` в argv. `tauri build --config <file>` merge с `bundle.targets:"all"` ненадёжен — build выходит 0, `target/release/bundle/` пустой.

3. **`spawn` с `shell: true` обязательно.** На Windows pnpm не находится через PATH без `shell: true`. На Unix тоже OK.

4. **`cwd: nativeDir` обязателен для tauri spawn.** Tauri CLI ищет `tauri.conf.json` относительно cwd. Если cwd = workspace root — fail.

5. **`CAPSULE_APP` / `CAPSULE_WORKSPACE_ROOT` env vars** прокидываются в child process. Сохранено из `scripts/desktop.mjs:164` для обратной совместимости.

6. **`.tauri.<app>.json` — per-app имя файла.** Позволяет параллельный запуск двух app'ов (sandbox + agent) одновременно без коллизии файлов.

7. **`beforeDevCommand` / `beforeBuildCommand` всегда пустые.** Tauri иначе попытается запустить свой Vite. Capsule управляет Vite через `@capsuletech/vite-builder`. Обязательный override.

8. **`identifier` — обязательный параметр.** В отличие от старого `scripts/desktop.mjs`, fallback из имени app'а убран. Тип `IDesktopConfig.identifier: string` (не optional). User получает ошибку компиляции если не задал.

9. **Dist `__tests__/` в dts output.** Решено через `tsconfig.json:exclude: ["src/**/__tests__/**"]` — libConfig dts плагин читает этот tsconfig и не эмитит тестовые .d.ts файлы.

10. **`cargo build --release` node-deprecation warning** о `shell: true` с args. Это Node.js DEP0190 (args + shell). Не критично для build-time скрипта — `spawnSync` с `shell: true` нужен на Windows для `cargo` через PATH.

11. **Build pipeline разделён** (PR 3, CI compat). `pnpm build` = только vite (JS-артефакты, CI-friendly). `pnpm build:native` = cargo + copy бинаря в `dist/bin/` (требует Tauri OS deps + Rust toolchain). `pnpm build:all` = full local pipeline. CI собирает только JS (через `pnpm nx run-many -t build`); бинарь собирается перед release publish — локально (фаза 1) или matrix-build (фаза 2).

12. **`prepack` hook = `node scripts/build-native.mjs`** (PR 6). На каждый `pnpm publish` (release-local.mjs или ручной) cargo build + copy запускается автоматически перед pack — гарантирует `dist/bin/capsule-desktop.exe` в tarball'е. Idempotent (cargo cache); fresh build ~1-2 min, cached ~1-5s. Без prepack tarball был бы broken — `runDev`/`runBuild` consumer'ов (`@capsuletech/cli`) не нашли бы бинарь.

## План рефакторинга / оптимизаций

PR 1-8 (см. ADR 017 Roadmap):

- [x] **PR 1** ADR 017 + skeleton + owner-desktop agent
- [x] **PR 2** Crate move `backend/desktop/` → `packages/desktop/native/`. `backend/Cargo.toml` обновить, убрать `"desktop"` из workspace.members. Cargo standalone (`edition = "2021"`, `version = "0.1.0"`)
- [x] **PR 3** JS wrapper + build pipeline. `scripts/desktop.mjs` логика → `src/`. `pnpm build` = только vite (JS); `pnpm build:native` = cargo + binary copy; `pnpm build:all` = full local pipeline
- [ ] **PR 4** Config type расширение — секция `desktop` в `defineCapsuleConfig`. Coordinated с owner-builders
- [ ] **PR 5** CLI command — `capsule desktop dev/build <app>` импортирует `runDev`/`runBuild` напрямую (вместо `execa scripts/desktop.mjs`). Coordinated с owner-cli
- [x] **PR 6** Verdaccio publish — `@capsuletech/desktop` добавлен в `nx.json:release.groups.cli` + `scripts/release-local.mjs` (главный). `prepack` hook гарантирует `dist/bin/` в tarball'е. Smoke в `capsule-test` — coordinated с owner-tests
- [ ] **PR 7** Docs — `docs/_meta/desktop.md` + `docs/09-backend/desktop.md`. Coordinated с docs-writer
- [ ] **PR 8** Cleanup — удалить `scripts/desktop.mjs`, alias из root `package.json`, обновить `CLAUDE.md` секцию Desktop

## Test coverage

| Тип | Где | Что покрывает |
|---|---|---|
| Unit | `src/__tests__/override.test.ts` (PR 3) | scaffolding override config — input → expected `.tauri.<app>.json` |
| Integration | `src/__tests__/runner.test.ts` (PR 3) | child-process orchestration — mock tauri CLI, проверить spawn args + cleanup |
| E2E | `packages/cli/e2e/` (PR 6 расширение) | `cd apps/sandbox && capsule desktop dev` — Tauri окно открывается + devUrl connects (имя app'а через `ctx.name`, не positional) |

Перед изменением:
```bash
pnpm --filter @capsuletech/desktop test
```

Перед release:
```bash
pnpm test:e2e:cli   # включает desktop tarball assertion (после PR 6)
```

## Cross-package dependencies

| Зона | Owner |
|---|---|
| `@capsuletech/cli` — action `capsule desktop dev/build` импортирует `runDev`/`runBuild` | owner-cli |
| `@capsuletech/vite-builder` — тип `defineCapsuleConfig.desktop` реэкспортируется | owner-builders |
| `@capsuletech/lib-builder` — vite lib config для `src/` build | owner-builders |
| `backend/scriber/` — sibling Rust crate, отдельный workspace (`backend/Cargo.toml`) | owner-scriber |
| `apps/agent/` — будущий consumer (Tauri desktop для scriber, см. owner-scriber Roadmap PR-4) | будущий app-agent owner |

## Release group

`cli` (fixed versioning, tag `cli@{version}`, добавляется в PR 6):
- `@capsuletech/cli`
- `@capsuletech/compliance`
- `@capsuletech/desktop` _(this package, после PR 6)_
- `@capsuletech/lib-builder`
- `@capsuletech/vite-builder`

(Также `@capsuletech/shared-file-manager` упомянут в owner-cli.md как часть группы, но в `nx.json` отсутствует — drift, не моя зона, эскалация owner-deps.)

После изменений в этом пакете — координировать release через главного:
```bash
pnpm release:local:cli   # Verdaccio publish
```

При breaking change в API `runDev`/`runBuild` — согласовать с owner-cli перед release (cli action ломается на drift'е).

## Связанное

- [ADR 017](../../docs/01-architecture/adr/017-desktop-package.md) — контракт пакета
- [docs/_meta/desktop.md](../../docs/_meta/desktop.md) — AI-anchor (после PR 7)
- [docs/09-backend/desktop.md](../../docs/09-backend/desktop.md) — user-guide для агентов `capsule-agent-app` (после PR 7)
- [CLAUDE.md](../../CLAUDE.md) — POLICY section + Desktop секция (обновляется в PR 8)
- [.claude/agents/owner-desktop.md](../../.claude/agents/owner-desktop.md) — agent definition
- [.claude/agents/owner-scriber.md](../../.claude/agents/owner-scriber.md) — sibling Rust ownership, образец стиля
- [Tauri 2 docs](https://v2.tauri.app/)
