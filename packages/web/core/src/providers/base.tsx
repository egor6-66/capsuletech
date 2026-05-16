import { VitalsMonitoringProvider } from '@capsuletech/web-profiler';
import {
  type ICapsuleRouterContext,
  RouterContext,
  RouterProvider,
  createRouter,
} from '@capsuletech/web-router';
import { Show } from 'solid-js';

interface IBaseProviderProps {
  routeTree?: any;
  /** Initial-context роутера (для guards в TanStack-роутах). */
  routerContext?: ICapsuleRouterContext;
  children?: any;
}

export const BaseProviders = (props: IBaseProviderProps) => {
  return (
    <Show when={props.routeTree} fallback={props.children}>
      {(routeTree) => {
        const { raw, capsuleRouter } = createRouter({
          routeTree: routeTree(),
          context: props.routerContext,
        });
        return (
          <RouterContext.Provider value={capsuleRouter}>
            <RouterProvider router={raw as any} />
          </RouterContext.Provider>
        );
      }}
    </Show>
  );
  // return (
  //   <VitalsMonitoringProvider showDashboard={false}>
  //     <Show when={props.routeTree} fallback={props.children}>
  //       {(routeTree) => {
  //         const { raw, capsuleRouter } = createRouter({
  //           routeTree: routeTree(),
  //           context: props.routerContext,
  //         });
  //         return (
  //           <RouterContext.Provider value={capsuleRouter}>
  //             <RouterProvider router={raw as any} />
  //           </RouterContext.Provider>
  //         );
  //       }}
  //     </Show>
  //   </VitalsMonitoringProvider>
  // );
};
