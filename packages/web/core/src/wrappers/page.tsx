import { Outlet } from '@tanstack/solid-router';
import { getGlobalRegistry } from '../engine/registry';
import { Ui } from '../ui-kit';
import type { IPageWrapper } from './interfaces';

export const PageWrapper: IPageWrapper = (Component) => {
  return function Page() {
    // Позиционные аргументы: ui (Layout + Outlet), widgets.
    return Component({ ...(Ui as any), Outlet } as any, getGlobalRegistry('Widgets'));
  };
};
