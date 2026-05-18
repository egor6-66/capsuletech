---
tags: [09-packages, api-middleware]
status: documented
type: guide
---

# 🌐 API middleware — endpoints + pipeline

> [!info]
> Декларативная система для определения HTTP endpoints и middleware-цепочек. Feature получает типизированный API-клиент и работает только с доменными объектами, не видя HTTP-деталей.

## Концепция

Вместо того чтобы раскидывать `fetch`-вызовы по Feature-логике, в Capsule endpoints объявляются декларативно в `src/endpoints/` с Zod-схемами для валидации. Middleware-pipeline между Feature и сетью обрабатывает: аутентификацию, кэш, переводы ошибок HTTP в типизированные исключения, маппинг DTO → Domain Object. Feature видит чистый API: `services.api.user.get({ id: '1' })` → Promise<User>, либо typed error (UnauthorizedError, ValidationError и т.д.). Конфиг middleware живёт в центральном `capsule.app.ts` — легко менять поведение всех запросов сразу.

## Команды / Использование

### Создание нового endpoint

```bash
# 1. Создать файл (или открыть существующий)
touch apps/sandbox/src/endpoints/user.ts

# 2. Объявить export'ы:
export const get = defineEndpoint((z) => ({
  method: 'GET',
  path: '/users/:id',
  request: z.object({ id: z.string() }),
  response: z.object({
    id: z.string(),
    email: z.string(),
    createdAt: z.string(),
  }),
  map: (dto) => ({ ...dto, createdAt: new Date(dto.createdAt) }),
}));

export const update = defineEndpoint((z) => ({
  method: 'PATCH',
  path: '/users/:id',
  request: z.object({
    id: z.string(),
    email: z.string().optional(),
  }),
  response: z.object({ id: z.string(), email: z.string() }),
}));

# 3. Сохранить. Vite автоматически обновит registry.
# 4. В Feature теперь доступно services.api.user.get(input) и services.api.user.update(input).
```

Правила именования:
- **Один файл** — одна сущность (User, Post, Comment и т.д.).
- **Export-имена** должны быть методами: `get`, `post`, `update`, `delete`, `list` и т.д.
- **`path` с `:id`** — параметры должны быть полями в `request`-схеме.
- **Остальные поля request'а** — querystring для GET/HEAD/DELETE, body для POST/PUT/PATCH.

### Конфиг middleware в capsule.app.ts

```ts
// apps/sandbox/capsule.app.ts
export default defineAppConfig({
  meta: { tags: ['capsule', 'sandbox'] },
  aliases: { /* ... */ },
  
  api: ({ mw }) => ({
    // базовые URL'ы для different servers
    bases: {
      default: '/api',
      auth: 'https://auth.example.com',
    },
    
    // заголовки по умолчанию для всех запросов
    defaultHeaders: { Accept: 'application/json' },
    
    // staleTime для GET запросов (кэш)
    defaultStaleTime: 30_000,
    
    // pipeline middleware — выполняется в порядке определения
    middleware: [
      mw.cookies(),                                    // управление cookies
      mw.auth({ getToken: () => localStorage.getItem('token') }),  // attach Bearer token
      mw.statusMapper(),                               // translate HTTP errors → typed errors
      mw.on401(() => routerService.goTo('/_auth')),    // redirect on 401 (опционально)
      mw.log(),                                        // логирование (опционально)
    ],
  }),
});
```

**Альтернатива globalThis: explicit-import**

Раньше `defineAppConfig` работал через `globalThis`-инжект (для Node CLI) + Vite-transform `defineAppConfig(x) → ((__x__) => __x__)(x)` (для браузера, чтобы убрать bare global). Это работает, но хрупкий контракт ([[adr/013-explicit-define-app-config|ADR 013]], стабильность S-8).

Новый рекомендованный путь — explicit-import:

```ts
// apps/<app>/capsule.app.ts
import { defineAppConfig } from '@capsuletech/web-query/app-config';

export default defineAppConfig({
  meta: { tags: ['capsule', 'myapp'] },
  api: ({ mw }) => ({ ... }),
});
```

Контракт `IAppConfig` экспортится оттуда же — Ctrl+Click даёт нативную навигацию в исходник. Legacy `globalThis.defineAppConfig` остаётся включённым для существующих apps (sandbox/agent/ewc), но новые шаблоны CLI генерят explicit-import.

