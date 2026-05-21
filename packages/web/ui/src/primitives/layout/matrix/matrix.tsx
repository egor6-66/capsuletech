import { type ICapsuleRouter, RouterContext } from '@capsuletech/web-router';
import { createStyle } from '@capsuletech/web-style';
import { type JSX, Show, splitProps, useContext } from 'solid-js';
import { Flex } from '../flex/flex';
import type { IFlexItem } from '../flex/interfaces';
import { Animate, type AnimateVariant } from '../../wrappers/animate';
import type { IMatrixProps, IMatrixSlots } from './interfaces';
import { type INormalizedSlot, normalizeSlot } from './utils';
import { matrixCva, matrixSlots } from './variants';

// ---------------------------------------------------------------------------
// animateMain helper — shared across render modes
// ---------------------------------------------------------------------------

const animateMain = (
  content: JSX.Element,
  animated: boolean | AnimateVariant | undefined,
  router: ICapsuleRouter | null,
): JSX.Element => {
  if (!animated) return content;
  const variant: AnimateVariant = typeof animated === 'string' ? animated : 'fade';
  if (router) {
    return (
      <Animate variant={variant} keyed={router.current()}>
        {content}
      </Animate>
    );
  }
  return <Animate variant={variant}>{content}</Animate>;
};

// ---------------------------------------------------------------------------
// Auto-centroid mode: only `main` is provided
// ---------------------------------------------------------------------------

