/**
 * Public types of `@capsuletech/web-core` wrappers.
 *
 * Слиты в один файл из `ui/interfaces.ts` + `logic/interfaces.ts` после Phase E
 * рестракта — два искусственных кластера wrappers/ui/ + wrappers/logic/ убраны,
 * соответственно их type-партиционирование тоже теряло смысл. Внутренние
 * engine-типы (`ICtx`, `IControllerHandle`) живут в `engine/ctx.ts`.
 */

import type { ICapsuleRouter } from '@capsuletech/web-router';
import type { IBaseStateHandlers, IBaseStateSchema, IBridge } from '@capsuletech/web-state';
import type {
  Animate,
  Button,
  Card,
  DataTable,
  Field,
  Group,
  Input,
  Layout,
  List,
  Table,
} from '@capsuletech/web-ui';
import type { DarkModeToggle, ThemeSwitcher } from '@capsuletech/web-style';
import type { MapView } from '@capsuletech/web-map';
import type { Component, JSX, JSXElement } from 'solid-js';

// -----------------------------------------------------------------------------
// UiProxy meta-props: дополнительные props, которые UiProxy перехватывает
// и НЕ прокидывает в реальный web-ui компонент. Добавляются к каждому
// компоненту в Ui-namespace на уровне типов — так TS принимает
// `<Ui.Input meta={{tags: ['email']}} />` без TS2322.
//
// Why here (web-core) а не в web-ui:
//   web-ui не знает ничего про UiProxy/meta-registration. Эти props существуют
//   только в HCA-контексте, когда View рендерится внутри Controller-tree.
//   web-ui компоненты — чистые DOM/style primitives, не HCA-aware.
// -----------------------------------------------------------------------------

/** Meta-теги для идентификации элемента в Controller store. */
export interface ITagMeta {
  tags?: string[];
  [k: string]: any;
}

/**
 * Дополнительные props, принимаемые UiProxy-обёрткой для каждого Ui-компонента.
 * Runtime: UiProxy их перехватывает через `splitProps` / читает напрямую —
 * в итоговый web-ui компонент они НЕ попадают (DOM их не увидит).
 *
 * @see engine/ui-proxy.tsx — `wrapComponent`, политика C (own meta opt-in).
 */
export interface IUiMetaProps {
  /**
   * Идентификация элемента (теги-роли). Активирует opt-in регистрацию
   * в Controller store + event-binding для 6 событий.
   * Без `meta` — сквозной рендер без побочных эффектов.
   */
  meta?: ITagMeta;
  /**
   * Immutable JSX-declared payload от автора View:
   * `<Ui.Nav meta={{tags:['nav']}} payload={{href:'/home'}}>` → `target.payload.href`.
   * Не меняется при bubble через `next()` — каждый уровень цепочки видит
   * один и тот же payload, заданный в JSX. Для трансформации между уровнями
   * используй `next.with(arg)` → `target.from`.
   */
  payload?: unknown;
  /**
   * Дополнительный meta из outer View-prop (Widget/Shape передаёт contextual
   * теги). Не активирует регистрацию — только дополняет target при dispatch'е.
   */
  dynamicMeta?: ITagMeta;
  /**
   * Keyboard modifiers для `onKeyDown`. Заполняется UiProxy автоматически из
   * KeyboardEvent; при явном указании — переопределяет.
   */
  modifiers?: {
    ctrl?: boolean;
    shift?: boolean;
    alt?: boolean;
    meta?: boolean;
  };
}

/**
 * Вспомогательный тип: из callable-значения извлекает только «прикреплённые»
 * статические свойства — те ключи `T`, которые не входят в прототип `Function`
 * (`name`, `length`, `call`, `apply`, `bind`, `prototype`, `toString` и т.д.).
 *
 * Используется внутри `WithMetaProps` чтобы сохранить `Card.Header`, `Field.Label`,
 * `Navigation.Item` и т.п. после augmentation callable-сигнатуры с `IUiMetaProps`.
 *
 * Пример: `typeof Card` = `Component<ICardProps> & { Header: ...; Title: ...; ... }`
 * После применения — intersection callable + mapped static props.
 */
