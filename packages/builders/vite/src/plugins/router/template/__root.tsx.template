import { Outlet, createRootRouteWithContext } from '@tanstack/solid-router';

interface MyRouterContext {
  isAuthenticated: boolean;
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  component: () => (
    <>
      <Outlet />
    </>
  ),
});