const renderCentroid = (
  slots: IMatrixSlots,
  animated: IMatrixProps['animated'],
  router: ICapsuleRouter | null,
): JSX.Element => {
  const main = normalizeSlot(slots.main) as INormalizedSlot;
  return (
    <div class="flex h-full w-full items-center justify-center">
      {animateMain(main.children, animated, router)}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Grid mode: build dynamic grid-template-areas from present slots
// ---------------------------------------------------------------------------

/**
 * Builds CSS grid-template-areas + col/row track strings from the set of
 * present slots. Rules:
 *   - rows:    top (header), middle (sidebar/main/rightBar), bottom (footer)
 *              omitted when the slot is absent.
 *   - columns: left (sidebar), center (main), right (rightBar)
 *              omitted when the slot is absent.
 *   - main area always present (required slot).
 */
const buildGridTemplate = (
  hasSidebar: boolean,
  hasRightBar: boolean,
  hasHeader: boolean,
  hasFooter: boolean,
): { areas: string; cols: string; rows: string } => {
  // Column names & tracks
  const leftCol = hasSidebar ? 'sidebar' : null;
  const rightCol = hasRightBar ? 'rightBar' : null;

  const colNames = [leftCol, 'main', rightCol].filter(Boolean) as string[];
  const cols = [hasSidebar ? 'auto' : null, '1fr', hasRightBar ? 'auto' : null]
    .filter(Boolean)
    .join(' ');

  const makeRow = (areaName: string) => `'${colNames.map(() => areaName).join(' ')}'`;

  const middleRow = `'${colNames.join(' ')}'`;

  const rows: string[] = [];
  if (hasHeader) rows.push(makeRow('header'));
  rows.push(middleRow);
  if (hasFooter) rows.push(makeRow('footer'));

  const rowTracks = [hasHeader ? 'auto' : null, '1fr', hasFooter ? 'auto' : null]
    .filter(Boolean)
    .join(' ');

  return { areas: rows.join(' '), cols, rows: rowTracks };
};

const renderGrid = (
  slots: IMatrixSlots,
  animated: IMatrixProps['animated'],
  router: ICapsuleRouter | null,
): JSX.Element => {
  const header = normalizeSlot(slots.header);
  const sidebar = normalizeSlot(slots.sidebar);
  const main = normalizeSlot(slots.main) as INormalizedSlot;
  const rightBar = normalizeSlot(slots.rightBar);
  const footer = normalizeSlot(slots.footer);

  const hasSidebar = sidebar !== null;
  const hasRightBar = rightBar !== null;
  const hasHeader = header !== null;
  const hasFooter = footer !== null;

  const { areas, cols, rows } = buildGridTemplate(hasSidebar, hasRightBar, hasHeader, hasFooter);

  return (
    <div
      class={matrixSlots.gridContainer}
      style={{
        'grid-template-areas': areas,
        'grid-template-columns': cols,
        'grid-template-rows': rows,
      }}
    >
      <Show when={hasHeader}>
        <header class={matrixSlots.header} style={{ 'grid-area': 'header' }}>
          {header!.children}
        </header>
      </Show>
      <Show when={hasSidebar}>
        <aside class={matrixSlots.gridLeft} style={{ 'grid-area': 'sidebar' }}>
          {sidebar!.children}
        </aside>
      </Show>
      <main class={matrixSlots.main} style={{ 'grid-area': 'main' }}>
        {animateMain(main.children, animated, router)}
      </main>
      <Show when={hasRightBar}>
        <aside class={matrixSlots.gridRight} style={{ 'grid-area': 'rightBar' }}>
          {rightBar!.children}
        </aside>
      </Show>
      <Show when={hasFooter}>
        <footer class={matrixSlots.footer} style={{ 'grid-area': 'footer' }}>
          {footer!.children}
        </footer>
      </Show>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Resize mode — thin wrapper over Flex
// ---------------------------------------------------------------------------

/**
 * Builds Flex items for the horizontal middle row
 * (sidebar | main | rightBar). Only slots that are present are included.
 * Non-resizable present slots are still included in the group (handle
 * appears only between two adjacent resizable panels per corvu rules).
 */
const buildHorizontalItems = (
  sidebar: INormalizedSlot | null,
  main: INormalizedSlot,
  rightBar: INormalizedSlot | null,
  animated: IMatrixProps['animated'],
  router: ICapsuleRouter | null,
): IFlexItem[] => {
  const items: IFlexItem[] = [];
  if (sidebar) {
    items.push({
      ...sidebar,
      children: <aside class={matrixSlots.resizeSidebar}>{sidebar.children}</aside>,
    });
  }
  items.push({
    ...main,
    children: (
      <main class={matrixSlots.resizeMain}>{animateMain(main.children, animated, router)}</main>
    ),
  });
  if (rightBar) {
    items.push({
      ...rightBar,
      children: <aside class={matrixSlots.resizeAsideRight}>{rightBar.children}</aside>,
    });
  }
  return items;
};

const renderResize = (
  slots: IMatrixSlots,
  animated: IMatrixProps['animated'],
  router: ICapsuleRouter | null,
): JSX.Element => {
  const header = normalizeSlot(slots.header);
  const sidebar = normalizeSlot(slots.sidebar);
  const main = normalizeSlot(slots.main) as INormalizedSlot;
  const rightBar = normalizeSlot(slots.rightBar);
  const footer = normalizeSlot(slots.footer);

  const useHorizontalResize =
    (sidebar?.resizable ?? false) || main.resizable || (rightBar?.resizable ?? false);
  const useVerticalResize = (header?.resizable ?? false) || (footer?.resizable ?? false);

  // Fixed (non-resizable) header/footer are rendered outside Flex groups —
  // this avoids the fillInitialSizes bug where a header without an explicit
  // initialSize would steal ~35% of the viewport height.
  const fixedHeader =
    header !== null && !header.resizable ? (
      <header class={matrixSlots.header}>{header.children}</header>
    ) : null;

  const fixedFooter =
    footer !== null && !footer.resizable ? (
      <footer class={matrixSlots.footer}>{footer.children}</footer>
    ) : null;

  const resizableHeader = header?.resizable ? (
    <header class={matrixSlots.resizeHeader}>{header.children}</header>
  ) : null;

  const resizableFooter = footer?.resizable ? (
    <footer class={matrixSlots.resizeFooter}>{footer.children}</footer>
  ) : null;

  // Build horizontal items ONCE before JSX — inlining the call inside JSX would
  // cause the Solid compiler to wrap it in a `get items()` getter, which gets
  // evaluated on every `props.items` access inside Flex/ResizableFlex (at least
  // 4× per render: itemsMode, hasResizable, sizes memo, For loop, Show when).
  // Each call creates fresh JSX nodes and re-inserts slot.children DOM nodes,
  // which moves them out of the already-rendered Panel → slot content disappears.
  const horizontalItems = useHorizontalResize
    ? buildHorizontalItems(sidebar, main, rightBar, animated, router)
    : null;

  // Middle row — horizontal Flex (resizable or static).
  // NB: используем inline style `height: 100%` вместо `flex-1`, потому что
  // middle row может быть вложен в corvu Panel (block-display, не flex), где
  // `flex-1` не работает и wrapper схлопывается до content size.
  const middleRow: JSX.Element = useHorizontalResize ? (
    <div class="grid grid-rows-[1fr] overflow-hidden" style={{ height: '100%', width: '100%' }}>
      <Flex
        orientation="horizontal"
        items={horizontalItems!}
        withHandle
      />
    </div>
  ) : (
    <div class="flex min-h-0 flex-1 overflow-hidden">
      <Show when={sidebar}>
        <aside class={matrixSlots.gridLeft}>{sidebar!.children}</aside>
      </Show>
      <main class={matrixSlots.main}>{animateMain(main.children, animated, router)}</main>
      <Show when={rightBar}>
        <aside class={matrixSlots.gridRight}>{rightBar!.children}</aside>
      </Show>
    </div>
  );

  // Vertical resize: header and/or footer are resizable → outer vertical Flex
  if (useVerticalResize) {
    const verticalItems: IFlexItem[] = [];

    if (header?.resizable) {
      verticalItems.push({
        ...header,
        children: resizableHeader!,
      });
    }

    verticalItems.push({
      // The middle-row panel is always resizable to allow handles on both sides.
      resizable: true,
      children: middleRow,
    });

    if (footer?.resizable) {
      verticalItems.push({
        ...footer,
        children: resizableFooter!,
      });
    }

    return (
      <div class="flex h-full w-full flex-col">
        {fixedHeader}
        <div class="min-h-0 flex-1 grid grid-rows-[1fr] overflow-hidden">
          <Flex orientation="vertical" items={verticalItems} withHandle />
        </div>
        {fixedFooter}
      </div>
    );
  }

  // Only horizontal resize (or mixed non-resizable): fixed header/footer wrap the middle
  return (
    <div class="flex h-full w-full flex-col">
      {fixedHeader}
      {middleRow}
      {fixedFooter}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main MatrixImpl
// ---------------------------------------------------------------------------

const MatrixImpl = (props: IMatrixProps) => {
  const [local, others] = splitProps(props, ['class', 'style', 'ref', 'slots', 'animated']);

  const { className, style } = createStyle(matrixCva, {
    class: local.class,
    style: local.style,
  });

  // Soft-dep on router: useContext directly (no useRouter throw when outside RouterContext)
  const router = useContext(RouterContext);

  const slots = () => local.slots;

  const renderContent = (): JSX.Element => {
    const s = slots();

    // Auto-centroid: only main is provided (all optional slots absent)
    const isCentroid =
      s.header === undefined &&
      s.sidebar === undefined &&
      s.rightBar === undefined &&
      s.footer === undefined;

    if (isCentroid) {
      return renderCentroid(s, local.animated, router);
    }

    // Check if any slot requests resize
    const headerN = normalizeSlot(s.header);
    const sidebarN = normalizeSlot(s.sidebar);
    const mainN = normalizeSlot(s.main) as INormalizedSlot;
    const rightBarN = normalizeSlot(s.rightBar);
    const footerN = normalizeSlot(s.footer);

    const anyResize =
      (headerN?.resizable ?? false) ||
      (sidebarN?.resizable ?? false) ||
      mainN.resizable ||
      (rightBarN?.resizable ?? false) ||
      (footerN?.resizable ?? false);

    if (anyResize) {
      return renderResize(s, local.animated, router);
    }

    return renderGrid(s, local.animated, router);
  };

  return (
    <div ref={local.ref} class={className()} style={style()} {...(others as object)}>
      {renderContent()}
    </div>
  );
};

/**
 * Matrix — unified top-level раскладка с 5 опциональными слотами.
 *
 * - **Auto-centroid**: если задан только `main` — flex center на всю область.
 * - **Grid**: header/sidebar/main/rightBar/footer — CSS Grid с динамическими areas.
 * - **Resize**: если хотя бы один slot имеет `resizable: true` — включается
 *   горизонтальный и/или вертикальный `<Flex items={...}>` (thin wrapper над corvu).
 *
 * Слот передаётся только object-формой: `{ children, resizable?, initialSize?, minSize?, maxSize? }`.
 * JSX-shorthand (`sidebar: <MySidebar />`) удалён в v0.3.0 — используй `{ children: <MySidebar /> }`.
 */
export const Matrix = MatrixImpl;
