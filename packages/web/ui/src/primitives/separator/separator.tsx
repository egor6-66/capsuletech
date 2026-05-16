import { createStyle } from '@capsule/web-style';
import { Separator as SeparatorPrimitive } from '@kobalte/core/separator';
import { mergeProps, splitProps } from 'solid-js';
import type { ISeparatorProps } from './interfaces';
import { separatorCva } from './variants';

export const Separator = (props: ISeparatorProps) => {
  // Устанавливаем дефолты через mergeProps, чтобы сохранить реактивность
  const merged = mergeProps({ orientation: 'horizontal', decorative: true }, props);

  const [local, others] = splitProps(merged, [
    'class',
    'style',
    'orientation',
    'decorative',
    'variant',
  ]);

  // Вычисляем вариант: если явно не задан, берем из orientation
  const activeVariant = () => local.variant || local.orientation;

  const { className, style } = createStyle(separatorCva, {
    variant: activeVariant(), // передаем вычисленный вариант в CVA
    class: local.class,
    style: local.style,
  });

  return (
    <SeparatorPrimitive
      orientation={(local.orientation as 'horizontal' | 'vertical') || 'horizontal'}
      decorative={local.decorative}
      class={className()}
      style={style()}
      {...others}
    />
  );
};
