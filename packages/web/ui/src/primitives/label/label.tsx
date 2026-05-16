import { splitProps } from 'solid-js';

import { createStyle } from '@capsuletech/web-style';
import type { ILabelProps } from './interfaces';
import { labelCva } from './variants';

export const Label = (props: ILabelProps) => {
  const [local, others] = splitProps(props, ['class', 'style']);

  const { className, style } = createStyle(labelCva, {
    class: local.class,
    style: local.style,
  });
  // @ts-ignore
  // biome-ignore lint/a11y/noLabelWithoutControl: <explanation>
  return <label class={className()} style={style()} {...others} />;
};
