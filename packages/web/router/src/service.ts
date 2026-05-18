import type { AnyRoute } from '@tanstack/router-core';
import {
  createRouter as createTanStackRouter,
  type Router as TanStackRouter,
} from '@tanstack/solid-router';
import {
  type ICapsuleRouter,
  type ICapsuleRouterContext,
  type ICreateRouterOpts,
  type IGoToOpts,
  wrap,
} from './types';

/**
 * Создать инстанс TanStack-роутера и обернуть его в `ICapsuleRouter`.
 * Возвращает пару: «сырой» роутер для `<RouterProvider>` и обёртка для services.
 *
 * Generic `TRouteTree` выводится из `opts.routeTree` — у вызывающей стороны
 * получаются типизированные `raw.navigate({ to: '...' })` без явного указания
 * generic-параметра.
 */
export const createRouter = <TRouteTree extends AnyRoute>(opts: ICreateRouterOpts<TRouteTree>) => {
  const raw = createTanStackRouter({
    routeTree: opts.routeTree,
    context: opts.context ?? {},
  });

  return {
    raw: raw as TanStackRouter<TRouteTree>,
    capsuleRouter: wrap<TRouteTree>(raw as never),
  };
};

export type { ICapsuleRouter, ICapsuleRouterContext, ICreateRouterOpts, IGoToOpts, TanStackRouter };
