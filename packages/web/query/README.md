# @capsuletech/web-query

Декларативный HTTP-слой Capsule: `defineEndpoint` + `createApi` + koa-style middleware-pipeline. Feature видит typed-proxy `services.api.user.get({ id })`, не зная про fetch, кэш или маппинг ошибок.

Подпуть `@capsuletech/web-query/app-config` экспортирует `IAppConfig` — контракт для `apps/<app>/capsule.app.ts` (раньше жил в `@capsuletech/web-core`).

Документация — в Obsidian-vault'е:

- `docs/09-packages/api-middleware.md` — обзор пакета, endpoint-DSL, middleware-toolbox, типизация `services.api`.

Сборка: `pnpm nx build @capsuletech/web-query` (Vite через `@capsuletech/lib-builder`, два entry: `index` + `app-config`).
Тесты: `pnpm --filter @capsuletech/web-query test` (147 шт., node-env).
