---
tags: [meta, web-router, ai-context]
status: documented
type: ai-anchor
audience: claude
---

# 🤖 Web Router — AI context anchor

> [!ai]
> Шпаргалка для Claude-инстансов. Без воды. Юзеру — [[router|router.md]].

## TL;DR

Context-based (ADR 003) обёртка над `@tanstack/solid-router`. Factory `createRouter({ routeTree, context? })` возвращает `{ raw, capsuleRouter }`. Hook `useRouter()` достаёт `ICapsuleRouter` из Context. Реактивное API: `goTo(path, opts?) / back() / current()`, где `opts = { params, search, hash, replace }` — прямой проброс в `raw.navigate`. Инжектится в Feature/Controller через `services.router`. `ICapsuleRouterContext<TUser>` — generic, app расширяет под свой shape (ADR 014). Тесты в node-env благодаря `wrap()` в типах, не в сервисе.

## Где что лежит

| Файл | Что |
|---|---|
| `packages/web/router/src/index.ts` | barrel: переэкспорт `createRouter`, `useRouter`, `RouterContext`, `RouterProvider`, `AnyRoute` + типы |
| `packages/web/router/src/service.ts` | `createRouter<TRouteTree>({ routeTree, context? })` — фабрика, value-импорт TanStack |
| `packages/web/router/src/types.ts` | `wrap()` + типы (`ICapsuleRouter`, `ICreateRouterOpts`, `ICapsuleRouterContext`) |
| `packages/web/router/src/context.ts` | `RouterContext` (Solid Context) + `useRouter()` hook с throw'ом вне Provider'а |
| `packages/web/router/src/__tests__/` | node-env: `wrap` (7), `useRouter` (2) — без jsdom |

## Public API

```ts
// Фабрика
createRouter<TRouteTree>({ routeTree, context? }): {
  raw: TanStackRouter<TRouteTree>;
  capsuleRouter: ICapsuleRouter<TRouteTree>;
}

// Hook
useRouter(): ICapsuleRouter   // generic TRouteTree теряется (см. гочи)

// Types
ICapsuleRouter<TRouteTree>             // { goTo, back, current, raw }
ICapsuleRouterContext<TUser = {}>      // TUser & { [k: string]: unknown }
IGoToOpts                              // { params?, search?, hash?, replace? }
ICreateRouterOpts<TRouteTree>
TanStackRouter                         // re-export @tanstack/solid-router Router
AnyRoute                               // re-export @tanstack/router-core
```

### Методы `ICapsuleRouter`

| Метод | Сигнатура | Реализация |
|---|---|---|
| `goTo` | `(path: string, opts?: IGoToOpts) => void` | `raw.navigate({ to: path, ...opts })`. `opts = { params, search, hash, replace }` (ADR 014) |
| `back` | `() => void` | `raw.history.back()` — через TanStack, не `window.history` |
| `current` | `() => string` | `raw.state.location.pathname` — реактивно через Solid-store TanStack |
| `raw` | property | Escape hatch; типизирован если `BaseProviders` параметризован `routeTree` |

## Lifecycle flow

```
apps/<app>/bootstrap.tsx
  └─ <BaseProviders routeTree={routeTree} routerContext={{ isAuthenticated: ... }}>
       └─ createRouter({ routeTree, context })  →  { raw, capsuleRouter }
            ├─ <RouterContext.Provider value={capsuleRouter}>
            │   └─ useRouter()  // hook читает контекст
            └─ <RouterProvider router={raw} />
                 └─ Route-компоненты
                      └─ Controller/Feature через createLogicWrapper:
                           services.router = capsuleRouter
                           handler({ ..., services }) → router.goTo('/path')
```

## Известные грабли

1. **`useRouter()` бросает вне Provider'а** — явная ошибка вместо silent-null. Для soft-dep (Storybook, unit-тесты, переиспользуемые компоненты) используй `useContext(RouterContext)` напрямую + null-check. Живой пример: `packages/web/ui/src/primitives/layout/switch.tsx:48`.

2. **`current()` реактивен — но через TanStack Solid-store, не через Capsule** — работает в JSX-getter (`<Animate keyed={router.current()}>`). НЕ кэшируй в `const` вне реактивного контекста — будет stale. В `createEffect` логику ставь внутри callback'а, не выноси в helper.

