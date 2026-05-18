---
tags: [meta, api-middleware, ai-context]
status: documented
type: ai-anchor
audience: claude
---

# 🤖 API middleware — AI context anchor

> [!ai]
> Шпаргалка для Claude-инстансов. Без воды. Юзеру — [[api-middleware|api-middleware.md]].

## TL;DR

Декларативные endpoints (`defineEndpoint((z) => ...)`) + koa-style middleware-pipeline между Feature и сетью. Feature никогда не видит `Response`/JSON/статусов — только `Promise<DomainObject>` либо typed-исключение. Endpoints автоматически обнаруживаются Vite-плагином, конфиг middleware живёт в `capsule.app.ts`. HTTP only пока (WS/GraphQL — на будущее).

## Где что лежит

| Файл | Что |
|---|---|
| `packages/web/query/src/endpoint.ts` | `defineEndpoint((z) => config)` — фабрика endpoint'а, generic по zod-схемам |
| `packages/web/query/src/pipeline.ts` | `compose()` koa-style + `ApiContext` тип |
| `packages/web/query/src/errors.ts` | `ApiError` + иерархия: `UnauthorizedError`, `ForbiddenError`, `NotFoundError`, `ConflictError`, `ServerError`, `NetworkError`, `TimeoutError`, `ValidationError` |
| `packages/web/query/src/middleware/core.ts` | Internal mw: `validateInput`, `buildRequest`, `httpTransport`, `validateResponse`, `mapDomain` |
| `packages/web/query/src/middleware/user.ts` | User-facing mw factories: `cookies`, `auth`, `statusMapper`, `on401`, `log`, `retry` |
| `packages/web/query/src/createApi.ts` | `createApi(config, endpoints)` — статическая сборка typed-proxy + `setApiClient`/`getApiClient` |
| `packages/web/query/src/client.ts` | Существующий `QueryClient` — теперь работает как transport-слой под pipeline (кэш, dedupe) |
| `packages/builders/vite/src/plugins/endpointsRegistry.ts` | Vite-plugin: сканит `src/endpoints/**`, эмитит `.capsule/registry/endpoints.ts` + `.capsule/@types/api.d.ts` |
| `packages/builders/vite/src/plugins/appConfig.ts` | Эмитит `.capsule/app-config.gen.ts` с `setApiClient(createApi(appConfig.api, endpoints))` |
| `packages/builders/vite/src/plugins/constants.ts` | `DEFINE_FACTORIES = { '@capsuletech/web-query': ['defineEndpoint'] }` — auto-import конфиг |
| `packages/builders/vite/src/defines/capsuleConfig.ts` | Регистрация плагинов (browser-stub для globalThis-фабрик `defineAppConfig` живёт в `AppConfigPlugin.transform`) |
| `packages/web/core/src/engine/logic-wrapper.tsx` | Инжект `services.api = getApiClient()` (только в Feature, не в Controller) |
| `packages/web/query/src/createApi.ts` | `declare global { interface CapsuleApi {} }` — родной дом fallback'а под interface-merging (раньше жил в web-core/wrappers/ui/interfaces.ts) |

## Endpoint declaration syntax

```ts
// apps/<app>/src/endpoints/user.ts — НИ ОДНОГО импорта
export const get = defineEndpoint((z) => ({
  method: 'GET',
  path: '/users/:id',
  request: z.object({ id: z.string() }),
  response: z.object({ id: z.string(), email: z.string(), createdAt: z.string() }),
  map: (dto) => ({ ...dto, createdAt: new Date(dto.createdAt) }),
  // optional:
  // base: '_auth',                       // ключ из bases в capsule.app.ts
  // staleTime: 60_000,                  // только для GET, override defaultStaleTime
  // middleware: [mw.cache(...)],        // per-endpoint mw, в самом конце pipeline
}));
```

Правила: один файл — все методы одной сущности. `path` поддерживает `:name`-плейсхолдеры; имена должны быть полями request-схемы. Остальные поля запроса уходят в querystring (GET/HEAD/DELETE) или body (POST/PUT/PATCH). `map` опционален.

## Middleware pipeline structure

Порядок исполнения одного вызова:

```
validateInput (zod request)
  → buildRequest (path-params, query/body)
  → ...globalMw из capsule.app.ts (cookies, auth, statusMapper, on401, log)
  → httpTransport (queryClient.fetch / .mutate)
  → validateResponse (zod response)
  → mapDomain (endpoint.map → ctx.data)
  → ...endpoint.middleware (per-endpoint cache/retry)
```

Каждый mw — `(ctx, next) => { ... await next(); ... }` (koa-style). `ApiContext` несёт `endpoint`, `config`, `client`, `input`, `request`, `response`, `data`, `meta`.

## Global config