type StaticProps<T> = {
  // biome-ignore lint/complexity/noBannedTypes: intentional use of keyof Function to filter function-prototype keys in mapped type
  [K in keyof T as K extends keyof Function ? never : K]: T[K];
};

/**
 * Применяет `IUiMetaProps` к каждому компоненту в Ui-namespace рекурсивно.
 *
 * Правила маппинга:
 *  - Callable `(props: P) => R` без attached statics → `(props: P & IUiMetaProps) => R`
 *  - Callable `(props: P) => R` с attached statics (Card, Field) →
 *    `((props: P & IUiMetaProps) => R) & WithMetaProps<StaticProps<T[K]>>`
 *    Статические sub-компоненты тоже рекурсивно augment'ятся `IUiMetaProps`.
 *  - Plain object (Layout namespace `{ Grid, Flex, Matrix }`) → рекурсивный
 *    `WithMetaProps<T[K]>`
 *  - Всё остальное (Outlet, примитивы) → без изменений
 *
 * Этот тип **намеренно не экспортируется** как публичный API — он используется
 * только для типизации аргументов `IViewRenderer`/`IWidgetRenderer`/`IPageRenderer`.
 * Пользователь видит расширенные типы только через autocomplete на `Ui.*`.
 */
type WithMetaProps<T> = {
  [K in keyof T]: T[K] extends (props: infer P) => infer R
    ? ((props: P & IUiMetaProps) => R) & WithMetaProps<StaticProps<T[K]>>
    : T[K] extends object
      ? WithMetaProps<T[K]>
      : T[K];
};

// -----------------------------------------------------------------------------
// UI-вкус: что приходит wrapper'ам в первый позиционный аргумент.
// -----------------------------------------------------------------------------

type ViewUiRaw = {
  Field: typeof Field;
  Button: typeof Button;
  Group: typeof Group;
  Input: typeof Input;
  List: typeof List;
  Animate: typeof Animate;
  Table: typeof Table;
  DataTable: typeof DataTable;
  ThemeSwitcher: typeof ThemeSwitcher;
  DarkModeToggle: typeof DarkModeToggle;
  MapView: typeof MapView;
};

type Outlet = () => JSXElement;

type WidgetUiRaw = { Card: typeof Card; Outlet: Outlet; Animate: typeof Animate; Layout: typeof Layout; Table: typeof Table; DataTable: typeof DataTable; ThemeSwitcher: typeof ThemeSwitcher; DarkModeToggle: typeof DarkModeToggle; MapView: typeof MapView };
type PageUiRaw = { Layout: typeof Layout; Outlet: Outlet; Animate: typeof Animate };

/** Ui namespace доступный внутри View factory — все компоненты принимают IUiMetaProps. */
export type ViewUi = WithMetaProps<ViewUiRaw>;
/** Ui namespace доступный внутри Widget factory — все компоненты принимают IUiMetaProps. */
export type WidgetUi = WithMetaProps<WidgetUiRaw>;
/** Ui namespace доступный внутри Page factory — все компоненты принимают IUiMetaProps. */
export type PageUi = WithMetaProps<PageUiRaw>;

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
  /**
   * Placeholder для будущего domain data layer (User, Product — zod schema + meta).
   * Не используется wrappers'ами — зарезервировано под domain-entities.
   * UI JSX-leaf переехал в Views.
   */
  interface Entities {}
  /** UI JSX-leaf реестр (бывший Entities). Заполняется codegen'ом. */
  interface Views {}
  interface Controllers {}
  interface Features {}
  interface Shapes {}
  // CapsuleApi живёт в @capsuletech/web-query/createApi.ts — родной дом
  // (это типизация getApiClient). web-core видит её через interface-merging,
  // потому что зависит от web-query (для value-import getApiClient).
}


