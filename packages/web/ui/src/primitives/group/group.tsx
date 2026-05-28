import { cn } from '@capsuletech/web-style';
import { createMemo, For, splitProps, type Component } from 'solid-js';
import { Dynamic } from 'solid-js/web';

import { Flex } from '../layout/flex';
import type { FlexOrientation, IFlexItem } from '../layout/flex/interfaces';
import type { IGroupProps, IGroupSeparatorProps } from './interfaces';
import { groupSeparatorVariants } from './variants';

/**
 * Group — универсальный контейнер для группировки элементов.
 * Обёртка над Flex: не дублирует CSS, маппит свои props в Flex.
 *
 * **Два режима:**
 *
 * 1. **Wrapper mode** — children передаются напрямую в Flex:
 *    ```tsx
 *    <Group orientation="horizontal" variant="attached">
 *      <Button>First</Button>
 *      <Button>Second</Button>
 *      <Button>Third</Button>
 *    </Group>
 *    ```
 *
 * 2. **Batch mode** — data + as (+ опциональный itemProps/tags):
 *    ```tsx
 *    <Group data={items} as={Button} itemProps={(it) => ({ children: it.label })} />
 *    ```
 *
 * **Варианты:**
 * - `separate` (default) — items с gap (default gap=2).
 * - `attached` — items прижаты, border-radius срезаются на внутренних краях,
 *   borders объединяются через -ml-px / -mt-px.
 */
export function Group<T = unknown>(props: IGroupProps<T>) {
  const [local] = splitProps(props, [
    'orientation',
    'variant',
    'gap',
    'class',
    'style',
    'data',
    'itemAs',
    'itemProps',
    'tags',
    'resizable',
    'withHandle',
    'children',
  ]);

  const orientation = (): FlexOrientation => local.orientation ?? 'horizontal';
  const isBatch = () => local.data !== undefined && local.itemAs !== undefined;

  // Batch mode: фильтрация по тегам
  const visible = createMemo(() => {
    const all = (local.data ?? []) as T[];
    if (!local.tags || local.tags.length === 0) return all;
    return all.filter(
      (it: any) =>
        Array.isArray(it?.tags) && it.tags.some((t: string) => local.tags!.includes(t)),
    );
  });

  const getItemProps = local.itemProps ?? ((item: T) => item as Record<string, unknown>);

  const isAttached = () => local.variant === 'attached';
  const isVertical = () => orientation() === 'vertical';

  // attached variant — outer container rounded + border, strip child radii at seams, remove child borders
  const variantClass = () => {
    if (!isAttached()) return '';
    return cn(
      // Outer container: single shared border + overflow clip keeps corners clean
      'rounded-md border border-border overflow-hidden',
      // Horizontal: strip right radius on first, left radius on last, all radii on middles; kill child borders
      !isVertical() && [
        '[&>*:first-child]:rounded-r-none',
        '[&>*:last-child]:rounded-l-none',
        '[&>*:not(:first-child):not(:last-child)]:rounded-none',
        '[&>*]:border-0',
      ],
      // Vertical: strip bottom radius on first, top radius on last, all radii on middles; kill child borders
      isVertical() && [
        '[&>*:first-child]:rounded-b-none',
        '[&>*:last-child]:rounded-t-none',
        '[&>*:not(:first-child):not(:last-child)]:rounded-none',
        '[&>*]:border-0',
      ],
    );
  };

  const gap = () => (isAttached() ? 0 : (local.gap ?? 2));

  // Batch + spaced/resizable: items-array for Flex (keeps resizable support)
  const batchItems = createMemo<IFlexItem[]>(() =>
    visible().map((item) => ({
      children: <Dynamic component={local.itemAs as Component<any>} {...getItemProps(item)} />,
      resizable: !!local.resizable,
    })),
  );

  if (isBatch()) {
    // attached + non-resizable: render directly with <For> so [&>*] selectors
    // target the actual child element (e.g. <a>, <button>) — not a <div> wrapper.
    if (isAttached() && !local.resizable) {
      const items = () => visible();
      const sepOrientation = (): FlexOrientation => (isVertical() ? 'horizontal' : 'vertical');
      return (
        <div
          class={cn(
            'flex',
            isVertical() ? 'flex-col' : 'flex-row',
            variantClass(),
            local.class,
          )}
          style={local.style as any}
        >
          <For each={items()}>
            {(item, idx) => (
              <>
                <Dynamic component={local.itemAs as Component<any>} {...getItemProps(item)} />
                {idx() < items().length - 1 && (
                  <GroupSeparator orientation={sepOrientation()} />
                )}
              </>
            )}
          </For>
        </div>
      );
    }

    // spaced or resizable: delegate to Flex (items-mode, gap, corvu handles resize)
    return (
      <Flex
        orientation={orientation()}
        gap={gap()}
        items={batchItems()}
        withHandle={local.withHandle}
        class={cn(variantClass(), local.class)}
        style={local.style}
      />
    );
  }

  return (
    <Flex
      orientation={orientation()}
      gap={gap()}
      class={cn(variantClass(), local.class)}
      style={local.style}
    >
      {local.children}
    </Flex>
  );
}

/**
 * Group.Separator — визуальный разделитель между items.
 *
 * ```tsx
 * <Group>
 *   <Button>A</Button>
 *   <Group.Separator />
 *   <Button>B</Button>
 * </Group>
 * ```
 */
export function GroupSeparator(props: IGroupSeparatorProps) {
  const [local] = splitProps(props, ['orientation', 'class', 'style']);

  return (
    <hr
      aria-orientation={local.orientation === 'horizontal' ? 'horizontal' : 'vertical'}
      class={cn(groupSeparatorVariants({ orientation: local.orientation }), local.class)}
      style={local.style as any}
    />
  );
}

Group.Separator = GroupSeparator;
