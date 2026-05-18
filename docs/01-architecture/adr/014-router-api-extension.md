---
tags: [hca, adr, implemented]
status: implemented
date: 2026-05-18
---

# ADR 014 — Router: options-объект в `goTo` и generic `ICapsuleRouterContext`

> [!success] Реализовано
> `ICapsuleRouter.goTo(path, opts?)` принимает `{ params, search, hash, replace }`. `ICapsuleRouterContext` стал generic'ом `<TUser = {}>`. Поле `isAuthenticated?` удалено из default-shape — апп-уровневый концепт уходит в `TUser` consumer'а.

## Контекст

`ICapsuleRouter` ([packages/web/router/src/types.ts](packages/web/router/src/types.ts)) с момента [[003-router-context-based|ADR 003]] предоставлял узкий API:

```ts
interface ICapsuleRouter {
  goTo(path: string, params?: Record<string, unknown>): void;
  back(): void;
  current(): string;
  raw: RouterCore<...>;
}
interface ICapsuleRouterContext {
  isAuthenticated?: boolean;
  [k: string]: unknown;
}
```

Со временем накопились две болячки:

1. **`goTo` покрывает только `to`+`params`.** TanStack `navigate` принимает ещё `search` (query-параметры), `hash` (anchor), `replace` (history push vs replace). Без этих полей любой query-кейс уходит в `router.raw.navigate({...})` — escape hatch'ем, минуя стабильный capsule-API. То есть «расширяй API или живи с обходами».

2. **`isAuthenticated?: boolean` зашит в `ICapsuleRouterContext`.** Это app-уровневый концепт. Не все приложения про auth (внутренние тулзы, демо). Сейчас поле висит в shape мёртвым грузом: ни один из `apps/*` репо его реально не пробрасывает в `BaseProviders`, root-routes объявляют `MyRouterContext { isAuthenticated: boolean }` впустую, в guard'ах оно всегда `undefined`. Smell без real-impact.

## Решение

### 1. `goTo` принимает options-объект

```ts
interface IGoToOpts {
  params?: Record<string, unknown>;
  search?: Record<string, unknown>;
  hash?: string;
  replace?: boolean;
}

interface ICapsuleRouter<TRouteTree extends AnyRoute = AnyRoute> {
  goTo(path: string, opts?: IGoToOpts): void;
  // ... back, current, raw
}
```

Реализация — прямой проброс в `raw.navigate({ to, ...opts })`.

**Breaking change для 2-аргументной формы.** Старый код:
```ts
router.goTo('/users/:id', { id: 42 });
```
Новый код:
```ts
router.goTo('/users/:id', { params: { id: 42 } });
```

В репо 2-аргументной формы **нет**: все call-sites используют только `goTo(path)` без второго аргумента. Real-impact миграции — ноль файлов кода, два теста на 2-arg форму переписаны.

### 2. `ICapsuleRouterContext` — generic

```ts
type ICapsuleRouterContext<TUser = {}> = TUser & {
  [k: string]: unknown;
};
```

`isAuthenticated?: boolean` удалён из default-shape. Приложение объявляет своё:

```ts
// apps/<app>/bootstrap.tsx
type AppCtx = ICapsuleRouterContext<{ isAuthenticated: boolean }>;
<BaseProviders routeTree={routeTree} routerContext={{ isAuthenticated: hasToken() }} />
```

Index signature `[k: string]: unknown` оставлен — это backwards-compat предохранитель для TanStack, который пробрасывает контекст в guard'ы как loose record.

### Что НЕ меняется

- `current()` остаётся `() => string` (только pathname). Расширять на `location()` объект — отдельная задача, нагрузка от `?search` обычно решается через `router.raw.state.location.search`, и это менее частый кейс чем navigate-с-search.
- `back()` без изменений.
- `useRouter()` без изменений — generic-loss проблема не решается (см. cleanup-plan P3, нужен TanStack `Register` augmentation).
- `BaseProviders` в web-core принимает `routerContext` как `ICapsuleRouterContext` без своего generic'а на context. App'ы прокидывают объект, типизация работает через index signature. Дать BaseProviders отдельный `TContext`-generic — отдельный refactor в web-core (вне scope пакета router).

## Альтернативы

### A. Третий позиционный аргумент в `goTo`
```ts
goTo(path: string, params?: Record<string, unknown>, opts?: { search?, hash?, replace? }): void
```
Backwards-compat сохранён, миграции не нужны. Минусы: 3-местный API визуально шумный, `search`/`hash` без `params` пишутся через `goTo('/x', undefined, { search: {...} })` — некрасиво. Отвергнуто.

### B. TS-overload `goTo(path, params)` + `goTo(path, opts)`
Backwards-compat через декларации перегрузок. Минусы: runtime-логика должна уметь различать `Record<string, unknown>` vs `IGoToOpts` — оба `Record<string, unknown>`, не различимы. Единственный путь — sentinel-поле (`opts.params` / `opts.search` / etc.), что эквивалентно полной миграции. Отвергнуто.

### C. Оставить узкий API, не расширять
Принудительно отправлять всех на `router.raw.navigate({...})` для search/hash. Минус: capsule-API теряет смысл как стабильная обёртка — половина сценариев через escape hatch. Отвергнуто.

### D. Сохранить `isAuthenticated?: boolean` в default-shape `ICapsuleRouterContext`
Backwards-compat, не ломает шаблоны `__root.tsx`. Минус: app-уровневый концепт в либовом типе остаётся, и любое будущее «добавь ещё поле, у нас auth + tenant + locale» взорвёт shape. Отвергнуто — generic решает раз и навсегда.

## Последствия

### Положительные

- `goTo` покрывает 90% navigation-кейсов без выхода в `raw`.
- `ICapsuleRouterContext<T>` — чистая архитектура, app-shape отделён от lib-shape.
- Тесты выросли: `goTo` теперь покрыт по 4 веткам (`params`/`search`/`hash`/`replace`) + комбо.

### Отрицательные

- Breaking: внешние потребители 2-arg формы `goTo(path, params)` должны мигрировать на `goTo(path, { params })`. Внутри репо real-impact ноль (см. выше).
- Removed `isAuthenticated` из shape: внешние потребители, которые опирались на default-поле, должны теперь указать его в `TUser`. В репо real-impact ноль — поле не использовалось.
- `IGoToOpts` экспонирован — это часть публичного API, и любое расширение (`state?`/`replaceState?` и т.п.) теперь требует ADR.

### Migration guide

Если у потребителя есть код вида:

```ts
// before
router.goTo('/items/:id', { id: 42 });
const ctx: ICapsuleRouterContext = { isAuthenticated: true, tenant: 'acme' };
```

То после:

```ts
// after
router.goTo('/items/:id', { params: { id: 42 } });

type AppCtx = ICapsuleRouterContext<{ isAuthenticated: boolean; tenant: string }>;
const ctx: AppCtx = { isAuthenticated: true, tenant: 'acme' };
```

## Связанное

- [[003-router-context-based|ADR 003]] — Context-based роутер (предшественник)
- [[router|@capsuletech/web-router]] — user-doc
- [[web-router]] — AI-anchor
