import type { ICapsuleRouter } from '@capsuletech/web-router';
import { type JSX, Show } from 'solid-js';
import { type IResizableItem, Resizable } from '../wrappers/resizable';
import type { ILayoutProps, LayoutSlotMap } from './interfaces';
import { type INormalizedSlot, normalizeSlot } from './utils';
import { layoutSlots } from './variants';

/**
 * Dashboard-вариант: sidebar | (header / main + rightBar?).
 *
 * Если у sidebar/main/rightBar хотя бы один объявлен как `{children, resizable}` —
 * sidebar+main+rightBar собираются в один горизонтальный `<Resizable>`, header
 * остаётся над группой. Иначе — легаси-разметка с `<aside>/<main>` и
 * дефолтными классами `layoutSlots.*`.
 */
export const Dashboard = (props: {
  slots: LayoutSlotMap['dashboard'];
  animated: ILayoutProps['animated'];
  router: ICapsuleRouter | null;
  animateMain: (
    content: JSX.Element,
    animated: ILayoutProps['animated'],
    r: ICapsuleRouter | null,
  ) => JSX.Element;
}) => {
  const sidebar = normalizeSlot(props.slots.sidebar) as INormalizedSlot;
  const main = normalizeSlot(props.slots.main) as INormalizedSlot;
  const header = normalizeSlot(props.slots.header);
  const rightBar = normalizeSlot(props.slots.rightBar);

  const useResize = sidebar.resizable || main.resizable || (rightBar?.resizable ?? false);

  if (useResize) {
    const items: IResizableItem[] = [
      {
        ...sidebar,
        children: <aside class={layoutSlots.resizeSidebar}>{sidebar.children}</aside>,
      },
      {
        ...main,
        children: (
          <main class={layoutSlots.resizeMain}>
            {props.animateMain(main.children, props.animated, props.router)}
          </main>
        ),
      },
      ...(rightBar
        ? [
            {
              ...rightBar,
              children: <aside class={layoutSlots.resizeAsideRight}>{rightBar.children}</aside>,
            },
          ]
        : []),
    ];
    return (
      <div class="flex size-full flex-col">
        <Show when={header}>
          <header class={layoutSlots.header}>{header!.children}</header>
        </Show>
        <div class="min-h-0 flex-1">
          <Resizable orientation="horizontal" items={items} withHandle />
        </div>
      </div>
    );
  }

  return (
    <>
      <aside class={layoutSlots.sidebar}>{sidebar.children}</aside>
      <div class={layoutSlots.contentWrapper}>
        <Show when={header}>
          <header class={layoutSlots.header}>{header!.children}</header>
        </Show>
        <div class="flex flex-1 overflow-y-auto">
          <main class={layoutSlots.main}>
            {props.animateMain(main.children, props.animated, props.router)}
          </main>
          <Show when={rightBar}>
            <aside class={layoutSlots.asideRight}>{rightBar!.children}</aside>
          </Show>
        </div>
      </div>
    </>
  );
};
