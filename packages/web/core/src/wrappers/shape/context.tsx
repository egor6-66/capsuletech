import { createContext, useContext } from 'solid-js';

/**
 * Контекст для проброса проксированного Ui из Entity в Shape. Entity-обёртка
 * (`EntityWrapper`) оборачивает свой рендер в `ShapeUiContext.Provider value={Ui}`;
 * Shape-обёртка читает Ui через `useShapeUi()` для резолва `definition.as`
 * (см. ui-tracker).
 */
export const ShapeUiContext = createContext<unknown>(null);

export const useShapeUi = () => useContext(ShapeUiContext);
