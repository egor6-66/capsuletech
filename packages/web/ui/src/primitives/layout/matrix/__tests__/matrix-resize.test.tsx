/**
 * Regression tests for: Matrix resize-mode slot content rendering.
 *
 * History: in v1 (5-slot API), `buildHorizontalItems(...)` was inlined inside
 * the JSX prop `items={...}`. The Solid compiler wrapped non-literal props in
 * getters → builder re-fired on every items access → slot.children DOM nodes
 * re-inserted out of corvu Panels → content disappeared.
 *
 * Fix: store builder result in a local variable before JSX so the getter is a
 * stable reference. Defence: ResizableFlex snapshots props.items via createMemo
 * so even if the outer getter is function-based, it fires at most once per
 * reactive cycle.
 *
 * In v2 (rows-engine), the analogous risk exists in `rowToFlexItems` /
 * `rowsToVerticalItems` — both are called once inside helpers (renderRow /
 * renderContent) and their results are passed to Flex via local variables
 * before JSX, NOT inlined as getters. These regression tests verify the v2
 * implementation preserves slot content in resize mode.
 */
/* @vitest-environment jsdom */
import { render } from 'solid-js/web';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Matrix } from '../matrix';

let container: HTMLDivElement;
let cleanup: (() => void) | undefined;

beforeEach(() => {
  container = document.createElement('div');
  // corvu Resizable needs the container to have non-zero dimensions for the
  // rootSize to be > 0. Set an explicit size in the style.
  container.style.width = '800px';
  container.style.height = '600px';
  document.body.appendChild(container);
});

afterEach(() => {
  cleanup?.();
  cleanup = undefined;
  document.body.removeChild(container);
});

describe("Matrix preset='app-shell' — resize-mode slot rendering", () => {
  it('main slot content is rendered inside <main> when main is in app-shell middle row', () => {
    cleanup = render(
      () => (
        <Matrix
          style={{ width: '800px', height: '600px' }}
          preset="app-shell"
          slots={{
            header: <div data-testid="hdr">Header</div>,
            main: { children: <div data-testid="main-content">MAIN</div>, initialSize: 0.8 },
            rightBar: { children: <div data-testid="rb-content">RIGHT</div>, initialSize: 0.2 },
          }}
        />
      ),
      container,
    );

    // Header (non-resizable) should always work — used as sanity baseline.
    expect(container.querySelector('[data-testid="hdr"]')).not.toBeNull();

    // Main slot must be present inside a <main> element (preset uses tag='main').
    const mainEl = container.querySelector('main');
    expect(mainEl).not.toBeNull();
    expect(mainEl!.querySelector('[data-testid="main-content"]')).not.toBeNull();

    // RightBar slot must be inside an <aside> element (preset uses tag='aside').
    const asideEls = container.querySelectorAll('aside');
    const rightBarAside = Array.from(asideEls).find((el) =>
      el.querySelector('[data-testid="rb-content"]'),
    );
    expect(rightBarAside).not.toBeUndefined();
  });

  it('main + rightBar + footer all rendered when all 4 slots are provided', () => {
    cleanup = render(
      () => (
        <Matrix
          style={{ width: '800px', height: '600px' }}
          preset="app-shell"
          slots={{
            header: <div data-testid="hdr">Header</div>,
            main: { children: <div data-testid="main-content">MAIN</div>, initialSize: 0.8 },
            rightBar: { children: <div data-testid="rb-content">RIGHT</div>, initialSize: 0.2 },
            footer: { children: <div data-testid="ftr-content">Footer</div>, initialSize: 0.3 },
          }}
        />
      ),
      container,
    );

    // This is the exact scenario from the v1 bug report.
    expect(container.querySelector('[data-testid="hdr"]')).not.toBeNull();

    const mainEl = container.querySelector('main');
    expect(mainEl).not.toBeNull();
    // Before the v1 fix, mainEl.children.length === 0 (content was displaced).
    expect(mainEl!.childElementCount).toBeGreaterThan(0);
    expect(mainEl!.querySelector('[data-testid="main-content"]')).not.toBeNull();

    const footerEl = container.querySelector('footer');
    expect(footerEl).not.toBeNull();
    expect(footerEl!.querySelector('[data-testid="ftr-content"]')).not.toBeNull();
  });

  it('overflowing main content does not expand panel past flex-basis (min-h-0 regression)', () => {
    // 50 tall rows in main — without min-h-0 on ResizablePanel the middle-row panel
    // would grow to intrinsic content height and push footer below viewport.
    const manyRows = Array.from({ length: 50 }, (_, i) => (
      <div data-testid={`row-${i}`} style={{ height: '38px' }}>
        Row {i}
      </div>
    ));

    cleanup = render(
      () => (
        <Matrix
          style={{ width: '800px', height: '500px' }}
          preset="app-shell"
          slots={{
            header: <div data-testid="hdr">Header</div>,
            main: { children: <div data-testid="main-content">{manyRows}</div>, initialSize: 0.7 },
            rightBar: { children: <div data-testid="rb-content">Right</div>, initialSize: 0.3 },
            footer: { children: <div data-testid="ftr-content">Footer</div>, initialSize: 0.3 },
          }}
        />
      ),
      container,
    );

    // Footer panel must be rendered and contain its content — if the middle-row
    // panel expands past its flex-basis and steals all available height, the
    // footer panel collapses to 0 and the footer element may not be findable.
    const footerEl = container.querySelector('footer');
    expect(footerEl).not.toBeNull();
    expect(footerEl!.querySelector('[data-testid="ftr-content"]')).not.toBeNull();

    // Verify each vertical Panel has min-h-0 AND overflow-hidden class set (structural assertion).
    // min-h-0  → allows the panel to shrink below intrinsic content size.
    // overflow-hidden → clips panel content at the panel boundary so panels never
    //   visually overlap each other during resize (the overlap regression).
    const panels = container.querySelectorAll('[data-corvu-resizable-panel]');
    // There are at least 2 vertical panels (middle-row + footer).
    expect(panels.length).toBeGreaterThanOrEqual(2);
    for (const panel of panels) {
      expect(panel.classList.contains('min-h-0')).toBe(true);
      expect(panel.classList.contains('overflow-hidden')).toBe(true);
    }
  });
});

describe('Matrix raw rows — resize-mode slot rendering', () => {
  it('rows with resizable cells render cell content correctly', () => {
    cleanup = render(
      () => (
        <Matrix
          style={{ width: '800px', height: '600px' }}
          rows={[
            {
              cells: [
                { id: 'header', tag: 'header', children: <div data-testid="raw-hdr">H</div> },
              ],
              height: 'auto',
              resizable: false,
            },
            {
              resizable: true,
              cells: [
                {
                  id: 'left',
                  tag: 'aside',
                  children: <div data-testid="raw-left">L</div>,
                  width: 0.3,
                  resizable: true,
                },
                {
                  id: 'right',
                  tag: 'main',
                  children: <div data-testid="raw-right">R</div>,
                  width: 0.7,
                  resizable: true,
                },
              ],
            },
          ]}
        />
      ),
      container,
    );

    expect(container.querySelector('[data-testid="raw-hdr"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="raw-left"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="raw-right"]')).not.toBeNull();
  });
});
