import { cn } from '@capsuletech/web-style';
import { type JSX, splitProps, type ValidComponent } from 'solid-js';
import { mergeStyle, toGap } from '../grid/utils';
import { Slot } from '../slot';
import type { FlexAlign, FlexDirection, FlexJustify, FlexWrap, IFlexProps } from './interfaces';

// Статические таблицы → Tailwind purge видит все классы в исходниках.
const DIRECTION: Record<FlexDirection, string> = {
  row: 'flex-row',
  'row-reverse': 'flex-row-reverse',
  col: 'flex-col',
  'col-reverse': 'flex-col-reverse',
};

const WRAP: Record<FlexWrap, string> = {
  wrap: 'flex-wrap',
  nowrap: 'flex-nowrap',
  'wrap-reverse': 'flex-wrap-reverse',
};

const ALIGN: Record<FlexAlign, string> = {
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
  stretch: 'items-stretch',
  baseline: 'items-baseline',
};

const JUSTIFY: Record<FlexJustify, string> = {
  start: 'justify-start',
  center: 'justify-center',
  end: 'justify-end',
  between: 'justify-between',
  around: 'justify-around',
  evenly: 'justify-evenly',
};

/**
 * Flex — низкоуровневая Flexbox-обёртка для страниц и виджетов.
 *
 * @example
 * ```tsx
 * <Flex gap={2} align="center">
 *   <Icon /> <span>Label</span>
 * </Flex>
 *
 * <Flex direction="col" gap={4} justify="between" class="h-full">
 *   <Header /> <Main /> <Footer />
 * </Flex>
 *
 * <Flex inline gap="0.5rem"><Tag /><Tag /></Flex>
 * ```
 */
export const Flex = <T extends ValidComponent = 'div'>(props: IFlexProps<T>) => {
  const [own, polyAndRest] = splitProps(props, [
    'direction',
    'wrap',
    'align',
    'justify',
    'gap',
    'gapX',
    'gapY',
    'inline',
    'class',
    'style',
  ]);
  const [poly, others] = splitProps(polyAndRest, ['as']);

  const classes = () =>
    cn(
      own.inline ? 'inline-flex' : 'flex',
      own.direction && DIRECTION[own.direction],
      own.wrap && WRAP[own.wrap],
      own.align && ALIGN[own.align],
      own.justify && JUSTIFY[own.justify],
      own.class,
    );

  const computed = (): JSX.CSSProperties => {
    const s: JSX.CSSProperties = {};
    if (own.gap !== undefined) s.gap = toGap(own.gap);
    if (own.gapX !== undefined) s['column-gap'] = toGap(own.gapX);
    if (own.gapY !== undefined) s['row-gap'] = toGap(own.gapY);
    return s;
  };

  return (
    <Slot
      as={(poly.as as T) ?? ('div' as T)}
      class={classes()}
      style={mergeStyle(computed(), own.style) as never}
      {...(others as object)}
    />
  );
};
