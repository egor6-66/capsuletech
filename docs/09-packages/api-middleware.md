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
1. validateInput — zod-парсинг request'а
2. buildRequest — сборка path-параметров, query/body
3. [global mw] cookies()
4. [global mw] auth()
5. [global mw] statusMapper()
6. [global mw] on401()
7. [global mw] log()
8. httpTransport — фактический fetch (с кэшом/dedupe)
9. validateResponse — zod-парсинг response'а
10. mapDomain — применение endpoint.map
11. [endpoint mw] custom middleware
```

Порядок критичен: `statusMapper` должен быть **раньше** `on401`, иначе `on401` не увидит типизированный `UnauthorizedError`.

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
