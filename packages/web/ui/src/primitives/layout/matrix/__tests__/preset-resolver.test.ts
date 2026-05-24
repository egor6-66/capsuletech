import { describe, expect, it } from 'vitest';
import { appShellResolver } from '../presets';

// Simple JSX-like values for testing — strings work as JSX.Element in Solid
const H = 'Header';
const S = 'Sidebar';
const M = 'Main';
const R = 'RightBar';
const F = 'Footer';

describe('appShellResolver', () => {
  // ---------------------------------------------------------------------------
  // Auto-centroid
  // ---------------------------------------------------------------------------

  it('only main → single centroid row, single cell', () => {
    const rows = appShellResolver({ main: M });
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe('centroid-row');
    expect(rows[0].cells).toHaveLength(1);
    expect(rows[0].cells[0].id).toBe('main');
    expect(rows[0].cells[0].tag).toBe('main');
    expect(rows[0].cells[0].children).toBe(M);
  });

  it('only main (object-form) → centroid row', () => {
    const rows = appShellResolver({ main: { children: M, initialSize: 0.9 } });
    expect(rows).toHaveLength(1);
    expect(rows[0].cells[0].id).toBe('main');
    // In centroid mode initialSize is not forwarded (single cell fills whole space)
    expect(rows[0].cells[0].width).toBeUndefined();
  });

  // ---------------------------------------------------------------------------
  // header + main
  // ---------------------------------------------------------------------------

  it('header + main → 2 rows: header-row + middle-row', () => {
    const rows = appShellResolver({ header: H, main: M });
    expect(rows).toHaveLength(2);

    const [headerRow, middleRow] = rows;

    expect(headerRow.id).toBe('header-row');
    expect(headerRow.height).toBe(0.1); // default initialSize
    expect(headerRow.resizable).toBe(true); // default resizable
    expect(headerRow.cells).toHaveLength(1);
    expect(headerRow.cells[0].id).toBe('header');
    expect(headerRow.cells[0].tag).toBe('header');
    expect(headerRow.cells[0].swapGroup).toBe('band');

    expect(middleRow.id).toBe('middle-row');
    expect(middleRow.resizable).toBe(true);
    // header=0.1, no footer → middle = 1 - 0.1 - 0 = 0.9
    expect(middleRow.height).toBe(0.9);
    expect(middleRow.cells).toHaveLength(1);
    expect(middleRow.cells[0].id).toBe('main');
  });

  // ---------------------------------------------------------------------------
  // header + main + footer
  // ---------------------------------------------------------------------------

  it('header + main + footer → 3 rows', () => {
    const rows = appShellResolver({ header: H, main: M, footer: F });
    expect(rows).toHaveLength(3);

    const [headerRow, middleRow, footerRow] = rows;

    expect(headerRow.id).toBe('header-row');
    expect(middleRow.id).toBe('middle-row');
    expect(footerRow.id).toBe('footer-row');
    expect(footerRow.resizable).toBe(true);
    expect(footerRow.cells[0].id).toBe('footer');
    expect(footerRow.cells[0].tag).toBe('footer');
    expect(footerRow.cells[0].swapGroup).toBe('band');
  });

  it('footer default height is 0.3', () => {
    const rows = appShellResolver({ main: M, footer: F });
    const footerRow = rows.find((r) => r.id === 'footer-row')!;
    expect(footerRow.height).toBe(0.3);
  });

  it('footer object-form with initialSize overrides default height', () => {
    const rows = appShellResolver({ main: M, footer: { children: F, initialSize: 0.15 } });
    const footerRow = rows.find((r) => r.id === 'footer-row')!;
    expect(footerRow.height).toBe(0.15);
  });

  // ---------------------------------------------------------------------------
  // middle-row height — the fix for footer collapsing to 0px
  // ---------------------------------------------------------------------------

  it('middle-row gets height = 1 - footerInitialSize when footer present (default 0.3)', () => {
    const rows = appShellResolver({ main: M, footer: F });
    const middleRow = rows.find((r) => r.id === 'middle-row')!;
    expect(middleRow.height).toBe(0.7);
  });

  it('middle-row height respects custom footer initialSize', () => {
    const rows = appShellResolver({ main: M, footer: { children: F, initialSize: 0.15 } });
    const middleRow = rows.find((r) => r.id === 'middle-row')!;
    expect(middleRow.height).toBe(0.85);
  });

  it('middle-row height clamps to at least 0.1 when footer initialSize is huge', () => {
    const rows = appShellResolver({ main: M, footer: { children: F, initialSize: 0.95 } });
    const middleRow = rows.find((r) => r.id === 'middle-row')!;
    expect(middleRow.height).toBe(0.1);
  });

  it('middle-row height is fr when sidebar present but no footer', () => {
    const rows = appShellResolver({ main: M, sidebar: S });
    const middleRow = rows.find((r) => r.id === 'middle-row')!;
    expect(middleRow.height).toBe('fr');
  });

  it('all 5 slots → middle-row height = 0.6 (header default 0.1 + footer default 0.3)', () => {
    const rows = appShellResolver({ header: H, sidebar: S, main: M, rightBar: R, footer: F });
    const middleRow = rows.find((r) => r.id === 'middle-row')!;
    expect(middleRow.height).toBe(0.6);
  });

  // ---------------------------------------------------------------------------
  // All 5 slots
  // ---------------------------------------------------------------------------

  it('all 5 slots → 3 rows: header / middle (sidebar+main+rightBar) / footer', () => {
    const rows = appShellResolver({ header: H, sidebar: S, main: M, rightBar: R, footer: F });
    expect(rows).toHaveLength(3);

    const middleRow = rows.find((r) => r.id === 'middle-row')!;
    expect(middleRow.cells).toHaveLength(3);

    const [sidebarCell, mainCell, rightBarCell] = middleRow.cells;

    expect(sidebarCell.id).toBe('sidebar');
    expect(sidebarCell.tag).toBe('aside');
    expect(sidebarCell.resizable).toBe(true);
    expect(sidebarCell.swapGroup).toBe('aside');

    expect(mainCell.id).toBe('main');
    expect(mainCell.tag).toBe('main');
    expect(mainCell.resizable).toBe(true);

    expect(rightBarCell.id).toBe('rightBar');
    expect(rightBarCell.tag).toBe('aside');
    expect(rightBarCell.resizable).toBe(true);
    expect(rightBarCell.swapGroup).toBe('aside');
  });

  it('sidebar default width is 0.2', () => {
    const rows = appShellResolver({ main: M, sidebar: S });
    const middleRow = rows.find((r) => r.id === 'middle-row')!;
    const sidebarCell = middleRow.cells.find((c) => c.id === 'sidebar')!;
    expect(sidebarCell.width).toBe(0.2);
  });

  it('sidebar object-form with initialSize overrides default width', () => {
    const rows = appShellResolver({ main: M, sidebar: { children: S, initialSize: 0.25 } });
    const middleRow = rows.find((r) => r.id === 'middle-row')!;
    const sidebarCell = middleRow.cells.find((c) => c.id === 'sidebar')!;
    expect(sidebarCell.width).toBe(0.25);
  });

  it('rightBar default width is 0.2', () => {
    const rows = appShellResolver({ main: M, rightBar: R });
    const middleRow = rows.find((r) => r.id === 'middle-row')!;
    const rightBarCell = middleRow.cells.find((c) => c.id === 'rightBar')!;
    expect(rightBarCell.width).toBe(0.2);
  });

  // ---------------------------------------------------------------------------
  // Error guard
  // ---------------------------------------------------------------------------

  it('throws when `main` is missing', () => {
    expect(() =>
      appShellResolver({
        main: undefined as never,
        header: H,
      }),
    ).toThrow("preset='app-shell': `main` slot is required");
  });

  // ---------------------------------------------------------------------------
  // sidebar only (no header/footer)
  // ---------------------------------------------------------------------------

  it('sidebar + main → middle row only (no header/footer rows)', () => {
    const rows = appShellResolver({ sidebar: S, main: M });
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe('middle-row');
    expect(rows[0].cells).toHaveLength(2);
  });

  // ---------------------------------------------------------------------------
  // rightBar only (no sidebar, no header/footer)
  // ---------------------------------------------------------------------------

  it('main + rightBar → single middle row with 2 cells', () => {
    const rows = appShellResolver({ main: M, rightBar: R });
    expect(rows).toHaveLength(1);
    const cells = rows[0].cells;
    expect(cells).toHaveLength(2);
    expect(cells[0].id).toBe('main');
    expect(cells[1].id).toBe('rightBar');
  });
});