/**
 * View: stateless UI. Позиционные аргументы:
 * 1. UI-примитивы view-уровня (Field, Button, Input, List, Navigation).
 * 2. props — внешние props, переданные в компонент-обёртку (опционально).
 *    Используется для «generic View template» паттерна: когда View рендерится
 *    через `<Dynamic component={Template} {...tplProps} />` (например внутри
 *    Shape `as`), item-данные (label, type, name, tags) приходят сюда.
 *    Если factory подписана без 2-го аргумента — backward-compat гарантирован
 *    (лишний аргумент JS просто игнорирует).
 *
 * Registries (Views/Shapes/Controllers/Features) доступны как глобалы через
 * `Object.assign(globalThis, _registry)` в bootstrap. Не нужны как args.
 */
export type IViewRenderer<P extends Record<string, any> = Record<string, any>> = (
  ui: ViewUi,
  props: P,
) => JSX.Element;

/**
 * IViewWrapper: `View(factory)` → `Component<P>`.
 *
 * Generic над `P` позволяет типизировать props на call site:
 *   `const Field = View<FieldTplProps>((ui, props) => ...)`
 * Без generic — `P` инферируется как `Record<string, any>`, что backward-совместимо
 * с существующими factory'ями `(ui) => JSX` (лишний arg JS игнорирует).
 * Constraint `P extends Record<string, any>` нужен чтобы соответствовать
 * `Component<P>` от Solid.
 */
export type IViewWrapper = <P extends Record<string, any> = Record<string, any>>(
  component: IViewRenderer<P>,
) => Component<P>;

/**
 * Widget: композиция всего что ниже. Позиционные аргументы:
 * 1. UI-примитивы widget-уровня.
 * 2. props — внешние props (опционально).
 *
 * Registries (Views/Features/Controllers) доступны как глобалы через
 * `Object.assign(globalThis, _registry)` в bootstrap. Не нужны как args.
 */
export type IWidgetRenderer<P extends Record<string, any> = Record<string, any>> = (
  ui: WidgetUi,
  props: P,
) => JSX.Element;
export type IWidgetWrapper = <P extends Record<string, any> = Record<string, any>>(
  component: IWidgetRenderer<P>,
) => Component<P>;

/**
 * Page: корневой layout. Позиционные аргументы:
 * 1. UI page-уровня (Layout, Outlet).
 * 2. props — внешние props (опционально).
 *
 * Registries (Widgets) доступны как глобалы через
 * `Object.assign(globalThis, _registry)` в bootstrap. Не нужны как args.
 */
export type IPageRenderer<P extends Record<string, any> = Record<string, any>> = (
  ui: PageUi,
  props: P,
) => JSX.Element;
export type IPageWrapper = <P extends Record<string, any> = Record<string, any>>(
  component: IPageRenderer<P>,
) => Component<P>;

// -----------------------------------------------------------------------------
// Logic-вкус: FSM-schema + handler-API для Controller/Feature.
// -----------------------------------------------------------------------------

