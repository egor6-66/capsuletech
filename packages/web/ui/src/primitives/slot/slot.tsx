import { Polymorphic } from '@kobalte/core/polymorphic';
import type { ValidComponent } from 'solid-js';
import { splitProps } from 'solid-js';
import type { ISlotProps } from './interfaces';

/**
 * Slot — полиморфный компонент для render-prop паттерна через `as` prop.
 *
 * Основное использование:
 * - Оборачивание компонентов в другие теги/компоненты через `as`.
 * - Прокидывание стилей и классов на underlying элемент.
 * - Merge класса и style выполняются автоматически через Solid-spread.
 *
 * @example
 * ```tsx
 * // Базовое использование
 * <Slot as="div" class="wrapper">
 *   Content
 * </Slot>
 *
 * // С кастомным компонентом
 * <Slot as={Link} href="/foo">
 *   Navigate
 * </Slot>
 * ```
 */
export const Slot = <T extends ValidComponent = 'div'>(props: ISlotProps<T>) => {
  // Достаём `as` из props
  const [polyProps, others] = splitProps(props, ['as']);

  return <Polymorphic as={(polyProps.as as T) ?? ('div' as T)} {...(others as any)} />;
};
