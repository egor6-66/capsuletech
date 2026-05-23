---
tags: [hca, adr, proposed]
status: proposed
date: 2026-05-23
---

# ADR 018 — apps/capsule-space (workspace shell + agent management)

> [!info] Status: proposed
> Lightweight ADR для нового desktop приложения `apps/capsule-space` — workspace manager с виджетами для управления контекстом агентов, чата с агентами, файлами проектов. Tauri-only, локальный + cloud + browser-based LLM providers. Phased rollout (6 phases). Расширения к ADR 017 (Tauri shell embed scriber) — отдельный ADR при подходе к Phase 4.

## Контекст

После закрытия ADR 017 (Desktop extraction, 8 PR'ов merged 2026-05-23) фреймворк имеет:

- **`@capsuletech/desktop`** — generic Tauri 2 shell как library (`runDev`/`runBuild`) + CLI command `capsule desktop dev|build <app>`
- **`feat/scriber-v2`** (worktree `capsule-scriber-v2`) — provider-agnostic `LlmBackend` + `ToolProvider` traits + OllamaBackend impl, 2 commit'а, отстаёт от main, нужен rebase
- **HCA wrappers** — Page/Widget/Controller/Feature/Entity/Shape/View
- **web-query** — typed endpoints + middleware pipeline (SSE через preRequest hook возможен)
- **web-router** — Context-based TanStack роутинг
- **web-state** — XState bridge с tag-системой
- **web-ui Matrix v2** (ADR 016) — grid layouts с DnD + presets
- **web-ui-creator** (ADR 013) — manifests + state operations + inspector + generators

User хочет **desktop приложение для управления пространством агентов**, не "просто чат". Конкретно:

1. **Onboarding flow** — установка → первый запуск → mini-регистрация (имя) → workspace
2. **Workspace с виджетами** — drag/drop, resize, разные места. Виджеты автономны, но cross-widget event bus
3. **Widget 1 — Context/RAG manager**: визуальный graph editor (ReactFlow/Miro-like) для структурирования rules. User видит graph (testWorkflow, releaseWorkflow, docsWorkflow), агент получает классический markdown
4. **Widget 2 — Agent chat + settings**: чат, attach rules из Widget 1, multi-agent runtime (несколько архитекторов одновременно), видимость sub-agents (статусы, "живой/завис")
5. **Widget 3 — Projects manager**: file browser, корень workspace через папку, switch projects
6. **Files**: tree в своём пространстве, опционально direct user's tree (как Claude Code)
7. **Stack**: Tauri only (не browser), доступ к файлам, бэк+клиент в одном Rust scope (long-term)
8. **Future**: вставить в IDE plugin (после обкатки)

## Проблема

Текущий фреймворк **НЕ покрывает**:

| Что | Зачем | Сейчас |
|---|---|---|
| Custom Rust в Tauri (embed scriber lib) | Бэк+клиент в одном Rust scope | `@capsuletech/desktop` — generic shell, не позволяет add'ить deps в native crate |
| Free DnD workspace manager (resize + position) | Виджеты в "разных местах разного размера" | web-ui Matrix v2 — grid presets, не free positioning |
| Cross-widget event bus | Виджеты получают/отправляют события соседям | Не существует (есть только `next()` up-chain через Controller/Feature) |
| Graph editor (ReactFlow/Miro-like) | Widget 1 (Context/RAG visual structuring) | Не существует |
| Tauri-store persistence | Onboarding state, last project, user preferences | tauri-plugin-store не интегрирован в `@capsuletech/desktop` |
| Multi-agent runtime UI | Несколько scribers одновременно, sub-agent visibility | Не существует |

Каждый gap — отдельная задача для framework team. По convention `apps-only scope` (главный assistant edits only `apps/`, flag framework gaps) — gaps **флажатся** user'у, делаются в фреймворке отдельными PR'ами, capsule-space pull'ает после merge.

## Решение

### 1. Layout — unified в `apps/capsule-space/`

```
apps/capsule-space/
├── package.json
├── capsule.config.ts        # desktop секция (productName, identifier, window)
├── tsconfig.json
├── project.json             # nx project
├── README.md
├── src/                     # Solid frontend (HCA convention — entities/widgets/pages/...)
│   ├── entities/
│   ├── controllers/
│   ├── features/
│   ├── views/
│   ├── shapes/
│   ├── widgets/
│   ├── pages/
│   └── main.tsx
└── back/                    # Rust backend — появляется в Phase 4
    ├── Cargo.toml           # standalone, не member backend/Cargo.toml
    ├── tauri.conf.json      # Tauri shell + custom commands
    └── src/{main.rs, lib.rs}
```

**Naming**:
- `src/` — capsule HCA convention (vite-builder / CLI / templates ожидают именно `src/`). Не отклоняемся — иначе framework-level change.
- `back/` — Rust backend. Появляется только в Phase 4 (до этого capsule-space использует generic `@capsuletech/desktop` shell через `capsule desktop dev capsule-space`). В Phase 4 — это **full backend** с Tauri shell + scriber lib embed (не просто generic shell как `packages/desktop/native/`).

**Почему unified в apps/capsule-space/, а не split (frontend в apps + backend в backend/scriber)?**

- capsule-space — единственный consumer Tauri shell с custom Rust. Backend через `backend/scriber/` (workspace) остаётся как **shared library crate** для HTTP server использования, capsule-space's `native/` его link'ает.
- Unified path упрощает Phase 4 embed (один Cargo project, один build artifact).
- Соответствует user requirement "бэк и клиент в одном скоупе раста".

### 2. Tauri + scriber embed — Phase 4

В Phase 0-3 frontend подключается к scriber-server по HTTP (manually spawned для dev). Это:

- **Не блокирует UI work** — Phase 0-3 фокус на виджеты + workspace shell
- **Даёт время `feat/scriber-v2`** stable'нуть (rebase от main, API freeze)
- **Embed решение** (sidecar vs unified binary vs Tauri command bridge) — отдельный ADR при подходе к Phase 4. Опции:
  - **A**: Unified Cargo binary — `apps/capsule-space/native/Cargo.toml` depends на `backend/scriber/server` как lib, axum server hosted внутри Tauri процесса
  - **B**: Tauri sidecar — scriber-server precompiled binary в Tauri bundle, spawned как child process
  - **C**: Tauri commands bridge — `capsule_space::call_scriber()` Tauri commands напрямую дёргают scriber library functions (без HTTP)

### 3. Widget framework — TBD после Phase 0/1

User решит после видимого результата. Возможные пути (фиксируются отдельным ADR):

- Extend web-ui Matrix v2 (free positioning + resize → ADR 019)
- Новый `@capsuletech/web-workspace` package для DnD workspace manager
- Локально в `apps/capsule-space/src/` (не reusable, zero framework change)

Не блокирует Phase 0 (Hello-world Tauri окно работает без workspace UI).

### 4. Phased rollout (5 phases после ADR)

| # | Phase | Что | Framework gaps |
|---|---|---|---|
| **0** | Scaffold | `apps/capsule-space/{src/, capsule.config.ts, package.json, ...}` — **БЕЗ `back/`**, Tauri окно открывается через `capsule desktop dev capsule-space`, Hello Page | — (использует существующий `@capsuletech/desktop`) |
| **1** | Onboarding + persistence | Mini-form name (Page `/onboarding`), Tauri store через `tauri-plugin-store`, redirect на `/workspace` | tauri-plugin-store wiring в `@capsuletech/desktop` (flag → owner-desktop) |
| **2** | Widget 3 (Projects) | File browser (Tauri fs api), switch projects, LRU last-used | tauri-plugin-fs deps + опционально workspace manager (зависит от §3) |
| **3** | Widget 2 (Agent Chat) | Single agent, SSE к scriber-server (manually spawned для dev), multi-agent позже | `feat/scriber-v2` rebase + API freeze + SSE через web-query preRequest |
| **4** | Scriber embed | `apps/capsule-space/back/` появляется — Tauri+scriber unified (опция A/B/C из §2) — отдельный ADR | Новый ADR (extension к ADR 017), либо ADR 017 Phase 4 escape hatch (`capsule desktop eject`) |
| **5** | Widget 1 (Context/RAG) | Graph editor (visual rules structuring), export → markdown для агента | Графовый редактор: новый package `@capsuletech/web-graph` или встроить в apps |

**Параллелизм**: phases 2 и 3 могут идти **параллельно** (Projects не зависит от Agent Chat). Phase 4 strict sequential после 3. Phase 5 strict после 1 (требует persistence для save rules).

**Widget framework decision** (§3) — entre Phase 1 и Phase 2 (после "что нам реально надо для drag/drop виджетов"). Может оказаться что Matrix v2 хватит для Phase 2, а Phase 5 требует free positioning.

### 5. Workflow

**Apps-only scope** (моя memory `feedback_apps_only_scope`): главный assistant (я) **edits only `apps/capsule-space/`**. Framework gaps flag'аю user'у. User либо сам, либо через capsule framework team делает framework PR, мерджит в main. Я pull'аю, продолжаю.

**Coordination с owner-агентами**:
- **owner-scriber** — подсказывает scriber API + делает backend features (LlmBackend extensions, ToolProvider impls). По мере подхода к Phase 3.
- **owner-desktop** — координация по Tauri features (tauri-plugin-store, tauri-plugin-fs, эмбед в Phase 4)
- **owner-builders** — если нужно расширить `defineCapsuleConfig` под capsule-space specifics
- **owner-cli** — если CLI command `capsule create capsule-space` нужно особое scaffold
- **docs-writer** — после Phase 4-5 для user-guide capsule-space

## Альтернативы которые мы НЕ взяли

### A. Browser-only app (без Tauri)

Противоречит requirement: нужен fs access, native desktop UX, IDE plugin integration в будущем. Browser limit'ы (storage, fs, cross-origin) не подходят.

### B. Backend в `backend/scriber/` (как сейчас), frontend в `apps/capsule-space/`

Split менее модульно для main use-case (capsule-space — единственный consumer). Unified path упрощает Phase 4 embed (один build artifact). `backend/scriber/` остаётся как **shared library**, capsule-space линкает.

### C. Сразу Phase 4 embed (unified binary) до UI work

Блокирует UI до Tauri+scriber integration. По POLICY π.1 — phased rollout даёт visible progress + meanwhile feat/scriber-v2 stable'нет. ADR 017 Phase 4 escape hatch (eject) — может быть easier path в Phase 4.

### D. Multi-app split (chat-app + projects-app + context-app)

User описывает виджеты в **одном** workspace с **cross-widget events**. Multi-app не даёт shared context + cross-widget bus тривиально. Single app с widget framework — match.

### E. `apps/capsule-space/back/` создаётся в Phase 0 (minimal Tauri shell), расширяется в Phase 4

Отвергнут. Это duplicate `@capsuletech/desktop/native/` без real cause в Phase 0-3. Лучше:

Phase 0-3: НЕТ `apps/capsule-space/back/` вообще. Capsule-space использует `capsule desktop dev capsule-space` как любой другой app (через generic `@capsuletech/desktop`).

Phase 4: `back/` появляется как либо:
- **eject pattern** — копия `packages/desktop/native/` + scriber deps, capsule-space переходит на own Cargo build (перестаёт использовать `@capsuletech/desktop`)
- **commands-bridge pattern** — тонкая прослойка `back/` поверх `@capsuletech/desktop`, custom Tauri commands вызывают scriber library functions

Решение по pattern — отдельный ADR на момент Phase 4.

### F. Назвать frontend folder `client/` вместо `src/`

Отвергнут. Capsule HCA convention — `apps/<name>/src/{entities,widgets,...}` зашита в vite-builder (`capsuleConfig.ts:watchDir`), CLI templates (`packages/cli/src/templates/app/src/`), nx targets. Переименование = framework-level change на 4+ пакета. Frontend остаётся в `src/`.

`back/` — наш term для backend (user's choice). Осмысленно, отличается от framework's `backend/` workspace (`backend/scriber/`, `backend/fs/` — shared zone). `apps/capsule-space/back/` — частный backend этого app'а.

### F. Web-ui-creator для Widget 1 (Context/RAG graph)

`@capsuletech/web-ui-creator` имеет `/manifests`, `/state` operations, `/inspector`, `/generators` — это **design-time UI editing**, не runtime graph editor для rules. Wrong fit для use-case. Граф для rules — другая зона (visualization of declarative rule structure, не UI tree).

## Последствия

### Положительные

- **Desktop UI запускается Phase 0** (Tauri окно через минуты после scaffold)
- **Framework gaps flag'аются по мере необходимости** (не upfront over-engineering)
- **ADR 017 reused** — `capsule desktop dev capsule-space` работает с Phase 0
- **Scriber refactor (feat/scriber-v2) не блокирует UI** — HTTP integration в Phase 3
- **Widget framework decision информирован** — после Phase 1 видно что реально нужно
- **Phased rollout мин costly** — каждая phase = visible result + точечный pre-req

### Отрицательные

- **`apps/capsule-space/back/` — единственный custom Rust crate в `apps/`** (когда появится в Phase 4). Возможен code duplication с `@capsuletech/desktop/native/` (generic shell parts). Решается выбором embed mechanism в Phase 4 ADR — либо eject pattern (копия + расширение), либо commands-bridge (тонкая прослойка без дублирования shell).
- **Widget framework decision отложено** — риск что после Phase 1 окажется Matrix v2 не подходит, Phase 2 widgets имеют temp решение → потом refactor.
- **`feat/scriber-v2` отдельная ветка** — требует rebase от main + API freeze для Phase 3. Sync — owner-scriber zone.
- **Phase 4 embed — большой unknown** — может занять время сравнимое с Phase 0-3 combined (Cargo workspace magic, Tauri features, packaging).
- **Multi-agent runtime UI** (Phase 3 expansion) — отдельный design exercise, может потребовать новый ADR.

### Migration / Roadmap

**Phase 0 (этот PR-серия) → 1 → 2 → 3** — last sequential. ETA: несколько сессий.

**Phase 4** — отдельный ADR (extension ADR 017 Phase 4 escape hatch, или новый ADR 020+ для scriber embed).

**Phase 5 (Context/RAG graph)** — отдельный ADR если graph editor становится самостоятельным package.

**IDE plugin integration** (post-Phase 5) — отдельный ADR. Возможно через capsule-space как embedded WebView в IDE plugin.

## Связанное

- [[017-desktop-package|ADR 017]] — `@capsuletech/desktop` (capsule-space потребляет в Phase 0-3, возможно eject'ит в Phase 4)
- [[003-router-context-based|ADR 003]] — web-router (capsule-space pages `/onboarding`, `/workspace`)
- [[016-matrix-v2-rows-engine|ADR 016]] — Matrix v2 (potential widget framework base)
- [[013-explicit-define-app-config|ADR 013]] — `defineAppConfig` pattern (используется в capsule.config.ts)
- `feat/scriber-v2` (worktree `capsule-scriber-v2`) — LlmBackend traits (consumer в Phase 3)
- [[../../packages/desktop/OWNERSHIP|@capsuletech/desktop OWNERSHIP.md]]
- [Tauri 2 docs](https://v2.tauri.app/)
- [tauri-plugin-store](https://v2.tauri.app/plugin/store/) — для Phase 1 persistence
- [tauri-plugin-fs](https://v2.tauri.app/plugin/file-system/) — для Phase 2 file browser
