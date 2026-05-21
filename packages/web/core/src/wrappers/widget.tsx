import { Outlet } from '@tanstack/solid-router';
import { getGlobalRegistry } from '../engine/registry';
import { Ui } from '../ui-kit';
import type { IWidgetWrapper } from './interfaces';
import { ShapeUiContext } from './shape';

export const WidgetWrapper: IWidgetWrapper = (Component) => {
  return function Widget() {
    // Позиционные аргументы: ui, features, controllers, views.
    // Ui приходит флэтом (все примитивы); тип renderer'а сужает до WidgetUi.
    // ShapeUiContext.Provider даёт Shape'ам доступ к Ui — Shape первоклассный
    // leaf, рендерится из Widget без обёртки в View.
    return (
      <ShapeUiContext.Provider value={Ui}>
        {Component(
          { ...(Ui as any), Outlet } as any,
          getGlobalRegistry('Features'),
          getGlobalRegistry('Controllers'),
          getGlobalRegistry('Views'),
        )}
      </ShapeUiContext.Provider>
    );
  };
};