**Встроенные middleware:**
- `mw.cookies()` — attach cookies to requests.
- `mw.auth(config)` — add `Authorization: Bearer <token>` header.
- `mw.statusMapper()` — конвертит сырую `HttpError` (бросает `defaultFetcher` на non-2xx) в типизированные `UnauthorizedError`/`ForbiddenError`/`NotFoundError`/`ConflictError`/`ServerError`. Должен стоять первым.
- `mw.on401(callback)` — trigger callback on 401 (e.g. redirect to login). Должен идти **после** `statusMapper`.
- `mw.log()` — console.log requests/responses (dev).
- `mw.retry(config)` — exponential-backoff retry; по умолчанию ретраит `ServerError` и сетевые ошибки (`NetworkError`/`TimeoutError`). `shouldRetry(err, attempt)` — кастомный фильтр.

### Per-endpoint middleware

```ts
export const get = defineEndpoint((z) => ({
  method: 'GET',
  path: '/users/:id',
  request: z.object({ id: z.string() }),
  response: z.object({ id: z.string(), email: z.string() }),
  
  // опционально: мидлвэр только для этого endpoint'а
  middleware: [
    // custom mw, например cache с другим TTL
    async (ctx, next) => {
      // do something before
      await next();
      // do something after
    },
  ],
}));
```

Пользовательское middleware:
- Сигнатура: `(ctx: ApiContext, next: () => Promise<void>) => Promise<void>`.
- `ctx` содержит: `endpoint`, `config`, `input`, `request`, `response`, `data`, `meta`.
- `await next()` вызывает следующий mw в цепочке.

### Использование в Feature

```ts
// apps/sandbox/src/features/_auth.tsx
export default Feature((services) => ({
  initial: 'checking',
  states: {
    checking: {
      onInit: async ({ state, store }) => {
        try {
          // вызов типизирован автоматически — TS видит параметры и возвращаемый тип
          const me = await services.api.user.me();
          store.setProps({ user: me });
          state.set('authenticated');
        } catch (e) {
          if (e instanceof UnauthorizedError) {
            state.set('unauthenticated');
          } else if (e instanceof NetworkError) {
            state.set('networkError');
          } else if (e instanceof ValidationError) {
            console.error('Backend returned bad data:', e.issues);
            state.set('error');
          } else {
            state.set('error');
          }
        }
      },
    },
    authenticated: {},
    unauthenticated: {},
    networkError: {},
    error: {},
  },
}));
```

**Доступные в catch'е типизированные ошибки:**
- `UnauthorizedError` (401) — требуется аутентификация.
- `ForbiddenError` (403) — недостаточно прав.
- `NotFoundError` (404) — ресурс не найден.
- `ConflictError` (409) — конфликт данных.
- `ServerError` (5xx) — ошибка бэка.
- `NetworkError` — сетевая ошибка.
- `TimeoutError` — timeout.
- `ValidationError` — Zod валидация упала на request или response.
- `HttpError` — сырая HTTP-ошибка с `.status` и `.response`. Обычно её не видно в Feature: `statusMapper` конвертирует её в одну из ошибок выше. Если `statusMapper` не подключён — Feature может ловить `HttpError` напрямую.

Каждая ошибка имеет поля:
- `message: string`
- `status?: number` (для HTTP errors)
- `payload?: unknown` (тело ответа если есть)
- `phase?: 'request' | 'response'` (для ValidationError)
- `issues?: z.ZodIssue[]` (для ValidationError)

## Endpoint declaration — детально

### Метод и path

```ts
method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD'
path: '/users' | '/users/:id' | '/posts/:id/comments/:commentId'
```

Path-параметры (`:id`) **обязаны быть в request-схеме**. Остальные поля запроса:
- GET/HEAD/DELETE → querystring.
- POST/PUT/PATCH → JSON body.

```ts
// Пример: GET /posts?limit=10&offset=0
export const list = defineEndpoint((z) => ({
  method: 'GET',
  path: '/posts',
  request: z.object({
    limit: z.number().default(10),
    offset: z.number().default(0),
  }),
  response: z.array(z.object({ id: z.string(), title: z.string() })),
}));
```

### Request и response схемы

Используются как Zod-схемы. Валидация происходит **до** вызова backend'а (request) и **после** (response).

```ts
request: z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  role: z.enum(['admin', 'user']).optional(),
})

response: z.object({
  id: z.string(),
  email: z.string(),
  createdAt: z.string(),  // ISO date string
  role: z.enum(['admin', 'user']),
})
```

### Map function — DTO → Domain Object

Опционально трансформировать DTO в доменный объект:

```ts
map: (dto) => ({
  ...dto,
  createdAt: new Date(dto.createdAt),  // string → Date
  fullName: `${dto.firstName} ${dto.lastName}`,
})
```

