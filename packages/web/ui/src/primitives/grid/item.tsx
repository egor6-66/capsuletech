import { cn } from '@capsuletech/web-style';
import { type JSX, splitProps, type ValidComponent } from 'solid-js';
import { Slot } from '../slot';
import type { IGridItemProps } from './interfaces';
import { mergeStyle } from './utils';

/**
 * Grid.Item — декларативная обёртка для дочернего блока CSS Grid.
 *
 * @example
 * ```tsx
 * <Grid cols={12} gap={4}>
 *   <Grid.Item span={6}>Half</Grid.Item>
 *   <Grid.Item span={6}>Half</Grid.Item>
 * </Grid>
 *
 * <Grid areas={['header header', 'sidebar main']}>
 *   <Grid.Item area="header" />
 *   <Grid.Item area="sidebar" />
 *   <Grid.Item area="main" />
 * </Grid>
 * ```
 */
export const Item = <T extends ValidComponent = 'div'>(props: IGridItemProps<T>) => {
  const [own, polyAndRest] = splitProps(props, [
    'span',
    'rowSpan',
    'colStart',
    'colEnd',
    'rowStart',
    'rowEnd',
    'area',
    'class',
    'style',
  ]);
  const [poly, others] = splitProps(polyAndRest, ['as']);

  const styleFor = (): JSX.CSSProperties => {
    const s: JSX.CSSProperties = {};
    if (own.area) s['grid-area'] = own.area;
    if (own.span !== undefined) s['grid-column'] = `span ${own.span}`;
    if (own.rowSpan !== undefined) s['grid-row'] = `span ${own.rowSpan}`;
    if (own.colStart !== undefined) s['grid-column-start'] = String(own.colStart);
    if (own.colEnd !== undefined) s['grid-column-end'] = String(own.colEnd);
    if (own.rowStart !== undefined) s['grid-row-start'] = String(own.rowStart);
    if (own.rowEnd !== undefined) s['grid-row-end'] = String(own.rowEnd);
    return s;
  };

  return (
    <Slot
      as={(poly.as as T) ?? ('div' as T)}
      class={cn(own.class)}
      style={mergeStyle(styleFor(), own.style) as never}
      {...(others as object)}
    />
  );
};
