# Capsule Space

Desktop приложение для управления пространством агентов — workspace с виджетами для контекста (RAG), чата с агентами, файлами проектов. Tauri 2 only.

См. [ADR 018](../../docs/01-architecture/adr/018-capsule-space-app.md) — архитектура + phase plan.

## Запуск

`capsule desktop dev` берёт имя app'а из текущей директории (`ctx.name`), поэтому нужно сначала `cd` в `apps/capsule-space/`.

```bash
# Terminal 1 — Vite dev-сервер
cd apps/capsule-space
pnpm dev                          # → http://localhost:3000

# Terminal 2 — Tauri shell (окно поверх Vite)
cd apps/capsule-space
pnpm capsule desktop dev          # без positional args
```

## Build

```bash
cd apps/capsule-space
pnpm build                        # Vite production build → dist/
pnpm capsule desktop build        # Tauri bundle → packages/desktop/native/target/release/bundle/
```

## Структура

```
apps/capsule-space/
├── capsule.config.ts        # desktop секция (productName, identifier, window 1400x900)
├── capsule.app.ts           # AppConfig (tags, aliases)
├── src/
│   ├── pages/welcome.tsx    # / → Widgets.Welcome
│   ├── widgets/welcome.tsx  # Composition
│   ├── views/hello.tsx      # Stateless UI
│   ├── controllers/         # FSM (пока пусто)
│   ├── features/            # API + side effects (пока пусто)
│   └── shapes/              # Presentation (пока пусто)
└── back/                    # Rust backend — появится в Phase 4 (scriber embed)
```

## Phase status

- ✅ **Phase 0** — Scaffold + Hello Page + Tauri окно
- ⏳ Phase 1 — Onboarding (name) + Tauri-store persistence
- ⏳ Phase 2 — Widget 3 (Projects) — file browser
- ⏳ Phase 3 — Widget 2 (Agent Chat) — SSE к scriber-server
- ⏳ Phase 4 — Scriber embed (`back/` появляется)
- ⏳ Phase 5 — Widget 1 (Context/RAG) — graph editor
