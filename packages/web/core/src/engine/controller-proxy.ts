import type { IDefineStateSchema, IStateApi, ITarget } from '../wrappers/interfaces';
import type { ICtx } from './ctx';

interface IControllerProxyParams {
  schema: IDefineStateSchema;
  /** реактивный snapshot из useMachine */
  state: any;
  send: (event: any) => void;
  store: any;
  parent?: ICtx<any>;
  overrides?: Record<string, string>;
}

const buildStateApi = (state: any, send: any): IStateApi => ({
  get current() {
    return state.value as string;
  },
  set: (name: string) => send({ type: `__GOTO_${name}__` }),
  matches: (n: string | string[]) =>
    Array.isArray(n) ? n.includes(state.value as string) : state.value === n,
});

export const ControllerProxy = ({
  schema,
  state,
  send,
  store,
  parent,
  overrides,
}: IControllerProxyParams): any => {
  return new Proxy({} as any, {
    get(_, methodName: string) {
      // системные поля
      if (methodName === 'store') return store;
      if (methodName === 'destroy') return () => {};

      return async (target: ITarget, context: any) => {
        const current = state.value as string;
        const stateHandlers = schema.states?.[current];
        const method = stateHandlers?.[methodName] ?? (schema as any)[methodName];

        const stateApi = buildStateApi(state, send);

        const next = async <T = any>(payload: any = null): Promise<T | null> => {
          if (!parent?.controller) return null;
          const enrichedTarget = { ...target, payload: payload ?? target.payload };
          const targetMethod = overrides?.[methodName] ?? methodName;
          // `?? null`: optional-chain в parent даёт undefined при missing method,
          // но тип возврата `Promise<T | null>` обещает null — выравниваем.
          // Тест в __tests__/proxy.test.ts (`next() returns null if parent has no matching method`).
          return (await parent.controller[targetMethod]?.(enrichedTarget, context)) ?? null;
        };

        // если метод не найден — автобабблинг к родителю
        if (typeof method !== 'function') return await next();

        try {
          return await method({ target, context, next, store, state: stateApi });
        } catch (err) {
          console.error(`[Controller] метод "${methodName}" в стейте "${current}" упал:`, err);
          throw err;
        }
      };
    },
  });
};