3. **`goTo()` принимает options-объект** (ADR 014) — `goTo(path, { params?, search?, hash?, replace? })`. Поля прямо мапятся в `raw.navigate({ to, ...opts })`. **Не путать со старой 2-arg формой** `goTo(path, params)` — она удалена, теперь `params` лежит внутри `opts`.

4. **`current()` возвращает только `pathname`** — без `?query` и `#hash`. Полный URL — `router.raw.state.location` (там `pathname` + `search` + `hash`).

5. **Generic `TRouteTree` теряется на `useRouter()`** — нет источника инференса. Решения: (a) явный cast `useRouter() as ICapsuleRouter<typeof routeTree>`, (b) `capsuleRouter` напрямую из `createRouter<T>(...)` (там generic виден). Module-augmentation паттерн TanStack `Register` — отдельный refactor (P3).

6. **`routerContext` обязан быть пробросан в `BaseProviders`, иначе guard'ы видят `undefined`** — если `__root.tsx` объявляет `MyRouterContext { isAuthenticated }`, а `<BaseProviders routerContext={...}>` пропущен, в `beforeLoad({context})` будет `context.isAuthenticated === undefined`. **На момент написания ни один из `apps/*` в репо не пробрасывает `routerContext`** — root-routes объявляют поле впустую. Не копипасти эту тишину, проверяй явный проброс.

7. **`ICapsuleRouterContext` — generic** (ADR 014): `<TUser extends object = {}>` → `TUser & { [k: string]: unknown }`. App пишет `ICapsuleRouterContext<{ isAuthenticated: boolean }>` или просто прокидывает объект — index signature разрешит «лишние» поля. `isAuthenticated?: boolean` больше **не** в default-shape, не путай со старым кодом до ADR 014.

8. **`wrap()` сидит в `types.ts`, не в `service.ts`** — сознательный split. `wrap` делает type-only импорт `@tanstack/solid-router` → тесты идут в node-env без jsdom. Value-импорт TanStack тянет `CatchBoundary` и прочие client-only Solid-API, падает на сервере. Не перетаскивай `wrap` в `service.ts`.

9. **`back()` идёт через `raw.history.back()`, не `window.history.back()`** — Single-source-of-truth от TanStack-истории. Готовит к SSR.

10. **`AnyRoute` ре-экспортнут именно из `@capsuletech/web-router`** — `web-core/BaseProviders` использует его как default-bound. НЕ импортируй `@tanstack/router-core` напрямую из web-core — это горизонтальный обход слоя.

## Pattern: derived signals from location

`useLocation()` **without** `select` returns `() => router.stores.location.get()` — accessor but **without createMemo**. Solid sometimes inlines such as pure value → derived signals don't track.

`useRouterState({ select: s => s.location.pathname })` returns `Solid.createMemo(...)` — guaranteed tracking.

**Rule:** for derived/computed pathname use `useRouterState({ select })`.

Precedent: page-transition attempt in ewc 2026-05-28; `<Animate keyed={location().pathname}>` didn't work (likely mix of factors), `useRouterState({select})` fixed reactivity at least on that level.

## Что менять когда

| Хочу… | Куда лезть |
|---|---|
| Добавить новое поле в `IGoToOpts` (e.g. `state?`) | `packages/web/router/src/types.ts > IGoToOpts` + spread в `wrap().goTo` (поле уйдёт в `raw.navigate` автоматически). Расширение shape — нужен ADR. |
| Добавить новый метод в `ICapsuleRouter` (e.g. `replace(path)`) | `packages/web/router/src/types.ts > ICapsuleRouter` + реализация в `wrap()` |
| Расширить `current()` под search/hash | Сейчас только `pathname`. Альтернативы: добавить `location(): { pathname, search, hash }` или опцию `current({ search: true })`. Нужен ADR. |
| Дать typed `TRouteTree` в `useRouter()` | Module-augmentation TanStack `Register` — отдельный refactor (P3) |
| Интегрировать в SSR | `wrap().back()` уже на `raw.history`; в `createRouter` добавить history-injection |
| Использовать TanStack hooks напрямую (`useNavigate`, `useRouterState`) | НЕ надо — иди через `useRouter()` → `router.raw.*` (ADR 003 раздел B) |

## Cross-links

- User-doc: [[router]]
- ADRs: [[003-router-context-based]], [[014-router-api-extension]]
- Connected: [[controller-proxy]], [[core]], [[vite-plugins|RouterPlugin]]