Если `map` не задан — domain object === parsed response.

### Base и custom headers

Endpoint может использовать другой base URL:

```ts
export const logout = defineEndpoint((z) => ({
  method: 'POST',
  path: '/logout',
  base: '_auth',  // из capsule.app.ts bases: { _auth: '...' }
  request: z.object({}),
  response: z.object({ ok: z.boolean() }),
}));
```

### Stale time

Только для GET запросов. Переопределяет `defaultStaleTime` из конфига:

```ts
export const get = defineEndpoint((z) => ({
  method: 'GET',
  path: '/users/:id',
  request: z.object({ id: z.string() }),
  response: z.object({ id: z.string() }),
  staleTime: 60_000,  // 60 сек (вместо default 30 сек)
}));
```

## Middleware pipeline — как это работает

Когда вызывается `services.api.user.get({ id: '1' })`:

```
1. validateInput      — zod-парсинг request'а → ValidationError('request')
2. buildRequest       — сборка path-параметров, query/body
3. [global mw] cookies()
4. [global mw] auth()
5. [global mw] statusMapper()
6. [global mw] on401()
7. [global mw] log()
8. httpTransport      — фактический fetch (с кэшом/dedupe)
9. validateResponse   — zod-парсинг response'а → ValidationError('response')
10. mapDomain         — применение endpoint.map(dto) → ctx.data
11. [endpoint mw]     — custom middleware (см. ниже)
```

Порядок критичен: `statusMapper` должен быть **раньше** `on401`, иначе `on401` не увидит типизированный `UnauthorizedError`.

### Endpoint middleware видит уже DOMAIN, не сырой response

Один важный нюанс: `endpoint.middleware` стоит **после** `mapDomain` в pipeline ([`createApi.ts:79-87`](../../packages/web/query/src/createApi.ts)). Значит:

```ts
export const get = defineEndpoint((z) => ({
  method: 'GET',
  path: '/users/:id',
  response: z.object({ id: z.string(), createdAt: z.string() }),
  map: (dto) => ({ ...dto, createdAt: new Date(dto.createdAt) }),
  middleware: [
    async (ctx, next) => {
      await next();
      // ctx.data.createdAt — уже Date, не string
      // ctx.response.createdAt — пока что тоже Date (validateResponse прошёл, mapDomain переписал)
    },
  ],
}));
```

Если custom-middleware нужен **сырой response** (например, кастомное логирование DTO до маппинга, кэширование binary-блобов, audit-log) — пиши его как **global** middleware (он встаёт **до** `mapDomain`).

Это design choice. См. cleanup-plan P2 #10 для обсуждения.

## Gotchas / известные ограничения

