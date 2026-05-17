/**
 * Public types of `@capsuletech/web-core` wrappers.
 *
 * Слиты в один файл из `ui/interfaces.ts` + `logic/interfaces.ts` после Phase E
 * рестракта — два искусственных кластера wrappers/ui/ + wrappers/logic/ убраны,
 * соответственно их type-партиционирование тоже теряло смысл. Внутренние
 * engine-типы (`ICtx`, `IControllerHandle`) живут в `engine/ctx.ts`.
 */

import type {
  IBaseStateHandlers,
  IBaseStateSchema,
  IBridge,
} from '@capsuletech/web-state';
import type { ICapsuleRouter } from '@capsuletech/web-router';
import type { Component, JSX, JSXElement } from 'solid-js';
import type {
  Animate,
  Button,
  Card,
  Field,
  Input,
  Layout,
  List,
  Navigation,
} from '@capsuletech/web-ui';

// -----------------------------------------------------------------------------
// UI-вкус: что приходит wrapper'ам в первый позиционный аргумент.
// -----------------------------------------------------------------------------

type EntityUi = {
  Field: typeof Field;
  Button: typeof Button;
  Input: typeof Input;
  List: typeof List;
  Navigation: typeof Navigation;
  Animate: typeof Animate;
};

type Outlet = () => JSXElement;

type WidgetUi = { Card: typeof Card; Outlet: Outlet; Animate: typeof Animate };
type PageUi = { Layout: typeof Layout; Outlet: Outlet; Animate: typeof Animate };

/**
 * Глобальные slot-реестры. Заполняются codegen'ом в
 * `.capsule/@types/slots.d.ts` (ExportGeneratorPlugin). Здесь — пустые
 * fallback-интерфейсы; через interface merging они расширяются user-кодом.
 *
 * Используем `interface` (а не `type X = ...` через conditional), потому что:
 *  - interface merging с пустым fallback не порождает конфликта свойств;
 *  - имя интерфейса сохраняется в IDE-tooltip без раскрытия в полную структуру.
 */
declare global {
  interface Widgets {}
  interface Entities {}
  interface Controllers {}
  interface Features {}
  interface Shapes {}
  // CapsuleApi живёт в @capsuletech/web-query/createApi.ts — родной дом
  // (это типизация getApiClient). web-core видит её через interface-merging,
  // потому что зависит от web-query (для value-import getApiClient).
}

type Wrapper<T extends (...args: any[]) => JSX.Element> = (component: T) => Component<any>;

/**
 * Entity: stateless UI. Позиционные аргументы:
 * 1. UI-примитивы entity-уровня (Field, Button, Input, List, Navigation).
 * 2. Shapes — реестр data-шейпов (zod-схемы + дефолты + render-prop'ы).
 */
export type IEntityRenderer = (ui: EntityUi, shapes: Shapes) => JSX.Element;
export type IEntityWrapper = Wrapper<IEntityRenderer>;

/**
 * Widget: композиция всего что ниже. Позиционные аргументы:
 * 1. UI-примитивы widget-уровня
 * 2. Features
 * 3. Controllers
 * 4. Entities
 */
export type IWidgetRenderer = (
  ui: WidgetUi,
  features: Features,
  controllers: Controllers,
  entities: Entities,
) => JSX.Element;
export type IWidgetWrapper = Wrapper<IWidgetRenderer>;

/**
 * Page: композиция widget'ов через layout. Позиционные аргументы:
 * 1. UI page-уровня (Layout, Outlet)
 * 2. Widgets
 */
export type IPageRenderer = (ui: PageUi, widgets: Widgets) => JSX.Element;
export type IPageWrapper = Wrapper<IPageRenderer>;

// -----------------------------------------------------------------------------
// Logic-вкус: FSM-schema + handler-API для Controller/Feature.
// -----------------------------------------------------------------------------

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

export type { IRegisteredComponent } from '@capsuletech/web-state';

export interface IHandlerApi<TCtx = any> {
  target: ITarget;
  context: TCtx;
  next: <T = any>(payload?: any) => Promise<T | null>;
  state: IStateApi;
  store: IBridge;
}

/**
 * Per-state user-handlers. Расширяет engine-shape `IBaseStateHandlers` из
 * `@capsuletech/web-state` (shared-base паттерн, см. Phase F unification),
 * добавляя `IHandlerApi`-типизацию для UI-событий и custom-методов.
 */
export interface IStateHandlers extends IBaseStateHandlers {
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

/**
 * Полный публичный shape HCA-схемы. Расширяет `IBaseStateSchema` из
 * `@capsuletech/web-state` (engine-minimum: `initial`, `context`, `states`),
 * добавляя HCA-specific lifecycle (`onMount`) и top-level fallback handlers
 * (`onClick`/`onInput`/...).
 */
export interface IDefineStateSchema<TCtx = any> extends IBaseStateSchema<TCtx> {
  states: Record<string, IStateHandlers>;
  /**
   * Lifecycle: фаерит **реактивно** при каждой регистрации/анрегистрации
   * компонента в `store.components`. То есть первый вызов — на mount'е (часто
   * с пустым реестром, до того как дети успели зарегистрироваться), затем по
   * разу на каждого нового потомка (включая lazy-загруженных через
   * `lazy(import())`, TanStack lazy-routes, Suspense-fallback'и).
   *
   * Обязательное условие: callback должен быть идемпотентным.
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

export interface IServices {
  router: ICapsuleRouter;
  /**
   * Typed API — собран `createApi(...)` из endpoints. Инжектится ТОЛЬКО в Feature
   * (compliance запрещает IO в Controller'е). `undefined` если приложение не
   * вызвало `setApiClient(...)` (т.е. в `capsule.app.ts` нет поля `api`).
   *
   * Тип `CapsuleApi` — глобальный interface; пустой fallback здесь сливается
   * через interface merging с `EndpointsRegistryPlugin`'овой `.capsule/@types/
   * api.d.ts` → `services.api.user.get({ id })` корректно типизируется.
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

// Re-export Shape types для удобства потребителей.
export type {
  IShapeComponent,
  IShapeComponentProps,
  IShapeDefinition,
  IShapeFactory,
  IShapeRender,
  IShapeTemplateProps,
  IShapeUi,
  IShapeWrapper,
  ShapeItem,
} from './shape/types';
