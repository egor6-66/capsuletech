import { createStyle } from '@capsuletech/web-style';
import { createVirtualizer } from '@tanstack/solid-virtual';
import { For, type JSX, Show, splitProps } from 'solid-js';
import type { IListBatchProps, IListProps, IListRenderProps, IVirtualListProps } from './interfaces';
import { listVariants } from './variants';

/** Type guard: batch mode — data + as present. */
function isBatchMode<T>(props: IListProps<T>): props is IListBatchProps<T> {
  return (props as IListBatchProps<T>).data !== undefined && (props as IListBatchProps<T>).as !== undefined;
}

/** Type guard: render-prop mode — items + children (function) present. */
function isRenderMode<T>(props: IListProps<T>): props is IListRenderProps<T> {
  return (props as IListRenderProps<T>).items !== undefined && typeof (props as IListRenderProps<T>).children === 'function';
}

export function List<T = unknown>(props: IListProps<T>) {
  // --- batch mode ---
  if (isBatchMode(props)) {
    const [local, variants, others] = splitProps(
      props,
      ['class', 'style', 'data', 'as', 'itemProps'],
      ['variant', 'orientation'],
    );

    const { className, style } = createStyle(listVariants, {
      variant: variants.variant,
      orientation: variants.orientation,
      class: local.class,
      style: local.style,
    });

    const getItemProps = local.itemProps ?? ((item: T) => item as Record<string, unknown>);
    const ItemTpl = local.as;

    return (
      <ul class={className()} style={style() as JSX.CSSProperties} {...(others as object)}>
        <For each={local.data}>
          {(item) => <ItemTpl {...getItemProps(item)} />}
        </For>
      </ul>
    );
  }

  // --- render-prop mode (classic: items + children render function) ---
  if (isRenderMode(props)) {
    const [local, variants, others] = splitProps(
      props,
      ['class', 'style', 'items', 'children'],
      ['variant', 'orientation'],
    );

    const { className, style } = createStyle(listVariants, {
      variant: variants.variant,
      orientation: variants.orientation,
      class: local.class,
      style: local.style,
    });

    return (
      <div class={className()} style={style()} {...(others as object)}>
        <For each={local.items}>{(item, index) => local.children(item, index)}</For>
      </div>
    );
  }

  // --- semantic mode: plain children, no iteration ---
  const [local, variants, others] = splitProps(
    props,
    ['class', 'style', 'children'],
    ['variant', 'orientation'],
  );

  const { className, style } = createStyle(listVariants, {
    variant: variants.variant,
    orientation: variants.orientation,
    class: local.class,
    style: local.style,
  });

  return (
    <ul class={className()} style={style() as JSX.CSSProperties} {...(others as object)}>
      {local.children}
    </ul>
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
    getScrollElement: () => parentRef ?? null,
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
      {...(others as object)}
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
