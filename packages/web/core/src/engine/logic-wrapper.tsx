import { getApiClient } from '@capsuletech/web-query';
import { useRouter } from '@capsuletech/web-router';
import { createBridge, createState } from '@capsuletech/web-state';
import { CompositeProxyContext } from '@capsuletech/web-ui/compositeProxy';
import { useMachine } from '@xstate/solid';
import { createEffect, onCleanup, Suspense } from 'solid-js';
import type {
  IDefineStateSchema,
  IHandlerApi,
  INext,
  IServices,
  IStateApi,
  IWrapperProps,
} from '../wrappers/interfaces';
import { ControllerProxy } from './controller-proxy';
import { Context, useCtx } from './ctx';
import { bindEvents } from './ui-proxy';

type Kind = 'controller' | 'feature';

export const createLogicWrapper =
  (kind: Kind) => (defineStateSchema: (services: IServices) => IDefineStateSchema) =>
    function LogicWrapper(props: IWrapperProps) {
      const parent = useCtx();
      const router = useRouter();

      // Feature получает `api` (typed proxy из createApi) дополнительно. Controller
      // — только `router`: compliance запрещает IO в Controller'е, а api именно про IO.
      const services: IServices = kind === 'feature' ? { router, api: getApiClient() } : { router };

      const schema = defineStateSchema(services);

      const machine = createState(schema);
      const [state, send] = useMachine(machine);

      const store = createBridge(state, send);

      const controller = ControllerProxy({
        schema,
        state,
        send,
        store,
        parent,
        overrides: props.overrides,
      });

      const stateApi: IStateApi = {
        get current() {
          return state.value as string;
        },
        set: (name: string) => send({ type: `__GOTO_${name}__` }),
        matches: (n: string | string[]) =>
          Array.isArray(n) ? n.includes(state.value as string) : state.value === n,
      };

      // Lifecycle hooks don't have a parent UI event, so `next()` is a no-op.
      // Cast keeps `next` shape (callable + `.with`) without polluting the
      // public INext type with optional surface.
      const lifecycleNext = Object.assign(async () => null, {
        with: async () => null,
      }) as unknown as INext;

      const lifecycleApi = (): IHandlerApi => ({
        target: {},
        context: store.ctx,
        store,
        state: stateApi,
        next: lifecycleNext,
      });

      // Lifecycle: onInit / onExit, плюс initial-onInit на mount
      let prevState: string | undefined;
      createEffect(() => {
        const current = state.value as string;
        if (prevState === undefined) {
          schema.states[current]?.onInit?.(lifecycleApi());
        } else if (prevState !== current) {
          schema.states[prevState]?.onExit?.(lifecycleApi());
          schema.states[current]?.onInit?.(lifecycleApi());
        }
        prevState = current;
      });

      // Top-level `onRegister` фаерит РЕАКТИВНО при каждой регистрации компонента
      // в `store.components`. Так оно корректно работает с lazy-детьми (lazy()
      // из registry, TanStack lazy-routes, Suspense), которые регистрируются
      // позже первого тика рендера.
      //
      // От пользователя требуется идемпотентность — типичный кейс
      // (пересинхронизировать active-state с router'ом) ему естественно соответствует.
      // XState `assign({components: ...})` создаёт новый ref на каждый REGISTER_COMPONENT,
      // поэтому подписка через чтение `store.components` срабатывает на каждую регистрацию.
      createEffect(() => {
        void store.components;
        schema.onRegister?.(lifecycleApi());
      });

      onCleanup(() => {
        // schema.onDispose — единственный teardown-хук. Async-возврат не ждём
        // (Solid onCleanup синхронный); сами ошибки логируем, чтобы случайный
        // throw не валил unmount Solid-дерева.
        try {
          const r = schema.onDispose?.(lifecycleApi());
          if (r && typeof (r as Promise<unknown>).catch === 'function') {
            (r as Promise<unknown>).catch((err) =>
              console.error('[LogicWrapper] onDispose async failed:', err),
            );
          }
        } catch (err) {
          console.error('[LogicWrapper] onDispose sync threw:', err);
        }
      });

      // Захватываем ctx в замыкании для CompositeProxyContext.wrap.
      // ctx — это объект с controller/store/state того же LogicWrapper'а,
      // который UiProxy уже использует для event-dispatch.
      const ctx = { controller, state, store, parent };

      return (
        <Suspense fallback={props.fallback}>
          <Context.Provider value={ctx}>
            <CompositeProxyContext.Provider
              value={{ wrap: (Comp, name) => bindEvents(ctx, Comp, name) }}
            >
              {props.children}
            </CompositeProxyContext.Provider>
          </Context.Provider>
        </Suspense>
      );
    };
