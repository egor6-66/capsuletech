import type { AnyRoute, AnyRouter, RouterCore } from '@tanstack/router-core';

/**
 * Initial-context роутера — пробрасывается в каждый TanStack-route как
 * `match.context`. Используется guard'ами (`beforeLoad`, `loader`).
 *
 * Generic `TUser` — application-specific shape (`{ isAuthenticated, tenant, ... }`).
 * Default `{}` — пустой context. Index signature `[k: string]: unknown` — это
 * backwards-compat предохранитель: TanStack пробрасывает context в guard'ы как
 * loose record, и без index signature TS ругается на «лишние» поля при
 * расширении на стороне app.
 *
 * См. [[014-router-api-extension|ADR 014]] — generic вместо зашитого
 * `isAuthenticated?: boolean`.
 */
// biome-ignore lint/complexity/noBannedTypes: empty-object default for structural intersection — `Record<string, never>` would forbid the `[k]: unknown` index signature below, breaking TanStack guard typing.
export type ICapsuleRouterContext<TUser extends object = {}> = TUser & {
  [k: string]: unknown;
};

/**
 * Опции навигации для `ICapsuleRouter.goTo`. Прямо мапятся в `raw.navigate({...})`
 * TanStack. См. [[014-router-api-extension|ADR 014]] — переход от
 * 2-аргументного `goTo(path, params)` к options-объекту.
 */
export interface IGoToOpts {
  /** Path-параметры маршрута (`:id` → `{ id: '...' }`). */
  params?: Record<string, unknown>;
  /** Query-параметры (`?tag=urgent&sort=date`). */
  search?: Record<string, unknown>;
  /** Anchor (`#section-1`). Без ведущего `#`. */
  hash?: string;
  /** `history.replaceState` вместо `pushState`. */
  replace?: boolean;
}

/**
 * Публичный API роутера, который инжектится в Controller/Feature через `services.router`.
 * Скрывает детали TanStack — если когда-то поменяем движок, signature останется.
 *
 * Generic `TRouteTree` пробрасывается в `raw` для типизированного escape-hatch'а
 * (`raw.navigate({...})` с autocomplete-маршрутами). По умолчанию — `AnyRoute`,
 * что эквивалентно прежнему `AnyRouter` контракту.
 */
export interface ICapsuleRouter<TRouteTree extends AnyRoute = AnyRoute> {
  goTo(path: string, opts?: IGoToOpts): void;
  back(): void;
  current(): string;
  /** Escape hatch для случаев, когда нужны API-возможности TanStack напрямую. */
  raw: RouterCore<TRouteTree, any, any, any, any>;
}

/**
 * Опции фабрики. `routeTree` обязателен, generic выводится из него; `context` —
 * initial-context роутера для guards.
 */
export interface ICreateRouterOpts<TRouteTree extends AnyRoute = AnyRoute> {
  routeTree: TRouteTree;
  context?: ICapsuleRouterContext;
}

/**
 * Пакетная обёртка над сырым TanStack-роутером. Вынесена отдельно от `createRouter`,
 * чтобы её можно было тестировать без value-импорта `@tanstack/solid-router`
 * (тот тянет клиентские Solid-API и падает в node-env). Принимает любой
 * `AnyRouter` — generic'и выведутся в публичной фабрике.
 */
export const wrap = <TRouteTree extends AnyRoute = AnyRoute>(
  raw: AnyRouter,
): ICapsuleRouter<TRouteTree> => ({
  raw: raw as RouterCore<TRouteTree, any, any, any, any>,
  goTo: (path, opts) => {
    raw.navigate({ to: path, ...opts } as never);
  },
  back: () => {
    raw.history.back();
  },
  current: () => raw.state.location.pathname,
});
