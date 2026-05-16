import { createStyle } from '@capsuletech/web-style';
import { splitProps } from 'solid-js';

import type { IInputProps } from './interfaces';
import { inputCva } from './variants';

export const Input = (props: IInputProps) => {
  const [local, variants, others] = splitProps(
    props,
    ['class', 'style', 'type'],
    ['size', 'variant'],
  );

  const { className, style } = createStyle(inputCva, {
    ...variants,
    class: local.class,
    style: local.style,
  });

  return (
    <input
      type={local.type || 'text'}
      class={className()}
      style={style()}
      {...others} // здесь 'size' уже не будет, и ошибки в DOM не будет
    />
  );
};
