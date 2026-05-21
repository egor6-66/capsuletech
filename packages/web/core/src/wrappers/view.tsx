import { useCtx } from '../engine/ctx';
import { getGlobalRegistry } from '../engine/registry';
import { UiProxy } from '../engine/ui-proxy';
import { Ui as BaseUi } from '../ui-kit';
import type { IViewWrapper } from './interfaces';
import { ShapeUiContext } from './shape';

export const ViewWrapper: IViewWrapper = (Component) => {
  return function View(wrapperProps) {
    const ctx = useCtx();

    // A-4: View вне Controller-tree — UiProxy не активируется, никакая meta
    // не регистрируется в store и не получает event-binding. Это разрешённый
    // случай (View может рендериться, например, в Storybook), но для
    // user-кода это обычно ошибка интеграции. DEV-only warn.
    if ((import.meta as { env?: { DEV?: boolean } }).env?.DEV && !ctx) {
      console.warn(
        '[View] rendered outside of Controller — UiProxy is disabled, ' +
          'any meta-tagged elements in this subtree will be decorative ' +
          '(no event binding, no store registration).',
      );
    }

    const Ui = ctx ? UiProxy(BaseUi, ctx, wrapperProps) : BaseUi;
    // ShapeUiContext.Provider даёт Shape'ам доступ к проксированному Ui +
    // Views registry. Combined namespace: { ...Ui, Views } позволяет Shape'у
    // ссылаться как на Ui-примитивы (`ui.Field`), так и на Views (`ui.Views.Forms.Field`).
    const shapeUiNs = { ...(Ui as object), Views: getGlobalRegistry('Views') } as any;
    return (
      <ShapeUiContext.Provider value={shapeUiNs}>
        {Component(Ui as any, getGlobalRegistry('Shapes'))}
      </ShapeUiContext.Provider>
    );
  };
};
