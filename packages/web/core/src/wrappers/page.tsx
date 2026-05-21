import { Outlet } from '@tanstack/solid-router';
import { getGlobalRegistry } from '../engine/registry';
import { Ui } from '../ui-kit';
import type { IPageWrapper } from './interfaces';
import { ShapeUiContext } from './shape';

export const PageWrapper: IPageWrapper = (Component) => {
  return function Page() {
    // Позиционные аргументы: ui (Layout + Outlet), widgets.
    // ShapeUiContext.Provider даёт Shape'ам доступ к combined namespace:
    // { ...Ui, Views } — backward-compat ui.Field + новый ui.Views.Forms.Field.
    const shapeUiNs = { ...(Ui as object), Views: getGlobalRegistry('Views') } as any;
    return (
      <ShapeUiContext.Provider value={shapeUiNs}>
        {Component({ ...(Ui as any), Outlet } as any, getGlobalRegistry('Widgets'))}
      </ShapeUiContext.Provider>
    );
  };
};
