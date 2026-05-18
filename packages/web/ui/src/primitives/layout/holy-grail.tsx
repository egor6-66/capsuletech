import type { ICapsuleRouter } from '@capsuletech/web-router';
import type { JSX } from 'solid-js';
import { type IResizableItem, Resizable } from '../wrappers/resizable';
import type { ILayoutProps, LayoutSlotMap } from './interfaces';
import { type INormalizedSlot, normalizeSlot } from './utils';
import { layoutSlots } from './variants';

/**
 * Holy-grail-вариант: header / (left | main | right) / footer.
 *
 * Раскладка по умолчанию — CSS Grid с named areas (`grid-template-areas`).
 * Resize включается per-slot через object-форму с `resizable: true` и работает
 * на двух осях независимо:
 *
 *  - **horizontal** (left / main / right): если хотя бы один из этих слотов
 *    `resizable: true` — средняя строка становится `<Resizable orientation="horizontal">`.
 *  - **vertical** (header / footer + middle-row): если header или footer
 *    `resizable: true` — внешний контейнер становится `<Resizable orientation="vertical">`,
 *    его средняя panel — либо горизонтальный Resizable (если горизонтальные
 *    слоты тоже opt-in), либо просто grid-row.
 *
 * Когда ни одна ось не резайзится — рендерится исходная grid-template-areas
 * разметка (она компактнее и легче по DOM, чем nested Resizable).
 */
export const HolyGrail = (props: {
  slots: LayoutSlotMap['holy-grail'];
  animated: ILayoutProps['animated'];
  router: ICapsuleRouter | null;
  animateMain: (
    content: JSX.Element,
    animated: ILayoutProps['animated'],
    r: ICapsuleRouter | null,
  ) => JSX.Element;
}) => {
  const header = normalizeSlot(props.slots.header) as INormalizedSlot;
  const left = normalizeSlot(props.slots.left) as INormalizedSlot;
  const main = normalizeSlot(props.slots.main) as INormalizedSlot;
  const right = normalizeSlot(props.slots.right) as INormalizedSlot;
  const footer = normalizeSlot(props.slots.footer) as INormalizedSlot;

  const useHorizontalResize = left.resizable || main.resizable || right.resizable;
  const useVerticalResize = header.resizable || footer.resizable;

  const animatedMain = () => props.animateMain(main.children, props.animated, props.router);

  // Средняя строка (left | main | right) — либо горизонтальный Resizable,
  // либо flex со статическими ширинами на боках.
  const renderMiddle = (): JSX.Element => {
    if (useHorizontalResize) {
      const items: IResizableItem[] = [
        {
          ...left,
          children: <aside class={layoutSlots.resizeSidebar}>{left.children}</aside>,
        },
        {
          ...main,
          children: <main class={layoutSlots.resizeMain}>{animatedMain()}</main>,
        },
        {
          ...right,
          children: <aside class={layoutSlots.resizeAsideRight}>{right.children}</aside>,
        },
      ];
      return (
        <div class="min-h-0 flex-1">
          <Resizable orientation="horizontal" items={items} withHandle />
        </div>
      );
    }
    return (
      <div class="flex min-h-0 flex-1 overflow-hidden">
        <aside class={layoutSlots.holyGrailLeft}>{left.children}</aside>
        <main class={layoutSlots.main}>{animatedMain()}</main>
        <aside class={layoutSlots.holyGrailRight}>{right.children}</aside>
      </div>
    );
  };

  // Вертикальный resize — внешний Resizable из 3-х panel'ей.
  if (useVerticalResize) {
    const items: IResizableItem[] = [
      {
        ...header,
        children: <header class={layoutSlots.resizeHeader}>{header.children}</header>,
      },
      {
        // main-panel этой группы — целая средняя строка; resizable должен
        // быть true чтобы handle между header и middle (и middle и footer)
        // отрисовался, даже если ни один horizontal-слот не помечен.
        resizable: true,
        children: renderMiddle(),
      },
      {
        ...footer,
        children: <footer class={layoutSlots.resizeFooter}>{footer.children}</footer>,
      },
    ];
    return <Resizable orientation="vertical" items={items} withHandle />;
  }

  // Только горизонтальный resize — header/footer фиксированы, middle резайзится.
  if (useHorizontalResize) {
    return (
      <div class="flex h-full w-full flex-col">
        <header class={layoutSlots.header}>{header.children}</header>
        {renderMiddle()}
        <footer class={layoutSlots.footer}>{footer.children}</footer>
      </div>
    );
  }

  // Без resize — исходная grid-template-areas раскладка.
  return (
    <div
      class={layoutSlots.holyGrailGrid}
      style={{
        'grid-template-areas': "'header header header' 'left main right' 'footer footer footer'",
      }}
    >
      <header class={layoutSlots.header} style={{ 'grid-area': 'header' }}>
        {header.children}
      </header>
      <aside class={layoutSlots.holyGrailLeft} style={{ 'grid-area': 'left' }}>
        {left.children}
      </aside>
      <main class={layoutSlots.main} style={{ 'grid-area': 'main' }}>
        {animatedMain()}
      </main>
      <aside class={layoutSlots.holyGrailRight} style={{ 'grid-area': 'right' }}>
        {right.children}
      </aside>
      <footer class={layoutSlots.footer} style={{ 'grid-area': 'footer' }}>
        {footer.children}
      </footer>
    </div>
  );
};
