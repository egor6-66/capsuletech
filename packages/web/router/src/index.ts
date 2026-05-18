export { createRouter } from './service';
export { RouterContext, useRouter } from './context';
export type {
  ICapsuleRouter,
  ICapsuleRouterContext,
  ICreateRouterOpts,
  IGoToOpts,
  TanStackRouter,
} from './service';
/**
 * Re-export `AnyRoute` от TanStack — нужен потребителям как default-bound для
 * собственных generic'ов (например, `BaseProviders<TRouteTree extends AnyRoute>`).
 * Держим тут чтобы не плодить прямой импорт из `@tanstack/router-core` в web-core.
 */
export type { AnyRoute } from '@tanstack/router-core';

export { RouterProvider } from '@tanstack/solid-router';
