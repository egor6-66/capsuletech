import { createStyle } from '@capsuletech/web-style';
import { For, type JSX, splitProps } from 'solid-js';
import type { INavigationItemProps, INavigationListProps, INavigationProps } from './interfaces';
import { navigationCva, navigationItemCva, navigationListCva } from './variants';

export const Navigation = (props: INavigationProps) => {
  const [local, variants, others] = splitProps(
    props,
    ['class', 'style', 'children'],
    ['orientation'],
  );

  const { className, style } = createStyle(navigationCva, {
    ...variants,
    class: local.class,
    style: local.style,
  });

  return (
    <nav class={className()} style={style()} {...others}>
      {local.children as JSX.Element}
    </nav>
  );
};

export function NavigationList<T = any>(props: INavigationListProps<T>) {
  const [local, others] = splitProps(props, ['class', 'style', 'children', 'orientation', 'items']);

  const { className, style } = createStyle(navigationListCva, {
    orientation: local.orientation || 'horizontal',
    class: local.class,
    style: local.style,
  });

  return (
    // @ts-expect-error
    <ul class={className()} style={style()} {...others}>
      <For each={local.items}>{(item, index) => local.children(item, index)}</For>
    </ul>
  );
}

export const NavigationItem = (props: INavigationItemProps) => {
  const [local, variants, others] = splitProps(
    props,
    ['class', 'style', 'children', 'active', 'disabled'],
    ['variant', 'size'],
  );

  // ВАЖНО: передаём props в createStyle через геттеры. Если написать
  // `{ variant: local.active ? 'active' : 'default', ...variants, class: local.class }`
  // — JS прочитает все значения один раз при render'е, и createMemo внутри
  // createStyle никогда больше не пересчитается на смену `local.active` /
  // `variants.variant` / `local.class`. Геттеры дают Solid отследить чтения.
  const styleProps = {
    get variant() {
      return local.active ? 'active' : variants.variant;
    },
    get size() {
      return variants.size;
    },
    get class() {
      return local.class;
    },
    get style() {
      return local.style;
    },
  };

  const { className, style } = createStyle(navigationItemCva, styleProps);

  return (
    <li>
      <a
        class={className()}
        style={style()}
        aria-current={local.active ? 'page' : undefined}
        aria-disabled={local.disabled || undefined}
        {...others}
      >
        {local.children as JSX.Element}
      </a>
    </li>
  );
};
