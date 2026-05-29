import { Outlet } from '@tanstack/solid-router';
import { useCtx } from '../engine/ctx';
import { Ui } from '../ui-kit';
import type { IWidgetWrapper } from './interfaces';
import { ShapeUiContext } from './shape';

export const WidgetWrapper: IWidgetWrapper = (Component) => {
  return function Widget(wrapperProps) {
    const ctx = useCtx();
    const store = ctx?.store;
    const baseUi = { ...(Ui as any), Outlet } as any;
    return (
      <ShapeUiContext.Provider value={baseUi}>
        {Component(baseUi, store, wrapperProps)}
      </ShapeUiContext.Provider>
    );
  };
};
