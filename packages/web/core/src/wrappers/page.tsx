import { Outlet } from '@tanstack/solid-router';
import { Ui } from '../ui-kit';
import type { IPageWrapper } from './interfaces';
import { ShapeUiContext } from './shape';

export const PageWrapper: IPageWrapper = (Component) => {
  return function Page(wrapperProps) {
    const pageUi = {
      ...(Ui as any),
      Layout: (Ui as any).Layout,
      Outlet,
      Animate: (Ui as any).Animate,
    } as any;
    return (
      <ShapeUiContext.Provider value={pageUi}>
        {Component(pageUi, wrapperProps)}
      </ShapeUiContext.Provider>
    );
  };
};
