import { createStyle } from '@capsuletech/web-style';
import type { DynamicProps, HandleProps, RootProps } from '@corvu/resizable';
import ResizablePrimitive from '@corvu/resizable';
import type { ValidComponent } from 'solid-js';
import { Show, splitProps } from 'solid-js';

import { GripIcon } from './grip-icon';
import { resizableHandleCva, resizableRootCva } from './variants';

type ResizableRootProps<T extends ValidComponent = 'div'> = RootProps<T> & {
  class?: string;
  style?: string | Record<string, string | number>;
};

export const ResizableRoot = <T extends ValidComponent = 'div'>(
  props: DynamicProps<T, ResizableRootProps<T>>,
) => {
  const [local, rest] = splitProps(props as ResizableRootProps, ['class', 'style']);
  const { className, style } = createStyle(resizableRootCva, {
    class: local.class,
    style: local.style,
  });
  return <ResizablePrimitive class={className()} style={style()} {...rest} />;
};

export const ResizablePanel = ResizablePrimitive.Panel;

type ResizableHandleProps<T extends ValidComponent = 'button'> = HandleProps<T> & {
  class?: string;
  style?: string | Record<string, string | number>;
  withHandle?: boolean;
};

export const ResizableHandle = <T extends ValidComponent = 'button'>(
  props: DynamicProps<T, ResizableHandleProps<T>>,
) => {
  const [local, rest] = splitProps(props as ResizableHandleProps, ['class', 'style', 'withHandle']);
  const { className, style } = createStyle(resizableHandleCva, {
    class: local.class,
    style: local.style,
  });
  return (
    <ResizablePrimitive.Handle class={className()} style={style()} {...rest}>
      <Show when={local.withHandle}>
        <GripIcon />
      </Show>
    </ResizablePrimitive.Handle>
  );
};
