---
tags: [hca, package, router]
status: documented
---

# @capsuletech/web-router

**Расположение:** `packages/web/router/`
**Зависит от:** `@tanstack/solid-router`, `@tanstack/router-core`, `solid-js`

Тонкая обёртка над TanStack Solid Router: factory + Solid-context + публичный type-safe API. Реализация по [[003-router-context-based|ADR 003]].

## Файловая карта

```
packages/web/router/src/
├── index.ts         barrel
├── service.ts       createRouter() — value-импортит @tanstack/solid-router
├── types.ts         wrap() + ICapsuleRouter / ICreateRouterOpts / ICapsuleRouterContext
├── context.ts       RouterContext + useRouter()
└── __tests__/       wrap (7) + useRouter (2)
```

`wrap()` вынесена в `types.ts` отдельно от `createRouter()` сознательно — она делает только type-only import `@tanstack/solid-router`, благодаря чему весь pure-функционал тестируется в node-env без jsdom (`@tanstack/solid-router` value-import тянет CatchBoundary и прочие client-only Solid-API, которые падают на сервере).

## Публичный API

```ts
import {
  createRouter,
  useRouter,
  RouterContext,
  RouterProvider,
} from '@capsuletech/web-router';

import type {
  AnyRoute,
  ICapsuleRouter,
  ICapsuleRouterContext,
  ICreateRouterOpts,
  TanStackRouter,
} from '@capsuletech/web-router';
```

### `createRouter<TRouteTree>({ routeTree, context? })`

Фабрика. Создаёт TanStack-роутер и оборачивает в Capsule-API. Generic `TRouteTree` выводится из переданного `routeTree`:

```ts
const { raw, capsuleRouter } = createRouter({
  routeTree,
  context: { isAuthenticated: false },
});
```

- `raw` — экземпляр `TanStackRouter<TRouteTree>`, идёт в `<RouterProvider router={raw} />`.
- `capsuleRouter` — `ICapsuleRouter<TRouteTree>`, идёт в `<RouterContext.Provider value={...}>`.

`BaseProviders` делает оба шага сам — снаружи это не видно.

### `useRouter(): ICapsuleRouter`

Hook для доступа к Capsule-роутеру из компонента или wrapper'а. Бросает, если вне `<BaseProviders>` — это намеренно (silent-null опаснее явной ошибки).

```ts
import { useRouter } from '@capsuletech/web-router';

const router = useRouter();
router.goTo('/dashboard');
```

В `createLogicWrapper` это уже сделано — `services.router` приходит готовый.

> [!note]
> На уровне `useRouter()` generic `TRouteTree` не пробрасывается — здесь нет источника инференса. Если нужен типизированный `raw.navigate({ to })` — используйте `capsuleRouter.raw` из `createRouter` напрямую (там generic виден) или явно укажите тип переменной.

### `ICapsuleRouter<TRouteTree = AnyRoute>`

```ts
interface IGoToOpts {
  params?: Record<string, unknown>;   // :path-params
  search?: Record<string, unknown>;   // ?query
  hash?: string;                       // #anchor (без ведущего #)
  replace?: boolean;                   // replaceState вместо pushState
}

interface ICapsuleRouter<TRouteTree extends AnyRoute = AnyRoute> {
  goTo(path: string, opts?: IGoToOpts): void;
  back(): void;
  current(): string;
  /** Escape hatch: TanStack-роутер напрямую — для редких use-case'ов */
  raw: RouterCore<TRouteTree, any, any, any, any>;
}
```

API специально **не** копирует все возможности TanStack — даёт стабильный контракт, не зависящий от внутренних изменений роутера. Для нестандартных случаев — `router.raw`.

- `goTo(path, opts?)` — `raw.navigate({ to: path, ...opts })`. Опции напрямую мапятся в TanStack-`navigate`. См. [[014-router-api-extension|ADR 014]].
- `back()` — `raw.history.back()`. Через TanStack-историю, а не `window.history.back()` напрямую — single-source-of-truth + проще к SSR.
- `current()` — `raw.state.location.pathname`. Реактивно (читается по требованию). Search/hash берутся из `router.raw.state.location`.
- `raw` — escape hatch. Когда `BaseProviders` параметризован конкретным `TRouteTree`, `raw.navigate({ to: '...' })` получит autocomplete по маршрутам.

### `ICapsuleRouterContext<TUser = {}>`

```ts
type ICapsuleRouterContext<TUser extends object = {}> = TUser & {
  [k: string]: unknown;
};
```

App-уровневые поля (`isAuthenticated`, `tenant`, `locale`, ...) идут в `TUser`:

```ts
type AppCtx = ICapsuleRouterContext<{ isAuthenticated: boolean; tenant: string }>;
```

