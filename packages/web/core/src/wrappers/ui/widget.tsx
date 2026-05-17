import { Outlet } from '@tanstack/solid-router';
import type { IWidgetWrapper } from '../interfaces';
import { getGlobalRegistry } from '../registry';
import { Ui } from './ui-kit';

export const WidgetWrapper: IWidgetWrapper = (Component) => {
  return function Widget() {
    // Позиционные аргументы: ui, features, controllers, entities.
    // Ui приходит флэтом (все примитивы); тип renderer'а сужает до WidgetUi.
    return Component(
      { ...(Ui as any), Outlet } as any,
      getGlobalRegistry('Features'),
      getGlobalRegistry('Controllers'),
      getGlobalRegistry('Entities'),
    );
  };
};
