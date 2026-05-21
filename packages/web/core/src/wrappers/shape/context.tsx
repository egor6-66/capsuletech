import { createContext, useContext } from 'solid-js';

/**
 * Объединённый namespace, который Shape-обёртка видит через `ShapeUiContext`.
 *
 * UI-примитивы кладутся на верхний уровень (backward-compat: `ui.Field` работает),
 * Views-реестр — под ключом `Views` (расширение: `ui.Views.Forms.Field`).
 *
 * Структура совпадает с тем, что View/Widget/Page кладут в провайдер:
 *   `{ ...Ui, Views: getGlobalRegistry('Views') }`
 */
export interface IShapeUiNamespace {
  /** Ui primitives spread at top level — backward-compat (`ui.Field`, `ui.Button`). */
  [k: string]: unknown;
  /** Views registry — user-defined composite Views (`ui.Views.Forms.Field`). */
  Views: Views;
}

/**
 * Контекст для проброса проксированного Ui + Views registry из View/Widget/Page в Shape.
 * View-обёртка (`ViewWrapper`), WidgetWrapper и PageWrapper оборачивают свой рендер в:
 *   `<ShapeUiContext.Provider value={{ ...Ui, Views: getGlobalRegistry('Views') }}>`
 * Shape-обёртка читает namespace через `useShapeUi()` для резолва `definition.as`.
 *
 * Path-tracker (`ui.Views.Forms.Field`) резолвится через `resolveByPath` по combined
 * namespace: Ui primitives at top-level, Views under `Views` key.
 */
export const ShapeUiContext = createContext<IShapeUiNamespace | null>(null);

export const useShapeUi = () => useContext(ShapeUiContext);
