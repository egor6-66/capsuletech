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
  /**
   * Включить Vitals-мониторинг (Web Vitals + Dashboard). По умолчанию выключен,
   * чтобы прод-бандлы apps/<app> не тянули overhead профайлера без необходимости.
   *
   *  - `true` — оборачивает дерево в `VitalsMonitoringProvider` с дашбордом.
   *  - `false` / `undefined` — без обёртки.
   *
   * Для тонкой настройки (например, `showDashboard={false}` под staging-сборку)
   * — пока обращаемся к `<VitalsMonitoringProvider>` напрямую из приложения.
   */
  vitals?: boolean;
  children?: any;
}

export const BaseProviders = (props: IBaseProviderProps) => {
  const tree = (
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

  return (
    <Show when={props.vitals} fallback={tree}>
      <VitalsMonitoringProvider>{tree}</VitalsMonitoringProvider>
    </Show>
  );
};
