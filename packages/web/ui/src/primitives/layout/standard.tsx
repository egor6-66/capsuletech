import type { ICapsuleRouter } from '@capsuletech/web-router';
import { type JSX } from 'solid-js';
import { type IResizableItem, Resizable } from '../wrappers/resizable';
import type { ILayoutProps, LayoutSlotMap } from './interfaces';
import { type INormalizedSlot, normalizeSlot } from './utils';
import { layoutSlots } from './variants';

/**
 * Standard-вариант: header / main / footer (одна колонка).
 *
 * Если хотя бы один из header/main/footer задан как `{children, resizable: true}` —
 * группа собирается в один вертикальный `<Resizable>` (header сверху,
 * main посередине, footer снизу). Иначе — легаси-разметка с `<header>/<main>/
 * <footer>` и `flex flex-col`.
 */
export const Standard = (props: {
  slots: LayoutSlotMap['standard'];
  animated: ILayoutProps['animated'];
  router: ICapsuleRouter | null;
  animateMain: (
    content: JSX.Element,
    animated: ILayoutProps['animated'],
    r: ICapsuleRouter | null,
  ) => JSX.Element;
}) => {
  const header = normalizeSlot(props.slots.header) as INormalizedSlot;
  const main = normalizeSlot(props.slots.main) as INormalizedSlot;
  const footer = normalizeSlot(props.slots.footer) as INormalizedSlot;

  const useResize = header.resizable || main.resizable || footer.resizable;

  if (useResize) {
    const items: IResizableItem[] = [
      {
        ...header,
        children: (
          <header class={layoutSlots.resizeHeader}>{header.children}</header>
        ),
      },
      {
        ...main,
        children: (
          <main class={layoutSlots.resizeMain}>
            {props.animateMain(main.children, props.animated, props.router)}
          </main>
        ),
      },
      {
        ...footer,
        children: (
          <footer class={layoutSlots.resizeFooter}>{footer.children}</footer>
        ),
      },
    ];
    return <Resizable orientation="vertical" items={items} withHandle />;
  }

  return (
    <>
      <header class={layoutSlots.header}>{header.children}</header>
      <main class={layoutSlots.main}>
        {props.animateMain(main.children, props.animated, props.router)}
      </main>
      <footer class={layoutSlots.footer}>{footer.children}</footer>
    </>
  );
};
