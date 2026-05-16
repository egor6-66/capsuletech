import { cn, createStyle } from '@capsuletech/web-style';
import { splitProps } from 'solid-js';

import type { IFieldProps } from './interfaces';
import { fieldCva } from './variants';

export function Field(props: IFieldProps) {
  const [local, variants, others] = splitProps(props, ['class', 'style'], ['orientation']);

  const { className, style } = createStyle(fieldCva, {
    ...variants,
    class: local.class,
    style: local.style,
  });
  return <div role="group" data-slot="field" class={className()} style={style()} {...others} />;
}
