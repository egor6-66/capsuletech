import { createStyle } from '@capsuletech/web-style';
import { splitProps } from 'solid-js';
import type { ILabelProps } from './interfaces';
import { labelCva } from './variants';

export const Label = (props: ILabelProps) => {
  const [local, others] = splitProps(props, ['class', 'style']);

  const { className, style } = createStyle(labelCva, {
    class: local.class,
    style: local.style,
  });
  // @ts-expect-error — others is a heterogeneous splitProps remainder; spread is intentional
  // biome-ignore lint/a11y/noLabelWithoutControl: standalone Label primitive — control association is delegated to the consumer via htmlFor / id in ...others.
  return <label class={className()} style={style()} {...others} />;
};