Эти моменты надо знать заранее — фреймворк планирует их закрыть (см. [Roadmap](#roadmap)), но сегодня они активны. Подробный tracker — `docs/_meta/cleanup-plan.md` > секция «Web-query review».

### ~~Cache key — порядок ключей объекта~~ ✅ Закрыто 2026-05-18

С `stable-stringify` ключи объектов сортируются рекурсивно → `cacheKey({a:1,b:2}) === cacheKey({b:2,a:1})`. Массивы остаются order-sensitive (намеренно). File: [`cache.ts:10-30`](../../packages/web/query/src/cache.ts).

### ~~`params` поддерживает только примитивы~~ ✅ Закрыто 2026-05-18

Тип `params` теперь:

```ts
Record<string, string | number | boolean | undefined | null
  | ReadonlyArray<string | number | boolean | undefined | null>>
```

Семантика:
- `?tags=a&tags=b` — `{ tags: ['a', 'b'] }`.
- Skip if not set — `{ q: undefined }` или `{ q: null }`.
- Элементы `undefined`/`null` внутри массива тоже пропускаются.

File: [`client.ts:51-69`](../../packages/web/query/src/client.ts).

### DELETE без body

`buildRequest` ([`middleware/core.ts:42`](../../packages/web/query/src/middleware/core.ts)) запрещает body для DELETE:

```ts
const hasBody = method !== 'GET' && method !== 'HEAD' && method !== 'DELETE';
```

Если API требует `DELETE /carts/items` с body `{ ids: [...] }` — сейчас невозможно через endpoint-DSL. Workaround: глобальное middleware, которое читает `endpoint.config.bodyOnDelete` (своё расширение) и переносит rest input в body. Will fix (P2 #9).

### ~~`HttpError.response` — body можно прочитать только один раз~~ ✅ Закрыто 2026-05-18

В `HttpError` теперь есть `bodyText: string | null` — прочитанный `defaultFetcher`-ом **до** throw'а. Consumer обращается к `err.bodyText` многократно:

```ts
try { await services.api.user.get({ id }); }
catch (e) {
  if (e instanceof UnauthorizedError) {
    // e.cause — это HttpError с прочитанным bodyText
    const body = (e.cause as HttpError).bodyText;  // ✅ string | null
    // Sentry.captureException(e, { extra: { responseBody: body }});
  }
}
```

`err.response.bodyUsed === true` после броска — `response.text()`/`.json()` после throw'а не сработают. Используй `bodyText`. File: [`errors.ts:43-71`](../../packages/web/query/src/errors.ts).

### Headers — case-insensitivity не нормализована

`{ Accept: 'json' }` (global) и `{ accept: 'xml' }` (request override) хранятся как **два разных ключа** в плоском объекте. `fetch` потом схлопнет их непредсказуемо (browser-implementation-defined).

Workaround: использовать единый регистр (canonical: `Accept`, `Content-Type`, `Authorization`).

File: [`client.ts:68`](../../packages/web/query/src/client.ts).

### AbortSignal vs dedupe

```ts
const c = new AbortController();
const p1 = api.user.get({ id }, { signal: a1.signal });
const p2 = api.user.get({ id }, { signal: a2.signal });
a2.abort(); // ❌ p2 продолжает ждать, т.к. p1 уже in-flight и shared
```

Файл: [`client.ts:110`](../../packages/web/query/src/client.ts). Known, fix через `AbortSignal.any([s1, s2])` запланирован (P3 #12).

## Roadmap

Полный список — `docs/_meta/cleanup-plan.md` > секция «Web-query review» (19 findings, приоритизировано P1/P2/P3).

**✅ Pass-1 (2026-05-18, закрыто 5 P1):**

- ✅ Stable cache-key (P1 #2) — sort keys рекурсивно.
- ✅ `HttpError.bodyText` (P1 #3) — прочитанное тело до throw'а.
- ✅ `params` массивы + undefined/null skip (P1 #4) — multi-value queries.
- ✅ Native `Error.cause` (P1 #5) — ES2022 chain в stack-trace.
- ✅ `setQueryClient` интегрирован с `createApi` (P1 #1) — `getQueryClient()` теперь возвращает использующийся клиент.

**🟡 Pass-2 (planned, P2 — заметные пробелы):**

- `gcTime` + LRU для unbounded memory — P2 #6.
- `services.api.$cache.invalidate(key)` — invalidate из Feature (поверх P1 #1) — P2 #7.
- Jitter в `retry` — P2 #8.
- DELETE с body — P2 #9.
- `endpoint.middleware` порядок (опция pre/post-map) — P2 #10 (требует ADR).
- `log({ timing?, redact? })` — P2 #11.

**🟢 Pass-3 (planned, P3 — нюансы):**

- AbortSignal.any в dedupe — P3 #12.
- URL regex check — P3 #13.
- isPrefix perf (cached serializedKey) — P3 #14.
- Headers case-insensitivity — P3 #15.
- `createMockApi(endpoints, mocks)` для тестов Feature — P3 #16.
- SSE / WebSocket transport (`createStreamApi`) — P3 #17.
- Payload serialization safety — P3 #18.

## Troubleshooting

**`Cannot find module '@capsuletech/web-query'`** — если используешь функции вне auto-import (редко), добавь в `apps/<app>/package.json`:
```json
"devDependencies": { "@capsuletech/web-query": "workspace:*" }
```

**`services.api is undefined` в Feature** — в `capsule.app.ts` не задан блок `api`, либо dev-сервер ещё не перегенерировал registry. Перезапустить dev.

**`ValidationError(phase: 'response')`** — backend вернул данные, не совпадающие с `response`-схемой. Проверь shape. Временно можно использовать `z.passthrough()` для ослабления схемы.

**`Missing path param ":id"`** — вызов `api.user.get({})` без поля `id`, или это поле отсутствует в `request`-схеме. Zod на этапе `validateInput` поймает, если схема строга.

**`401` не редиректит** — middleware `on401` отсутствует в конфиге, или он стоит **выше** `statusMapper`. Переместить `statusMapper` выше.

**`endpoints.ts` пустой** — папка `src/endpoints/` не создана или плагин не успел отсканить. Перезапустить dev-сервер.

## Связанное

- [[state]] — FSM в Feature.
- [[controller-proxy]] — как Feature инжектится middleware.
- [[router]] — навигация между Page'ами.
- [[golden-rules]] — архитектурные ограничения (например, API только в Feature, не в Controller).
