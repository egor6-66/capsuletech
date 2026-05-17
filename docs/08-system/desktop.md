---
tags: [hca, system, desktop, tauri]
status: documented
---

# 🖥️ Desktop (Tauri 2)

**Shell:** `backend/desktop/` (Rust + Tauri 2)
**Bridge:** `scripts/desktop.mjs`
**CLI:** `capsule desktopDev` / `capsule desktopBuild` (`packages/cli/src/{actions,commands}/desktop.ts`)

Одна Rust-обёртка для **всех** `apps/<app>`. Сами апп ничего про Tauri не знают — `scripts/desktop.mjs` на лету пишет override `.tauri.<app>.json` (productName / identifier / version / devUrl или frontendDist) и дёргает `pnpm exec tauri` из `backend/desktop/`.

> [!important]
> Контракт намеренно простой: **один процесс = одна ответственность**. Скрипт **не** поднимает Vite и **не** запускает `capsule build` за тебя — это твоя задача (или CI). Скрипт цепляется к уже готовому Vite (dev) или к уже собранному dist (build).

## Для людей — как запустить локально

### Dev (живой режим с HMR)

Нужно **два терминала**:

```bash
# Терминал 1: Vite на порту из capsule.config.ts (sandbox = 2233)
cd apps/sandbox && pnpm dev

# Терминал 2: Tauri-shell поверх него
cd apps/sandbox && node ../../packages/cli/bin/capsule.mjs
#   → выбрать "💻 Desktop dev"
#   → URL: http://localhost:2233   (или то, что напечатал Vite)
```

или одной командой:

```bash
pnpm desktop sandbox --url=http://localhost:2233
```

> [!warning]
> URL **обязан** совпадать с тем, что напечатал Vite в первом терминале. Дефолтные порты у разных приложений разные — смотри `apps/<app>/capsule.config.ts → devServerPort`.

**Первый запуск долгий.** Cargo компилирует tauri 2.x и зависимости — 5–15 минут на машине без кэша. Видишь в логе `Compiling tauri v2...` — это нормально, **подожди**. Окно открывается **после** компиляции, с заголовком = `productName` (по дефолту PascalCase от имени app).

**Если окно не открывается** — проверь:
- запущен ли Vite на указанном URL (`curl http://localhost:2233`);
- нет ли в логе ошибок `error[Exxxx]`/`failed to compile` (тогда падение, не зависание);
- `pnpm exec tauri --version` отрабатывает из `backend/desktop/` (если нет — `pnpm install`).

### Build (.msi / .nsis installer)

```bash
# 1. Собери фронт apps/<app> — это создаёт apps/<app>/dist/
cd apps/sandbox && node ../../packages/cli/bin/capsule.mjs build

# 2. Собери Tauri-бандл
pnpm desktop:build sandbox --version=0.1.0
```

Результат лежит **не** в `backend/desktop/target/`, а в общем cargo-workspace target:

```
backend/target/release/bundle/
├── msi/   *.msi    ← WiX installer (Windows)
└── nsis/ *.exe    ← NSIS installer (Windows)
```

> [!note]
> WiX и NSIS подтягиваются `tauri-cli` автоматически на первом запуске bundle — `choco install` не нужен.

### CI релиз

`.github/workflows/desktop-release.yml` — кнопка «Run workflow» → выбираешь app/version/draft → GitHub Action прогоняет:
1. `pnpm nx run-many -t build` для bootstrap-цепочки CLI;
2. `capsule build` для `apps/<app>`;
3. `node scripts/desktop.mjs build <app> --version=<v>`;
4. Соберёт всё из `backend/target/release/bundle/{msi,nsis}` и приложит к GitHub Release `desktop/<app>-v<version>`.

## Для агентов — AI-anchor

> [!ai-anchor]
> Эта секция читается LLM-агентами. Если меняешь правила — обновляй её, а не молчаливо ломай инвариант.