export interface ITarget {
  name?: string;
  value?: unknown;
  type?: string;
  /** Идентификация (теги-роли). Только `{ tags }` — данные кладутся в `payload`. */
  meta?: ITagMeta;
  /** Сценарная окраска от Widget'а. */
  dynamicMeta?: ITagMeta;
  /**
   * **Immutable JSX-declared payload** автора Entity:
   * `<Nav.Item meta={{tags:['nav']}} payload={{href:'/branches'}}>` → `target.payload.href`.
   *
   * Не меняется при bubble через `next()` / `next.with()` — каждый уровень
   * цепочки видит один и тот же payload, заданный в JSX. Для трансформации
   * между уровнями используй `target.from` (см. ниже) + `next.with(arg)`.
   */
  payload?: unknown;
  /**
   * Данные, которые **непосредственный предыдущий уровень** цепочки передал
   * через `next.with(arg)`. Сбрасывается в `undefined`:
   *  - на первом уровне (прямой UI-event, нет «предыдущего»),
   *  - при пассивном bubble через `next()` (без аргумента — нет явного сигнала).
   *
   * Контракт: каждый handler видит **только** `from` от своего непосредственного
   * ребёнка, не аккумулируется через цепочку. Если хочешь форвардить дальше —
   * пиши явно: `await next.with(target.from)`.
   */
  from?: unknown;
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

/**
 * Bubble-up функция:
 *  - `next()` — пассивный bubble к родителю; `target.payload` сохраняется (immutable),
 *    `target.from` сбрасывается в `undefined` (нет явного сигнала от этого уровня).
 *  - `next.with(arg)` — bubble с явной передачей `arg` родителю как `target.from`.
 *    `target.payload` всё ещё JSX-immutable.
 *
 * Возврат — `null` если у Controller'а нет parent'а или у parent'а нет метода
 * с таким именем (с учётом `overrides`). Иначе — то, что вернул handler родителя.
 */
export interface INext {
  <T = any>(): Promise<T | null>;
  with: <T = any>(arg: unknown) => Promise<T | null>;
}

export interface IHandlerApi<TCtx = any> {
  target: ITarget;
  context: TCtx;
  next: INext;
  state: IStateApi;
  store: IBridge;
}

/** Расширение `IHandlerApi` для `schema.onError` — добавляет сам `error` + `method`. */
export interface IErrorHandlerApi<TCtx = any> extends IHandlerApi<TCtx> {
  error: unknown;
  method: string;
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
   * стейт FSM (фаер на каждом переходе FSM); `onRegister` — про настройку
   * реактивного состояния по составу UI-дерева.
   *
   * Если нужен одноразовый hook на mount Controller'а — используй `states[initial].onInit`.
   * Если нужен teardown — используй [[onDispose]].
   */
  onRegister?: (api: IHandlerApi) => any;
  /**
   * Lifecycle: один раз на unmount Controller/Feature (Solid `onCleanup`).
   * Зеркало `states[initial].onInit` на конце жизни — используй для:
   *  - отписки от внешних source'ов (event listeners, intervals, WebSocket'ы);
   *  - финализации side-effect'ов (flushing analytics, persist state);
   *  - явного teardown того, что было создано в `onRegister`/`onInit`.
   *
   * Вызывается **после** Solid disposed дочерние UiProxy-обёртки
   * (которые сами отрабатывают `unregisterComponent`), так что `store.components`
   * на этот момент уже пуст. Не пытайся читать состав UI-дерева отсюда.
   */
  onDispose?: (api: IHandlerApi) => any;
  /**
   * Централизованный error-hook: фаерит, когда handler (per-state или top-level)
   * бросил/reject'нул. Получает обычный `IHandlerApi` + сам `error` + `method`
   * (имя метода в schema, который упал).
   *
   * Контракт:
   *  - вызывается **до** того как ошибка пробрасывается дальше;
   *  - re-throw из самой `onError` логируется и **глотается** (нельзя ронять teardown);
   *  - ошибка handler'а всё равно re-throw'ается из ControllerProxy после `onError` —
   *    т.е. `next()` цепочка наверху ловит её через свой `try/await`. Если хочешь
   *    подавить пробрасывание — лови в самом handler'е через `try/catch`.
   *
   * Полезно для: централизованный setErrors → store, sentry-репорт, fallback-логика.
   */
  onError?: (api: IErrorHandlerApi) => any;
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
  /**
   * Опциональный fallback для встроенного `<Suspense>` вокруг детей Controller/Feature.
   * Если `undefined` — Suspense без fallback'а (suspend пробросится к ближайшему
   * предку с fallback'ом). Имеет смысл задавать, когда внутри есть lazy-импорты
   * (UI-kit, lazy-routes), которые могут suspend'нуть.
   */
  fallback?: JSXElement;
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
  IShapeUi,
  IShapeWrapper,
  ShapeItem,
} from './shape/types';

// Re-export Entity types для удобства потребителей.
export type { IEntityDefinition, IEntityFactory, IEntityWrapper } from './entity/types';
