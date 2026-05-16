---
tags: [hca, package, router]
status: documented
---

# @capsuletech/router

**Расположение:** `packages/router/`
**Зависит от:** `@tanstack/solid-router`, `solid-js`

Тонкая обёртка над TanStack Solid Router: factory + Solid-context + публичный type-safe API. Реализация по [[003-router-context-based|ADR 003]].

## Публичный API

```ts
import {
  createRouter,
  useRouter,
  RouterContext,
  RouterProvider,
} from '@capsuletech/router';

import type {
  ICapsuleRouter,
  ICapsuleRouterContext,
  ICreateRouterOpts,
} from '@capsuletech/router';
```

### `createRouter({ routeTree, context? })`

Фабрика. Создаёт TanStack-роутер и оборачивает в Capsule-API.

```ts
const { raw, capsuleRouter } = createRouter({
  routeTree,
  context: { isAuthenticated: false },
});
```

- `raw` — экземпляр TanStack-роутера, идёт в `<RouterProvider router={raw} />`.
- `capsuleRouter` — `ICapsuleRouter`, идёт в `<RouterContext.Provider value={...}>`.

`Providers.Base` делает оба шага сам — снаружи это не видно.

### `useRouter(): ICapsuleRouter`

Hook для доступа к Capsule-роутеру из компонента или wrapper'а. Бросает, если вне `<Providers.Base>` — это намеренно (silent-null опаснее явной ошибки).

```ts
import { useRouter } from '@capsuletech/router';

const router = useRouter();
router.goTo('/dashboard');
```

В `createLogicWrapper` это уже сделано — `services.router` приходит готовый.

### `ICapsuleRouter`

```ts
interface ICapsuleRouter {
  goTo(path: string, params?: Record<string, unknown>): void;
  back(): void;
  current(): string;
  /** Escape hatch: TanStack-роутер напрямую — для редких use-case'ов */
  raw: AnyRouter;
}
```

API специально **не** копирует все возможности TanStack — даёт стабильный контракт, не зависящий от внутренних изменений роутера. Для нестандартных случаев — `router.raw`.

### `RouterProvider`

Прямой re-export `@tanstack/solid-router` — нужен для рендера дерева роутов внутри `Providers.Base`.

## Подключение

Обычно — через `Providers.Base`:

```tsx
import { Providers } from '@capsuletech/core';
import { routeTree } from './routes/routeTree.gen';

<Providers.Base routeTree={routeTree} routerContext={{ isAuthenticated: false }} />
```

Если `routeTree` не передан — `Base` рендерит `props.children` без роутера (для unit-тестов компонентов вне роутера).

## Использование в Controller / Feature

```tsx
const Auth = Feature(({ router }) => ({
  initial: 'idle',
  states: {
    idle: {
      onClick: async ({ target, store }) => {
        const ok = await api.login(target.payload);
        if (ok) router.goTo('/dashboard');
      },
    },
  },
}));
```

`router` приходит автоматически через `services` из `createLogicWrapper`. API-сигнатура не меняется при будущих рефакторингах внутренностей роутера.

## Что **не** входит в `@capsuletech/router`

- API-клиент / fetch-обёртка — это уровень приложения.
- Guards (`beforeLoad`, `loader`) — пишутся в TanStack-роутах напрямую (`.capsule/routes/__pages/...`).
- Sync с XState-стейтом контроллера — отдельная фича, если понадобится.

## Связанное

- [[003-router-context-based|ADR 003]]
- [[controller-proxy]]
- [[vite-plugins|RouterPlugin]]
