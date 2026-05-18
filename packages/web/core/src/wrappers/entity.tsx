import { useCtx } from '../engine/ctx';
import { getGlobalRegistry } from '../engine/registry';
import { UiProxy } from '../engine/ui-proxy';
import { Ui as BaseUi } from '../ui-kit';
import type { IEntityWrapper } from './interfaces';
import { ShapeUiContext } from './shape';

export const EntityWrapper: IEntityWrapper = (Component) => {
  return function Entity(wrapperProps) {
    const ctx = useCtx();

    // A-4: Entity вне Controller-tree — UiProxy не активируется, никакая meta
    // не регистрируется в store и не получает event-binding. Это разрешённый
    // случай (Entity может рендериться, например, в Storybook), но для
    // user-кода это обычно ошибка интеграции. DEV-only warn.
    if ((import.meta as { env?: { DEV?: boolean } }).env?.DEV && !ctx) {
      console.warn(
        '[Entity] rendered outside of Controller — UiProxy is disabled, ' +
          'any meta-tagged elements in this subtree will be decorative ' +
          '(no event binding, no store registration).',
      );
    }

    const Ui = ctx ? UiProxy(BaseUi, ctx, wrapperProps) : BaseUi;
    // ShapeUiContext.Provider даёт Shape'ам доступ к проксированному Ui —
    // это нужно для резолва `definition.as` (path-tracker) в правильный
    // wrapped-компонент с UiProxy-event-binding'ом.
    return (
      <ShapeUiContext.Provider value={Ui}>
        {Component(Ui as any, getGlobalRegistry('Shapes'))}
      </ShapeUiContext.Provider>
    );
  };
};