```ts
// apps/<app>/capsule.app.ts
export default defineAppConfig({
  meta: { tags: [...] },
  aliases: { ... },
  api: ({ mw }) => ({
    bases: { default: '/api', auth: 'https://auth.example.com' },
    defaultHeaders: { Accept: 'application/json' },
    defaultStaleTime: 30_000,
    middleware: [
      mw.cookies(),
      mw.auth({ getToken: () => localStorage.getItem('token') }),
      mw.statusMapper(),
      mw.on401(() => routerService.goTo('/_auth')),
      mw.log(),
    ],
  }),
});
```

`mw` приходит аргументом: `cookies`, `auth`, `statusMapper`, `on401`, `log`, `retry`.

## Usage in Feature

```ts
export default Feature((services) => ({
  initial: 'loading',
  states: {
    loading: {
      onInit: async ({ state, store }) => {
        try {
          const user = await services.api.user.get({ id: '1' }); // typed → User
          store.setProps(/* ... */);
          state.set('ready');
        } catch (e) {
          if (e instanceof UnauthorizedError) state.set('unauthorized');
          else if (e instanceof ValidationError) state.set('badData');
          else state.set('error');
        }
      },
    },
  },
}));
```

`services.api` инжектится только в Feature, не в Controller (compliance запрещает IO).

## Auto-discovery

Vite-плагин `EndpointsRegistryPlugin` следит за `apps/*/src/endpoints/**/*.ts`. Mapping: `endpoints/user.ts` → `endpoints.user`, `endpoints/admin/users.ts` → `endpoints.admin.users`.

Генерит два файла (не редактировать):
- `.capsule/registry/endpoints.ts` — namespace-tree с lazy-импортами.
- `.capsule/@types/api.d.ts` — `declare global { interface CapsuleApi extends InferApi<Endpoints> {} }`.

`IServices.api: CapsuleApi` — пустой fallback в `@capsuletech/web-core` сливается с генерируемой формой через interface merging. Ctrl+Click на `services.api.user.get` ведёт в исходник.

## Bootstrap flow

1. `.capsule/bootstrap.tsx` импортит `./app-config.gen` (side-effect).
2. `app-config.gen.ts` (генерится AppConfigPlugin'ом) делает:
   - `registerAliases({...})` — статический JSON от build-time.
   - `import appConfig from '../capsule.app'` — runtime-импорт.
   - `if (appConfig.api) setApiClient(createApi(appConfig.api, endpoints))` — собирает proxy.
3. `getApiClient()` дёргается из `createLogicWrapper` при создании каждой Feature.

## Известные грабли

1. **`defineAppConfig is not defined` в браузере** — `AppConfigPlugin.transform` переписывает `defineAppConfig(x)` / `defineCapsuleConfig(x)` → identity прямо в исходнике `capsule.app.ts`. Через esbuild `define:` со стрелочной функцией это сделать нельзя — он валидирует value как `entity name | JS literal` и падает `[vite:define] Invalid define value`. В Node CLI глобал ставит `@capsuletech/cli/defines.ts`.

2. **`endpoints.ts` пустой** — `EndpointsRegistryPlugin` не успел отсканить или папка `src/endpoints/` отсутствует. Перезапустить dev.

3. **[[shared-vite-dist]]** — после правок в `packages/builders/vite/src/` обязательно `pnpm --filter @capsuletech/vite-builder build` + рестарт dev-сервера.

4. **`zod` peer-dep** — у `@capsuletech/web-query` `zod` в `peerDependencies`. Workspace pnpm подтягивает версию из root deps.

5. **Order of middleware matters** — `statusMapper` ставится раньше `on401`, чтобы он видел типизированный `UnauthorizedError`, а не сырой `Error`.

6. **`path`-параметры обязаны быть в `request`-схеме** — `buildRequest` берёт `:id` из `input.id`. Если поля нет — runtime-error `Missing path param`.

7. **`map` без `response`** — теряет смысл, но не ломает (`map(undefined)` → что вернёт).

## Что менять когда

| Хочу… | Куда лезть |
|---|---|
| Добавить новый встроенный middleware (cache/trace) | `packages/web/query/src/middleware/user.ts` + экспорт из `middleware/index.ts` |
| Поменять порядок default-pipeline | `packages/web/query/src/createApi.ts > wrapEndpoint` |
| Добавить новый transport (WS/GraphQL) | `packages/web/query/src/middleware/core.ts` (новая mw) + расширить `EndpointConfig.transport` |
| Поменять structure-mapping endpoints/ → namespace | `packages/builders/vite/src/plugins/endpointsRegistry.ts > fileToLeaf` |
| Поменять формат `app-config.gen.ts` | `packages/builders/vite/src/plugins/appConfig.ts > generateRuntimeFile` |
| Добавить новый typed error | `packages/web/query/src/errors.ts` (extends `ApiError`) + маппинг в `statusMapper` |
| Изменить inject в Feature | `packages/web/core/src/engine/logic-wrapper.tsx > services` |

## Cross-links

- User-doc: [[api-middleware]]
- Related: [[state]], [[router]], [[controller-proxy]], [[golden-rules]]
