import type { VariantProps } from 'class-variance-authority';
import type { JSX, ValidComponent } from 'solid-js';

import type { ISlotProps } from '../slot';
import type { buttonCva } from './variants';

export type ButtonVariants = VariantProps<typeof buttonCva>;

/**
 * IButtonOwnProps — специфичные для Button пропсы (не из DOM).
 * `class` и `style` дублируем явно, чтобы `splitProps` корректно типизировался
 * на дженерик-сигнатуре `T extends ValidComponent`.
 */
export interface IButtonOwnProps extends ButtonVariants {
  class?: string;
  style?: JSX.CSSProperties | string;
}

/**
 * IButtonProps — полиморфные пропсы Button.
 * По умолчанию рендерится как <button>, но может быть любой элемент/компонент через `as`.
 *
 * @example
 * ```tsx
 * <Button>Click me</Button>                          // <button>
 * <Button as="a" href="/foo">Go</Button>             // <a href="/foo">
 * <Button as={Link} to="/page">Navigate</Button>     // <Link to="/page">
 * <Button variant="secondary" size="lg">Large</Button>
 * <Button size="icon"><Plus /></Button>              // icon-only
 * ```
 */
export type IButtonProps<T extends ValidComponent = 'button'> = ISlotProps<T> & IButtonOwnProps;
