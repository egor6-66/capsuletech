import { createStyle } from '@capsule/web-style';
import { mergeProps, splitProps } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import type { ITypographyProps } from './interfaces';
import { typographyCva } from './variants';

export const Typography = (props: ITypographyProps) => {
  // 1. Устанавливаем дефолты (lead -> p, иначе по имени варианта или просто p)
  const merged = mergeProps({ variant: 'p' }, props);

  // 2. Разделяем пропсы
  const [local, variantProps, others] = splitProps(
    merged,
    ['class', 'style', 'as'],
    ['variant', 'color'], // добавляем color, так как он есть в твоем useStyle
  );

  // 3. Создаем реактивные стили
  const { className, style } = createStyle(typographyCva, {
    ...variantProps,
    class: local.class,
    style: local.style,
  });

  // 4. Логика выбора тега (реактивная)
  const componentTag = () => {
    if (local.as) return local.as;
    if (variantProps.variant === 'lead') return 'p';
    // Проверяем, является ли вариант валидным HTML тегом (h1, h2, p и т.д.)
    return variantProps.variant || 'p';
  };

  return <Dynamic component={componentTag()} class={className()} style={style()} {...others} />;
};
