import { createStyle } from '@capsuletech/web-style';
import { splitProps } from 'solid-js';
import { Grid } from './grid';
import type { ILayoutProps } from './interfaces';
import { slot } from './slot';
import { layoutCva } from './variants';

const LayoutImpl = (props: ILayoutProps) => {
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

/**
 * Layout — top-level раскладка с слотами. У компонента есть static-метод
 * `Layout.slot(config)` — identity-хелпер, который даёт TS-автокомплит для
 * object-формы слота (см. {@link slot}). HMR-safe: статический property
 * приписан через `Object.assign` после объявления функции.
 */
export const Layout = Object.assign(LayoutImpl, { slot });