См. [[014-router-api-extension|ADR 014]] — почему generic, а не зашитый `isAuthenticated?: boolean` в default-shape.

### `RouterProvider`

Прямой re-export `@tanstack/solid-router` — нужен для рендера дерева роутов внутри `BaseProviders`.

### `AnyRoute`

Re-export `@tanstack/router-core` для default-bound пользовательских generic'ов. Например, `web-core/BaseProviders` задаёт `<TRouteTree extends AnyRoute = AnyRoute>` через этот тип.

## Подключение

Обычно — через `BaseProviders` из web-core:

```tsx
import { BaseProviders } from '@capsuletech/web-core/providers';
import { routeTree } from './routes/routeTree.gen';

<BaseProviders routeTree={routeTree} routerContext={{ isAuthenticated: false }} />
```

Если `routeTree` не передан — `BaseProviders` рендерит `props.children` без роутера (для unit-тестов компонентов вне роутера).

## Использование в Controller / Feature

```tsx
const Auth = Feature(({ router }) => ({
  initial: 'idle',
  states: {
    idle: {
      onClick: async ({ target }) => {
        const ok = await api.login(target.payload);
        if (ok) router.goTo('/dashboard');
      },
    },
  },
}));
```

`router` приходит автоматически через `services` из `createLogicWrapper`. API-сигнатура не меняется при будущих рефакторингах внутренностей роутера.

> [!note]
> На уровне `useRouter()` generic `TRouteTree` не пробрасывается — здесь нет источника инференса. Если нужен типизированный `raw.navigate({ to })` с автокомплитом маршрутов — используйте `capsuleRouter.raw` из `createRouter` напрямую (там generic виден) или явно укажите тип переменной: `const router = useRouter() as ICapsuleRouter<typeof routeTree>`.

## Рецепты

### Guard через `routerContext`

```tsx
// apps/<app>/bootstrap.tsx
<BaseProviders
  routeTree={routeTree}
  routerContext={{ isAuthenticated: hasToken() }}
/>
```

```tsx
// apps/<app>/.capsule/routes/dashboard.tsx
import { createFileRoute, redirect } from '@tanstack/solid-router';

export const Route = createFileRoute('/dashboard')({
  beforeLoad: ({ context }) => {
    if (!context.isAuthenticated) {
      throw redirect({ to: '/login' });
    }
  },
});
```

> [!warning]
> Убедитесь, что `routerContext` явно пробросан в `<BaseProviders>`. Если guard объявляет `context.isAuthenticated`, а в props его нет — в guard'е будет `undefined`. На момент написания ни один из `apps/*` в репо не прокидывает `routerContext` — root-routes объявляют поле впустую.

### Query-параметры, hash и replace

С ADR 014 это прямой вызов `goTo` через options-объект:

```ts
const router = useRouter();

// Переход с query, hash, replace
router.goTo('/items', {
  search: { tag: 'urgent', sort: 'date' },
  hash: 'top',
  replace: true,
});

// Path-параметры — через opts.params
router.goTo('/users/:id', { params: { id: 42 } });
```

Чтение текущего URL (search/hash) — через escape hatch:

```ts
const search = router.raw.state.location.search; // { tag: 'urgent', sort: 'date' }
const hash = router.raw.state.location.hash;
const path = router.current();                    // pathname only
```

### Мягкая зависимость: компонент без роутера

Для компонентов, которые могут рендериться вне контекста роутера (Storybook, unit-тесты, переиспользуемые в других приложениях), используй `useContext(RouterContext)` напрямую — он отдаёт `null` без throw'а:

```tsx
import { RouterContext } from '@capsuletech/web-router';
import { useContext } from 'solid-js';

export const NavLink = (props: { to: string; children: JSX.Element }) => {
  const router = useContext(RouterContext); // null вне Provider'а
  return (
    <a
      href={props.to}
      class={router?.current() === props.to ? 'active' : ''}
    >
      {props.children}
    </a>
  );
};
```

Живой пример этого паттерна — `packages/web/ui/src/primitives/layout/switch.tsx:48`.

## Что **не** входит в `@capsuletech/web-router`

- API-клиент / fetch-обёртка — это уровень `@capsuletech/web-query`.
- Guards (`beforeLoad`, `loader`) — пишутся в TanStack-роутах напрямую (`.capsule/routes/__pages/...`).
- Sync с XState-стейтом контроллера — отдельная фича, если понадобится.

## Связанное

- [[003-router-context-based|ADR 003]] — Context-based вместо singleton
- [[014-router-api-extension|ADR 014]] — `goTo` options-объект + generic `ICapsuleRouterContext`
- [[controller-proxy]]
- [[vite-plugins|RouterPlugin]]
