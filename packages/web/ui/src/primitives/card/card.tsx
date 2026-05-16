import { createStyle } from '@capsule/web-style';
import { splitProps } from 'solid-js';

import type { ICardProps } from './interfaces';
import { cardCva } from './variants';

export const Card = (props: ICardProps) => {
  const [local, variants, others] = splitProps(props, ['class', 'style'], ['variant', 'size']);

  const { className, style } = createStyle(cardCva, {
    ...variants,
    class: local.class,
    style: local.style,
  });
  return <div class={className()} style={style()} {...others} />;
};
