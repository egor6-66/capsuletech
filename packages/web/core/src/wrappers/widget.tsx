import { Outlet } from '@tanstack/solid-router';
import { useCtx } from '../engine/ctx';
import { UiProxy } from '../engine/ui-proxy';
import { Ui as BaseUi } from '../ui-kit';
import type { IWidgetWrapper } from './interfaces';
import { ShapeUiContext } from './shape';

export const WidgetWrapper: IWidgetWrapper = (Component) => {
  return function Widget(wrapperProps) {
    const ctx = useCtx();
    const store = ctx?.store;
    const rawUi = { ...(BaseUi as any), Outlet } as any;
    // Mirror view.tsx: wrap through UiProxy when inside a Controller-tree so
    // meta-tagged elements in a Widget get event-binding and store registration.
    // When Widget is rendered outside a Controller (e.g. standalone Storybook or
    // top-level Page without a logical parent), rawUi passes through unchanged.
    const proxiedUi = ctx ? UiProxy(rawUi, ctx, wrapperProps) : rawUi;
    return (
      <ShapeUiContext.Provider value={proxiedUi}>
        {Component(proxiedUi, store, wrapperProps)}
      </ShapeUiContext.Provider>
    );
  };
};
