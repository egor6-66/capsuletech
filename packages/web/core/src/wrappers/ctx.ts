import type { IBridge } from '@capsuletech/web-state';
import { createContext, useContext } from 'solid-js';

/**
 * Controller-proxy facade: имена методов → async-handlers, плюс системные поля.
 * Тип отражает Proxy-таргет из `wrappers/logic/utils/proxy.ts`. Method-сигнатуры
 * у user-controller'ов динамические (schema-driven), поэтому index-signature
 * остаётся `any` — без него Proxy-based dispatch не типизируется без массивов
 * generic-параметров на каждый Controller.
 */
export interface IControllerHandle {
  /** Реактивный bridge — exposed как удобный alias внутри handlers. */
  store: IBridge;
  /** Reserved — currently no-op (см. P2 #9 cleanup-plan: возможный teardown extension point). */
  destroy?: () => void;
  /** Schema-defined methods: `controller.<name>(target, context)`. */
  // biome-ignore lint/suspicious/noExplicitAny: см. JSDoc выше.
  [methodName: string]: any;
}

/**
 * Контекст HCA-runtime'а, общий для UiProxy + Controller-tree. `state` — это
 * реактивный snapshot из `useMachine` (НЕ сам StateMachine — это распространённая
 * путаница; до P2 #4 типизировалось как `AnyStateMachine`, что было неверно).
 * Generic `T` сохраняем для совместимости — кастится через `useCtx<TSnapshot>()`.
 */
// biome-ignore lint/suspicious/noExplicitAny: state — реактивный xstate snapshot, тип зависит от schema.
export interface ICtx<T = any> {
  state: T;
  store: IBridge;
  controller: IControllerHandle;
  /** У root-Controller'а родителя нет — потому optional. */
  parent?: ICtx;
}

export const Context = createContext<ICtx>();

// biome-ignore lint/suspicious/noExplicitAny: см. ICtx<T>.
export const useCtx = <T = any>() => useContext(Context) as ICtx<T>;
