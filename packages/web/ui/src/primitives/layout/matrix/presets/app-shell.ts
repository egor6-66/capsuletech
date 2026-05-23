import type { ICell, IRow, LayoutPresets } from '../interfaces';
import { normalizeSlotValue } from '../utils';

type AppShellSlots = LayoutPresets['app-shell'];

/**
 * Built-in preset resolver для `'app-shell'`.
 *
 * Replicates current Matrix 5-slot layout:
 * - header (top, height='auto', not resizable)
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

  // Header row — fixed height ('auto'), not resizable
  if (header) {
    rows.push({
      id: 'header-row',
      height: 'auto',
      resizable: false,
      cells: [
        {
          id: 'header',
          tag: 'header',
          children: header.children,
          draggable: header.draggable,
          swapGroup: 'band',
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
      resizable: true,
      draggable: sidebar.draggable,
      swapGroup: 'aside',
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
    resizable: true,
  });

  if (rightBar) {
    middleCells.push({
      id: 'rightBar',
      tag: 'aside',
      children: rightBar.children,
      width: rightBar.initialSize ?? 0.2,
      resizable: true,
      draggable: rightBar.draggable,
      swapGroup: 'aside',
    });
  }

  rows.push({
    id: 'middle-row',
    resizable: true,
    cells: middleCells,
  });

  // Footer row — resizable
  if (footer) {
    rows.push({
      id: 'footer-row',
      height: footer.initialSize ?? 0.3,
      resizable: true,
      cells: [
        {
          id: 'footer',
          tag: 'footer',
          children: footer.children,
          draggable: footer.draggable,
          swapGroup: 'band',
        },
      ],
    });
  }

  return rows;
};
