import { createContext, useContext } from 'solid-js';

/**
 * Контекст для проброса проксированного Ui из View/Widget/Page в Shape.
 * View-обёртка (`ViewWrapper`), WidgetWrapper и PageWrapper оборачивают
 * свой рендер в `ShapeUiContext.Provider value={Ui}`; Shape-обёртка читает
 * Ui через `useShapeUi()` для резолва `definition.as` (см. ui-tracker).
 * Shape — первоклассный leaf, рендерится из любого слоя.
 */
export const ShapeUiContext = createContext<unknown>(null);

export const useShapeUi = () => useContext(ShapeUiContext);
