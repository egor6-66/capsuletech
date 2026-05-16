import { Outlet } from '@tanstack/solid-router';

import type { IPageWrapper } from '../interfaces';
import { Ui } from './ui-kit';

/**
 * `Widgets` — рантайм-объект, кладётся на `globalThis` в `bootstrap.tsx`
 * (через `Object.assign(globalThis, await import('./registry/wrappers'))`).
 * Раньше использовался bare-identifier с AutoImport-инжекцией, но это
 * работало только при source-tree резолве `@capsuletech/web-core` (через
 * `development` exports). После публикации в npm/Verdaccio `dist/*.mjs`
 * не транспилируется AutoImport'ом — нужен глобал на runtime.
 */
const getWidgets = (): Widgets => (globalThis as any).Widgets ?? ({} as Widgets);

export const PageWrapper: IPageWrapper = (Component) => {
  return function Page() {
    // Позиционные аргументы: ui (Layout + Outlet), widgets.
    return Component({ ...(Ui as any), Outlet } as any, getWidgets());
  };
};
