import type { ICell, IRow, LayoutPresets } from '../interfaces';
import { normalizeSlotValue } from '../utils';

type AppShellSlots = LayoutPresets['app-shell'];

/**
 * Built-in preset resolver для `'app-shell'`.
 *
 * All slots default to `resizable: true`; `initialSize` always sets the initial
 * row/cell size regardless of resizable flag. `resizable: false` disables only
 * the interactive resize handle — the size is still `initialSize`.
 *
 * - header (top, height = initialSize ?? 0.1, resizable = true by default)
 * - sidebar + main + rightBar (middle row, resizable)
 * - footer (bottom, resizable)
 *
 * Auto-centroid: если передан только `main` — возвращает single-row single-cell.
 *
 * swapGroup convention (Phase 1.2):
 * - header/footer → 'band'
 * - sidebar/rightBar → 'aside'
 */
export const appShellResolver = (slots: AppShellSlots): IRow[] => {
  const header = normalizeSlotValue(slots.header);
  const sidebar = normalizeSlotValue(slots.sidebar);
  const main = normalizeSlotValue(slots.main);
  if (!main) throw new Error("Matrix preset='app-shell': `main` slot is required.");
  const rightBar = normalizeSlotValue(slots.rightBar);
  const footer = normalizeSlotValue(slots.footer);

  // Auto-centroid: только main — один row, одна cell
  if (!header && !sidebar && !rightBar && !footer) {
    return [
      {
        id: 'centroid-row',
        cells: [
          {
            id: 'main',
            tag: 'main',
            children: main.children,
          },
        ],
      },
    ];
  }

  const rows: IRow[] = [];

  // Header row —
  //   default: height = initialSize ?? 0.1, resizable = true.
  //   resizable: false disables the interactive handle but size is still initialSize.
  if (header) {
    const headerResizable = header.resizable ?? true;
    rows.push({
      id: 'header-row',
      height: header.initialSize ?? 0.1,
      resizable: headerResizable,
      cells: [
        {
          id: 'header',
          tag: 'header',
          children: header.children,
          draggable: header.draggable,
          swapGroup: header.swapGroup ?? 'band',
          resizable: headerResizable,
        },
      ],
    });
  }

  // Middle row — sidebar + main + rightBar (resizable)
  const middleCells: ICell[] = [];

  if (sidebar) {
    middleCells.push({
      id: 'sidebar',
      tag: 'aside',
      children: sidebar.children,
      width: sidebar.initialSize ?? 0.2,
      resizable: sidebar.resizable ?? true,
      draggable: sidebar.draggable,
      swapGroup: sidebar.swapGroup ?? 'aside',
    });
  }

  // Compute main width: if sidebar and rightBar both present, main gets the remainder.
  // If only one aside is present, main takes what's left.
  // If neither, main takes full width.
  const sidebarWidth = sidebar ? (sidebar.initialSize ?? 0.2) : 0;
  const rightBarWidth = rightBar ? (rightBar.initialSize ?? 0.2) : 0;
  const mainWidth = main.initialSize ?? Math.max(0.1, 1 - sidebarWidth - rightBarWidth);

  middleCells.push({
    id: 'main',
    tag: 'main',
    children: main.children,
    width: mainWidth,
    resizable: main.resizable ?? true,
    draggable: main.draggable,
    swapGroup: main.swapGroup,
  });

  if (rightBar) {
    middleCells.push({
      id: 'rightBar',
      tag: 'aside',
      children: rightBar.children,
      width: rightBar.initialSize ?? 0.2,
      resizable: rightBar.resizable ?? true,
      draggable: rightBar.draggable,
      swapGroup: rightBar.swapGroup ?? 'aside',
    });
  }

  const headerInitialSize = header ? (header.initialSize ?? 0.1) : 0;
  const footerInitialSize = footer ? (footer.initialSize ?? 0.3) : 0;
  const middleHeight: number | 'fr' =
    header || footer
      ? Math.max(0.1, Math.round((1 - headerInitialSize - footerInitialSize) * 1e10) / 1e10)
      : 'fr';

  rows.push({
    id: 'middle-row',
    height: middleHeight,
    resizable: true,
    cells: middleCells,
  });

  // Footer row — resizable by default
  if (footer) {
    rows.push({
      id: 'footer-row',
      height: footer.initialSize ?? 0.3,
      resizable: footer.resizable ?? true,
      cells: [
        {
          id: 'footer',
          tag: 'footer',
          children: footer.children,
          draggable: footer.draggable,
          swapGroup: footer.swapGroup ?? 'band',
          resizable: footer.resizable ?? true,
        },
      ],
    });
  }

  return rows;
};
