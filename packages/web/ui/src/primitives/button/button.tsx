import { createStyle } from '@capsuletech/web-style';
import { Loader2 } from 'lucide-solid';
import type { ValidComponent } from 'solid-js';
import { Show, splitProps } from 'solid-js';

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
 * <Button loading>Sign in</Button>
 * <Button loading={someSignal()}>Submit</Button>
 * ```
 */
export const Button = <T extends ValidComponent = 'button'>(props: IButtonProps<T>) => {
  const [local, variants, loadingProps, others] = splitProps(
    props,
    ['class', 'style'],
    ['variant', 'size'],
    ['loading', 'disabled', 'children'],
  );

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
      disabled={loadingProps.loading || loadingProps.disabled}
      {...(domProps as any)}
    >
      <Show when={loadingProps.loading} fallback={loadingProps.children}>
        <Loader2 class="animate-spin" />
      </Show>
    </Slot>
  );
};
