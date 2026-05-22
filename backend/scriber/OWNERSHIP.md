---
name: backend/scriber
owner-agent: owner-scriber
group: backend (rust workspace, не npm-published)
status: pre-1.0
last-updated: 2026-05-22
---

# backend/scriber

LLM-роутер для capsule — provider-agnostic бэкенд `apps/agent` (Tauri desktop). Запускается как Tauri sidecar или standalone HTTP сервер на `:8787`.

## Зона ответственности

### Owns
- `backend/scriber/core/` (полностью) — traits `LlmBackend`, `ToolProvider`, общие типы
- `backend/scriber/ollama/` (полностью) — Ollama impl `LlmBackend`
- `backend/scriber/mcp/` (полностью) — MCP impl `ToolProvider` (scaffold, P1)
- `backend/scriber/native-tools/` (полностью) — native FS impl `ToolProvider` (scaffold, P1)
- `backend/scriber/server/` (полностью) — axum HTTP/SSE binary
- Crate-local `Cargo.toml` всех пяти

### Не трогает
- `backend/fs/` — shared с `backend/desktop/`, escalate главному
- `backend/desktop/` — Tauri shell, отдельная зона
- `backend/Cargo.toml` (workspace members + workspace deps) — главный
- `Cargo.lock` — committed; обновляется автоматически при `cargo add`, owner коммитит вместе с изменениями
- `.claude/agents/owner-scriber.md` — agent definition правится главным
- `apps/agent/` — frontend consumer, отдельный owner (TBD app-agent)
- `scripts/dev-*.mjs` — shared infra, главный

## Публичный API

### HTTP (для `apps/agent` + автоматизации)

Финализируется в PR-2. PR-1 экспонирует только `/health`. Полный список см. [.claude/agents/owner-scriber.md → Public API](../../.claude/agents/owner-scriber.md).

Стабильность: `0.x` — breaking changes возможны между minor (после релиза `1.0` — semver).

### Rust (между crate'ами workspace)

- `capsule_core::{LlmBackend, ToolProvider}` — основной публичный контракт, async-trait
- `capsule_core::types::*` — `Message`, `ToolCall`, `ToolDef`, `Capability`, `ModelInfo`, `ChatRequest`, `ChatChunk`
- `capsule_core::error::Error` — общий error type для traits
- Конкретные impls (`OllamaBackend`, `MCPToolProvider`, `NativeToolProvider`) — используются только в `capsule-server::main`, не через downstream consumers

## Quirks / gotchas

1. **`async-trait` обязателен** — async fn в trait объекте с returnом `Stream` не работает stable. Cost: heap-аллокация Future на каждый вызов. Acceptable для I/O bound.
2. **`Pin<Box<dyn Stream + Send>>` (alias `BoxStream`)** — return type для streaming методов trait. Используем `futures_util::stream::BoxStream`.
3. **`tokio::sync::Mutex`, не `std::sync::Mutex`** — async-handler'ы лочат mutex across `.await`. Sync mutex = deadlock risk.
4. **CORS `*`** в dev mode — production должен ограничить. README предупреждает.
5. **Vision-images = base64** в `messages[].images` — большие. Все `tracing::instrument` должны `skip(messages)`.
6. **CRLF на Windows** — `apply_diff` с SEARCH-блоком в LF + файл в CRLF не найдёт совпадение. Workspace `read_text` нормализует line-endings на чтении (TODO в P1 native-tools).
7. **Ollama daemon — runtime dep**. Build не падает без него, но `/providers` покажет Ollama как `available: false`.

## План рефакторинга / оптимизаций

- [ ] **CI job** для cargo workspace — `cargo test --workspace` + clippy + fmt-check. Добавить в PR-2.
- [ ] **`HashMap` provider lookup** — если providers станут 10+ (P1 после реализации OpenAI/Anthropic/Gemini).
- [ ] **Persistence** — SQLite через `sqlx` в `AppLocalDataDir` (P2).
- [ ] **Feature-flags** для providers — `cargo build --features ollama,openai` для slim build на слабых хостах (P1).
- [ ] **Streaming abort** — drop'аем future при закрытии SSE клиентом (P2).
- [ ] **Rate-limit / wall-time cap** на tool-loop (P2).
- [x] **Workspace restructure** — `tools` crate выпилен, разнесён на `core`/`mcp`/`native-tools`. (PR-1, 2026-05-22)

## Test coverage

| Тип | Где | Что покрывает |
|---|---|---|
| Unit | `<crate>/src/__tests__/` или `#[cfg(test)] mod tests` | types serde round-trip, trait defaults, error mapping |
| Integration | `<crate>/tests/` (после PR-2) | OllamaBackend ↔ wiremock daemon, server ↔ mock LlmBackend/ToolProvider |
| Smoke | manual `curl` + `cargo run` | `/health` (PR-1), `/chat/stream` (PR-2+) ручной |
| E2E | TBD после `apps/agent` | full UI → backend → Ollama (P3+) |

**Перед изменением:** `cargo test -p <crate>` должен быть green (после PR-2, в PR-1 тестов мало).
**При breaking change в trait:** обновить все impls + тесты + AI-anchor.
**Перед release:** smoke с реальным Ollama daemon обязателен; cross-compile для win/mac/linux.

## Cross-package dependencies

| Зона | Owner |
|---|---|
| `backend/fs/` | главный |
| `backend/desktop/` (Tauri sidecar bundling, отдельный config per app) | главный |
| `apps/agent/` (HTTP клиент к scriber, UI) | главный → app-agent owner (TBD) |
| `scripts/dev-backend.mjs`, `scripts/dev-agent.mjs` | главный |
| Release / GitHub Actions / cross-compile | главный + owner-git |
| `backend/Cargo.toml` workspace deps | главный |

## Release group

scriber — **не npm-пакет**, не входит в группы `cli`/`web_base`. Релиз отдельный:

- **Standalone бинарь** — cross-compile через GH Actions, ship через GitHub releases (P3, после apps/agent стабилизации)
- **Bundled** — `capsule-server.exe` копируется в Tauri installer `apps/agent` через sidecar mechanism

Координируется через главного.

## Связанное

- [.claude/agents/owner-scriber.md](../../.claude/agents/owner-scriber.md) — agent definition + полный architectural context
- [CLAUDE.md](../../CLAUDE.md) — POLICY + Backend секция
- [scripts/dev-backend.mjs](../../scripts/dev-backend.mjs) — стартер scriber server
- Внешние:
  - [Ollama API docs](https://github.com/ollama/ollama/blob/main/docs/api.md)
  - [MCP spec](https://spec.modelcontextprotocol.io/)
  - [axum 0.7 docs](https://docs.rs/axum/0.7/axum/)
