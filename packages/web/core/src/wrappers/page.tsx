import { Outlet } from '@tanstack/solid-router';
import { useCtx } from '../engine/ctx';
import { UiProxy } from '../engine/ui-proxy';
import { Ui as BaseUi } from '../ui-kit';
import type { IPageWrapper } from './interfaces';
import { ShapeUiContext } from './shape';

export const PageWrapper: IPageWrapper = (Component) => {
  return function Page(wrapperProps) {
    const ctx = useCtx();
    const store = ctx?.store;
    const rawUi = {
      ...(BaseUi as any),
      Layout: (BaseUi as any).Layout,
      Outlet,
      Animate: (BaseUi as any).Animate,
    } as any;
    // Mirror view.tsx: wrap through UiProxy when inside a Controller-tree.
    // Pages are typically root-level (no Controller parent), so ctx is usually
    // undefined and rawUi passes through — but the proxy must be available for
    // the rare case of a Page rendered inside a Controller subtree.
    const proxiedUi = ctx ? UiProxy(rawUi, ctx, wrapperProps) : rawUi;
    return (
      <ShapeUiContext.Provider value={proxiedUi}>
        {Component(proxiedUi, store, wrapperProps)}
      </ShapeUiContext.Provider>
    );
  };
};
