import { Outlet } from '@tanstack/solid-router';
import { getGlobalRegistry } from '../engine/registry';
import { Ui } from '../ui-kit';
import type { IWidgetWrapper } from './interfaces';
import { ShapeUiContext } from './shape';

export const WidgetWrapper: IWidgetWrapper = (Component) => {
  return function Widget() {
    // Позиционные аргументы: ui, features, controllers, views.
    // Ui приходит флэтом (все примитивы); тип renderer'а сужает до WidgetUi.
    // ShapeUiContext.Provider даёт Shape'ам доступ к combined namespace:
    // { ...Ui, Views } — backward-compat ui.Field + новый ui.Views.Forms.Field.
    const views = getGlobalRegistry('Views');
    const shapeUiNs = { ...(Ui as object), Views: views } as any;
    return (
      <ShapeUiContext.Provider value={shapeUiNs}>
        {Component(
          { ...(Ui as any), Outlet } as any,
          getGlobalRegistry('Features'),
          getGlobalRegistry('Controllers'),
          views,
        )}
      </ShapeUiContext.Provider>
    );
  };
};
