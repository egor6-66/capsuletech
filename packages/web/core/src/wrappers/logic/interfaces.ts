export interface ITagMeta {
  tags?: string[];
  [k: string]: any;
}

export interface ITarget {
  name?: string;
  value?: unknown;
  type?: string;
  /** Идентификация (теги-роли). Только `{ tags }` — данные кладутся в `payload`. */
  meta?: ITagMeta;
  /** Сценарная окраска от Widget'а. */
  dynamicMeta?: ITagMeta;
  /**
   * Двойная семантика в зависимости от уровня цепочки:
   *  - **На первом уровне** (прямой UI-click): JSX-declared payload автора Entity
   *    (`<Nav.Item meta={{tags:['nav']}} payload={{href:'/branches'}}>` → `target.payload.href`).
   *  - **При bubble через `next(arg)`** в Controller: ControllerProxy перетирает
   *    его аргументом `next()` — Feature получит то, что Controller передал наверх.
   */
  payload?: unknown;
  /** для keyboard-событий */
  key?: string;
  modifiers?: { ctrl: boolean; shift: boolean; alt: boolean; meta: boolean };
}

export interface IStateApi {
  current: string;
  set: (name: string) => void;
  matches: (name: string | string[]) => boolean;
}

import type { IBridge } from '@capsuletech/web-state';
export type { IRegisteredComponent } from '@capsuletech/web-state';

export interface IHandlerApi<TCtx = any> {
  target: ITarget;
  context: TCtx;
  next: <T = any>(payload?: any) => Promise<T | null>;
  state: IStateApi;
  store: IBridge;
}

export interface IStateHandlers {
  onInit?: (api: IHandlerApi) => void | Promise<void>;
  onExit?: (api: IHandlerApi) => void | Promise<void>;
  onClick?: (api: IHandlerApi) => any;
  onInput?: (api: IHandlerApi) => any;
  onChange?: (api: IHandlerApi) => any;
  onBlur?: (api: IHandlerApi) => any;
  onFocus?: (api: IHandlerApi) => any;
  onKeyDown?: (api: IHandlerApi) => any;
  /** пользовательские методы (для приёма от next()) */
  [methodName: string]: ((api: IHandlerApi) => any) | undefined;
}

export interface IDefineStateSchema<TCtx = any> {
  initial: string;
  context?: TCtx;
  states: Record<string, IStateHandlers>;
  /**
   * Lifecycle: фаерит **реактивно** при каждой регистрации/анрегистрации
   * компонента в `store.components`. То есть первый вызов — на mount'е
   * (часто с пустым реестром, до того как дети успели зарегистрироваться),
   * затем по разу на каждого нового потомка (включая lazy-загруженных через
   * `lazy(import())`, TanStack lazy-routes, Suspense-fallback'и).
   *
   * Типичный паттерн — пересинхронизировать derived-state по тегам:
   * ```
   * onMount: ({ store }) => {
   *   const items = store.pick(['nav']);
   *   store.setProps(...computePatch(items, router.current()));
   * }
   * ```
   * Обязательное условие: callback должен быть идемпотентным
   * (несколько вызовов с одним и тем же набором компонентов = тот же эффект).
   *
   * Семантически отличается от `states[X].onInit`: последний — про вход в
   * стейт FSM (фаер на каждом переходе FSM); `onMount` — про настройку
   * реактивного состояния по составу UI-дерева.
   */
  onMount?: (api: IHandlerApi) => any;
  /** top-level fallback handlers */
  onInit?: (api: IHandlerApi) => any;
  onExit?: (api: IHandlerApi) => any;
  onClick?: (api: IHandlerApi) => any;
  onInput?: (api: IHandlerApi) => any;
  onChange?: (api: IHandlerApi) => any;
  onBlur?: (api: IHandlerApi) => any;
  onFocus?: (api: IHandlerApi) => any;
  onKeyDown?: (api: IHandlerApi) => any;
  [methodName: string]: any;
}

import type { ICapsuleRouter } from '@capsuletech/web-router';

export interface IServices {
  router: ICapsuleRouter;
  /**
   * Typed API — собран `createApi(...)` из endpoints. Инжектится ТОЛЬКО в Feature
   * (compliance запрещает IO в Controller'е). `undefined` если приложение не вызвало
   * `setApiClient(...)` (т.е. в `capsule.app.ts` нет поля `api`).
   *
   * Тип `CapsuleApi` — глобальный interface; пустой fallback в `@capsuletech/web-core`
   * сливается через interface merging с `EndpointsRegistryPlugin`'овой
   * `.capsule/@types/api.d.ts` → `services.api.user.get({ id })` корректно типизируется.
   */
  api?: CapsuleApi;
  [k: string]: any;
}

export type IWrapperProps = {
  children: any;
  overrides?: Record<string, string>;
};

export type IControllerWrapper = (
  defineStateSchema: (services: IServices) => IDefineStateSchema,
) => (props: IWrapperProps) => any;

export type IFeatureWrapper = IControllerWrapper;
