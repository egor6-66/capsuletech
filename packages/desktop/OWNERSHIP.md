---
name: "@capsuletech/desktop"
owner-agent: owner-desktop
group: cli
status: pre-1.0
last-updated: 2026-05-23
---

# @capsuletech/desktop

Tauri-shell host для capsule apps. Library с public API `runDev`/`runBuild` (orchestrate Vite + Tauri) + pre-built бинарь (`dist/bin/capsule-desktop[.exe]`). Дёргается из `@capsuletech/cli` командой `capsule desktop dev|build <app>`.

> [!warning] Status: skeleton (фаза 1, PR 1/8)
> Контракт зафиксирован в [ADR 017](../../docs/01-architecture/adr/017-desktop-package.md). Имплементация в PR 2-8. На текущий момент пакет содержит только package.json + этот OWNERSHIP.md.

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

_На текущий момент пусто — пакет skeleton. Будет наполняться в PR 2/3._

Предсказуемые грабли (мигрируют из `scripts/desktop.mjs` в PR 3):
- Override-файл `.tauri.<app>.json` нужен только пока tauri-процесс жив — cleanup на SIGINT/SIGTERM/exit/uncaughtException (`scripts/desktop.mjs:124-145`).
- Windows `--bundles` явный CLI flag — `tauri 2.x --config <file>` иногда лотерея с merge'ом `bundle.targets` (`scripts/desktop.mjs:114-119`).
- Параметризация в Tauri config: `productName`, `identifier`, `version`, `build.{devUrl,frontendDist,beforeDevCommand,beforeBuildCommand}`, `app.windows[]`, `bundle.active` — все эти поля override'аются на лету.

## План рефакторинга / оптимизаций

PR 1-8 (см. ADR 017 Roadmap):

- [ ] **PR 1** ADR 017 + skeleton + owner-desktop agent _(in progress)_
- [ ] **PR 2** Crate move `backend/desktop/` → `packages/desktop/native/`. `backend/Cargo.toml` обновить, убрать `"desktop"` из workspace.members. Cargo standalone (`edition = "2021"`, `version = "0.1.0"`)
- [ ] **PR 3** JS wrapper + build pipeline. `scripts/desktop.mjs` логика → `src/`. `pnpm build` собирает Rust crate + копирует бинарь в `dist/bin/`
- [ ] **PR 4** Config type расширение — секция `desktop` в `defineCapsuleConfig`. Coordinated с owner-builders
- [ ] **PR 5** CLI command — `capsule desktop dev/build <app>` импортирует `runDev`/`runBuild` напрямую (вместо `execa scripts/desktop.mjs`). Coordinated с owner-cli
- [ ] **PR 6** Verdaccio publish — добавить `@capsuletech/desktop` в `nx.json:release.groups.cli`. Smoke в `capsule-test`. Coordinated с owner-tests
- [ ] **PR 7** Docs — `docs/_meta/desktop.md` + `docs/09-backend/desktop.md`. Coordinated с docs-writer
- [ ] **PR 8** Cleanup — удалить `scripts/desktop.mjs`, alias из root `package.json`, обновить `CLAUDE.md` секцию Desktop

## Test coverage

| Тип | Где | Что покрывает |
|---|---|---|
| Unit | `src/__tests__/override.test.ts` (PR 3) | scaffolding override config — input → expected `.tauri.<app>.json` |
| Integration | `src/__tests__/runner.test.ts` (PR 3) | child-process orchestration — mock tauri CLI, проверить spawn args + cleanup |
| E2E | `packages/cli/e2e/` (PR 6 расширение) | `capsule desktop dev sandbox` — Tauri окно открывается + devUrl connects |

Перед изменением:
```bash
pnpm --filter @capsuletech/desktop test
```

Перед release:
```bash
pnpm test:e2e:cli   # включает desktop smoke (после PR 6)
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
