import { cn } from '@capsuletech/web-style';
import { type JSX, splitProps, type ValidComponent } from 'solid-js';
import { Slot } from '../slot';
import type { IGridProps } from './interfaces';
import { Item } from './item';
import { mergeStyle, toAreas, toGap, toTrack } from './utils';

/**
 * Grid — низкоуровневая CSS Grid обёртка для страниц и виджетов. Не путать
 * с внутренним `LayoutSwitch` в `primitives/layout/switch.tsx`: тот — приватный
 * диспетчер вариантов `<Layout>`, а этот — полноценный publish primitive в
 * духе Mantine/Chakra.
 *
 * @example
 * ```tsx
 * <Grid cols={3} gap={4}>
 *   <Card /><Card /><Card />
 * </Grid>
 *
 * <Grid cols="200px 1fr 200px" rows={['auto', '1fr', 'auto']} gap={2}>
 *   …
 * </Grid>
 *
 * <Grid areas={['header header', 'sidebar main']} cols="200px 1fr">
 *   <Grid.Item area="header"><Header /></Grid.Item>
 *   <Grid.Item area="sidebar"><Sidebar /></Grid.Item>
 *   <Grid.Item area="main"><Main /></Grid.Item>
 * </Grid>
 * ```
 */
const GridImpl = <T extends ValidComponent = 'div'>(props: IGridProps<T>) => {
  const [own, polyAndRest] = splitProps(props, [
    'cols',
    'rows',
    'gap',
    'gapX',
    'gapY',
    'areas',
    'autoFlow',
    'autoRows',
    'autoCols',
    'inline',
    'class',
    'style',
  ]);
  const [poly, others] = splitProps(polyAndRest, ['as']);

  const computed = (): JSX.CSSProperties => {
    const s: JSX.CSSProperties = {};
    if (own.cols !== undefined) s['grid-template-columns'] = toTrack(own.cols);
    if (own.rows !== undefined) s['grid-template-rows'] = toTrack(own.rows);
    if (own.areas) s['grid-template-areas'] = toAreas(own.areas);
    if (own.gap !== undefined) s.gap = toGap(own.gap);
    if (own.gapX !== undefined) s['column-gap'] = toGap(own.gapX);
    if (own.gapY !== undefined) s['row-gap'] = toGap(own.gapY);
    if (own.autoFlow) s['grid-auto-flow'] = own.autoFlow;
    if (own.autoRows) s['grid-auto-rows'] = own.autoRows;
    if (own.autoCols) s['grid-auto-columns'] = own.autoCols;
    return s;
  };

  return (
    <Slot
      as={(poly.as as T) ?? ('div' as T)}
      class={cn(own.inline ? 'inline-grid' : 'grid', own.class)}
      style={mergeStyle(computed(), own.style) as never}
      {...(others as object)}
    />
  );
};

/**
 * `Grid` с статикой `.Item`. Приписана через `Object.assign` после объявления
 * функции, чтобы HMR не ломался (см. ту же технику в `Layout.slot`).
 */
export const Grid = Object.assign(GridImpl, { Item });
