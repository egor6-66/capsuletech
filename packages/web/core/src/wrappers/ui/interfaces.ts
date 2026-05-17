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
import type { Component, JSX, JSXElement } from 'solid-js';

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
 * Глобальные slot-реестры. Заполняются codegen'ом в `.capsule/@types/slots.d.ts`
 * (ExportGeneratorPlugin). Здесь — пустые fallback-интерфейсы:
 *
 *  - используем `interface` (а не `type X = ...` через conditional), потому что
 *    interface merging с пустым fallback не порождает конфликта свойств — TS
 *    спокойно дополняет интерфейс из generated-файла;
 *  - имя интерфейса сохраняется в IDE-tooltip (`widgets: Widgets`), без
 *    раскрытия в полную структуру. Type alias через conditional раскрывается.
 */
declare global {
  interface Widgets {}
  interface Entities {}
  interface Controllers {}
  interface Features {}
  interface Shapes {}
  /**
   * Typed-proxy для `services.api` в Feature'ах. Пустой fallback здесь;
   * `EndpointsRegistryPlugin` сливает в него `InferApi<Endpoints>` через
   * `.capsule/@types/api.d.ts` (interface merging).
   */
  interface CapsuleApi {}
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