**Слой:** Desktop **не** добавляет нового HCA-слоя. Это инфраструктура, обёртка вокруг готового `apps/<app>`. У Entity/Controller/Feature/Widget/Page **нет** desktop-специфичных API на текущий момент. Tauri-API подключаем по необходимости позже, тогда появятся отдельные services/контроллеры.

**Жёсткие пути (легко перепутать):**

| Что | Где | Почему именно так |
|---|---|---|
| Vite output | `apps/<app>/dist/` | `outDir` форсирован в `capsuleConfig.ts`. **Не** `.capsule/dist/`. Vite ругается «outside of root» — это намеренно. |
| Tauri/Cargo output | `backend/target/release/bundle/{msi,nsis}/*` | `backend/` это cargo workspace, target общий. **Не** `backend/desktop/target/`. |
| Override tauri config | `backend/desktop/.tauri.<app>.json` | пишется `scripts/desktop.mjs` на лету; tauri-cli получает через `--config <file>`. |
| Workspace root для скрипта | `resolve(__dirname, '..')` от `scripts/desktop.mjs` | т.е. корень репо. CLI-action прокидывает `cwd: ctx.root` (`apps/<app>`) — но скрипт сам резолвит пути от своего расположения. |

**Что НЕ делает `scripts/desktop.mjs`:**
- не запускает Vite (`beforeDevCommand: ''` в override — пусто намеренно);
- не делает `capsule build` (`beforeBuildCommand: ''`);
- не валидирует версию (`--version` принимается as-is).

Это контракт: orchestration снаружи (терминалы/CI), скрипт — тонкая прослойка.

**`bundle.active` лотерея.** Tauri 2.x при `--config <override>` иногда не мержит `bundle.targets: "all"` из base. Поэтому на Windows в `build`-режиме скрипт **форсит** `--bundles msi,nsis` через CLI-флаг (см. `scripts/desktop.mjs:110-118`). Если меняешь набор бандлов — правь и base `tauri.conf.json`, и `explicitBundles`. **Не полагайся на merge.**

**`isDev` в `capsuleConfig.ts`.** Для CI/build обязательно `isDev: false` — иначе `build.watch: {}` оставляет Vite в watch-mode, `capsule build`-step не выходит, CI-job висит до таймаута. См. [[shared-vite-dist-only]] про необходимость ребилда shared-vite после правок `capsuleConfig.ts`.

**Параметризация per-app:** `apps/<app>/package.json:capsule.{productName,identifier}` (опционально). Если нет — дефолты:
- `productName` = PascalCase от имени app;
- `identifier` = `tech.capsule.<app-stripped>`.

**Когда правишь связанное:**

- меняешь `outDir` в Capsule config → проверь `scripts/desktop.mjs:94` (default `apps/<app>/dist`);
- меняешь cargo workspace structure → правь `.github/workflows/desktop-release.yml` (path для `Get-ChildItem $bundleRoot`);
- добавляешь bundle target (deb/dmg) → правь и `tauri.conf.json:bundle.targets`, и `explicitBundles` в скрипте;
- меняешь `package.json:capsule.*` контракт → обнови таблицу выше.

**Чего здесь пока нет (намеренно, не плодить TODO):**
- single-command flow «Vite + Tauri» (он будет в `capsule desktop dev` orchestrator'е, не сейчас);
- Tauri-API surface для frontend (commands, events) — добавится когда появится первая фича, которая в браузере не работает;
- macOS/Linux bundle target'ы в CI (workflow только `windows-latest`).

## Связанное

- [[cli|💻 CLI]] — команды `desktopDev`/`desktopBuild` живут в `packages/cli/src/{actions,commands}/desktop.ts`.
- [[releases|🚀 Releases]] — npm-релизы пакетов, **не** desktop. Desktop-релизы → `.github/workflows/desktop-release.yml`.
- [[vite-plugins|🛠️ Vite-плагины]] — `outDir` контракт прокинут через `@capsuletech/vite-builder`.
