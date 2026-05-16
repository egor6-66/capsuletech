import { createStyle } from '@capsuletech/web-style';
import { splitProps } from 'solid-js';
import { Grid } from './grid';
import type { ILayoutProps } from './interfaces';
import { layoutCva } from './variants';

export const Layout = (props: ILayoutProps) => {
  const [local, variantProps] = splitProps(props, ['class', 'style', 'ref'], ['variant']);

  const { className, style } = createStyle(layoutCva, {
    variant: variantProps.variant,
    class: local.class,
    style: local.style,
  });

  return (
    <div ref={local.ref} class={className()} style={style()}>
      <Grid {...(props as ILayoutProps)} />
    </div>
  );
};
