import { Outlet } from '@tanstack/solid-router';

import type { IPageWrapper } from '../interfaces';
import { getGlobalRegistry } from '../registry';
import { Ui } from './ui-kit';

export const PageWrapper: IPageWrapper = (Component) => {
  return function Page() {
    // Позиционные аргументы: ui (Layout + Outlet), widgets.
    return Component({ ...(Ui as any), Outlet } as any, getGlobalRegistry('Widgets'));
  };
};
