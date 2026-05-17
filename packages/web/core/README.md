# @capsuletech/web-core

Сердце фреймворка Capsule: HCA-wrapper'ы (`Entity` / `Widget` / `Page` / `Controller` / `Feature` / `Shape`), две Proxy-механики (`UiProxy` + `ControllerProxy`), `createRoot`, `BaseProviders`.

Документация — в Obsidian-vault'е:

- `docs/09-packages/core.md` — обзор пакета, карта файлов, точки входа.
- `docs/07-binding/ui-proxy.md` — перехват UI-событий, meta-теги, дедупликация bubbling.
- `docs/07-binding/controller-proxy.md` — FSM-резолв, lifecycle, `next()`.
- `docs/07-binding/shape.md` — декларативные data-формы (path-tracker, `ShapeUiContext`).

Сборка: `pnpm nx build @capsuletech/web-core` (Vite через `@capsuletech/lib-builder`).
