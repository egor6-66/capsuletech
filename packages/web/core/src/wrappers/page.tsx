import { Outlet } from '@tanstack/solid-router';
import { getGlobalRegistry } from '../engine/registry';
import { Ui } from '../ui-kit';
import type { IPageWrapper } from './interfaces';
import { ShapeUiContext } from './shape';

export const PageWrapper: IPageWrapper = (Component) => {
  return function Page() {
    // Позиционные аргументы: ui (Layout + Outlet), widgets.
    // ShapeUiContext.Provider даёт Shape'ам доступ к Ui — Shape первоклассный
    // leaf, рендерится из Page без обёртки в View.
    return (
      <ShapeUiContext.Provider value={Ui}>
        {Component({ ...(Ui as any), Outlet } as any, getGlobalRegistry('Widgets'))}
      </ShapeUiContext.Provider>
    );
  };
};
