import { createStyle } from '@capsuletech/web-style';
import type { ValidComponent } from 'solid-js';
import { splitProps } from 'solid-js';

import { Slot } from '../slot';
import type { IButtonProps } from './interfaces';
import { buttonCva } from './variants';

/**
 * Button — полиморфный кнопка-компонент с CVA-вариантами.
 *
 * @example
 * ```tsx
 * <Button>Click</Button>
 * <Button variant="secondary" size="lg">Large Secondary</Button>
 * <Button as="a" href="/foo">Link Button</Button>
 * <Button size="icon"><Plus /></Button>
 * <Button disabled>Disabled</Button>
 * ```
 */
export const Button = <T extends ValidComponent = 'button'>(props: IButtonProps<T>) => {
  const [local, variants, others] = splitProps(props, ['class', 'style'], ['variant', 'size']);

  const { className, style } = createStyle(buttonCva, {
    ...variants,
    class: local.class,
    style: local.style,
  });

  const [polyProps, domProps] = splitProps(others, ['as']);

  return (
    <Slot
      as={(polyProps.as as T) ?? ('button' as T)}
      class={className()}
      style={style()}
      {...(domProps as any)}
    />
  );
};
