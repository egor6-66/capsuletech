import { createStyle } from '@capsuletech/web-style';
import { createVirtualizer } from '@tanstack/solid-virtual';
import { For, type JSX, splitProps } from 'solid-js';
import type { IListProps, IVirtualListProps } from './interfaces';
import { listVariants } from './variants';

export function List<T>(props: IListProps<T>) {
  // Явно указываем ключи для разделения
  const [local, variants, others] = splitProps(
    props,
    ['class', 'style', 'items', 'children'],
    ['variant', 'orientation'], // Эти пропсы попадут в объект variants
  );

  const { className, style } = createStyle(listVariants, {
    // Теперь TS поймет, что здесь могут быть variant и orientation
    variant: variants.variant,
    orientation: variants.orientation,
    class: local.class,
    style: local.style,
  });

  return (
    <div class={className()} style={style()} {...others}>
      <For each={local.items}>{(item, index) => local.children(item, index)}</For>
    </div>
  );
}

function VirtualList<T>(props: IVirtualListProps<T>) {
  let parentRef: HTMLDivElement | undefined;

  const [local, variants, others] = splitProps(
    props,
    ['class', 'style', 'items', 'children', 'estimateSize'],
    ['variant', 'orientation'],
  );

  const { className, style } = createStyle(listVariants, {
    variant: variants.variant,
    orientation: variants.orientation,
    class: local.class,
    style: local.style,
  });

  const virtualizer = createVirtualizer({
    get count() {
      return local.items?.length ?? 0;
    },
    // @ts-expect-error
    getScrollElement: () => parentRef,
    estimateSize: () => local.estimateSize ?? 40,
    horizontal: variants.orientation === 'horizontal',
  });

  return (
    <div
      ref={parentRef}
      class={className()}
      style={
        {
          ...(typeof style() === 'object' ? style() : {}),
          overflow: 'auto',
          position: 'relative',
        } as JSX.CSSProperties
      }
      {...others}
    >
      <div
        style={{
          height:
            variants.orientation !== 'horizontal' ? `${virtualizer.getTotalSize()}px` : '100%',
          width: variants.orientation === 'horizontal' ? `${virtualizer.getTotalSize()}px` : '100%',
          position: 'relative',
        }}
      >
        <For each={virtualizer.getVirtualItems()}>
          {(virtualItem) => (
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: variants.orientation !== 'horizontal' ? `${virtualItem.size}px` : '100%',
                transform:
                  variants.orientation === 'horizontal'
                    ? `translateX(${virtualItem.start}px)`
                    : `translateY(${virtualItem.start}px)`,
              }}
            >
              {local.children(local.items![virtualItem.index], () => virtualItem.index)}
            </div>
          )}
        </For>
      </div>
    </div>
  );
}

List.Virtual = VirtualList;
