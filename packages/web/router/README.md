# @capsuletech/web-router

Тонкая обёртка над `@tanstack/solid-router` для Capsule: фабрика `createRouter`, Solid-контекст `RouterContext` + хук `useRouter`, ре-экспорт `RouterProvider`. Скрывает детали TanStack за стабильным `ICapsuleRouter` API (`goTo` / `back` / `current` / `raw`).

Документация — в Obsidian-vault'е:

- `docs/09-packages/router.md` — обзор пакета, карта файлов, рецепты.
- `docs/_meta/web-router.md` — AI-anchor (TL;DR, гочи, lifecycle-flow).
- `docs/01-architecture/adr/003-router-context-based.md` — почему Context-based (singleton → context).
- `docs/01-architecture/adr/014-router-api-extension.md` — `goTo` options-объект + generic `ICapsuleRouterContext`.

Сборка: `pnpm nx build @capsuletech/web-router` (Vite через `@capsuletech/lib-builder`).
Тесты: `pnpm --filter @capsuletech/web-router test` (13 шт., node-env).
