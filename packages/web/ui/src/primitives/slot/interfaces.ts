import type { PolymorphicProps } from '@kobalte/core/polymorphic';
import type { ValidComponent } from 'solid-js';

/**
 * ISlotProps — полиморфные пропсы для компонента Slot.
 * Поддерживает любой HTML-элемент или кастомный компонент через `as` prop.
 *
 * @example
 * ```tsx
 * <Slot as="div" class="custom">Content</Slot>
 * <Slot as="span">Text</Slot>
 * <Slot as={CustomComponent}>With component</Slot>
 * ```
 */
export type ISlotProps<T extends ValidComponent = 'div'> = PolymorphicProps<T>;
