/**
 * Regression test for: Matrix resize-mode loses slot children.
 *
 * Root cause: `buildHorizontalItems(...)` was inlined inside the JSX prop
 * `items={buildHorizontalItems(...)}`. The Solid compiler wraps non-literal
 * props in getters — so `get items() { return buildHorizontalItems(...); }`.
 * This getter fires multiple times per render (itemsMode, hasResizable, sizes
 * memo, For each, Show when). Each call to buildHorizontalItems created fresh
 * JSX nodes and re-inserted slot.children DOM nodes, which moved them out of
 * the already-rendered corvu Panel → visible slot content disappeared.
 *
 * Fix: store `buildHorizontalItems(...)` result in a local variable before JSX
 * so the getter is a stable reference that does NOT re-call the builder.
 * Defence: ResizableFlex snapshots `props.items` via createMemo so even if the
 * outer getter is still function-based, it fires at most once per reactive cycle.
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

describe('Matrix — resize mode slot children', () => {
  it('main slot content is rendered inside <main> when main is resizable', () => {
    cleanup = render(
      () => (
        <Matrix
          style={{ width: '800px', height: '600px' }}
          slots={{
            header: { children: <div data-testid="hdr">Header</div> },
            main: { children: <div data-testid="main-content">MAIN</div>, resizable: true, initialSize: 0.8 },
            rightBar: { children: <div data-testid="rb-content">RIGHT</div>, resizable: true, initialSize: 0.2 },
          }}
        />
      ),
      container,
    );

    // Header (non-resizable) should always work — used as sanity baseline.
    expect(container.querySelector('[data-testid="hdr"]')).not.toBeNull();

    // Main slot must be present inside the <main> corvu panel.
    const mainEl = container.querySelector('main');
    expect(mainEl).not.toBeNull();
    expect(mainEl!.querySelector('[data-testid="main-content"]')).not.toBeNull();

    // RightBar slot must be inside the <aside> corvu panel.
    const asideEls = container.querySelectorAll('aside');
    const rightBarAside = Array.from(asideEls).find((el) =>
      el.querySelector('[data-testid="rb-content"]'),
    );
    expect(rightBarAside).not.toBeUndefined();
  });

  it('main+rightBar+footer all resizable — slot content rendered in each panel', () => {
    cleanup = render(
      () => (
        <Matrix
          style={{ width: '800px', height: '600px' }}
          slots={{
            header: { children: <div data-testid="hdr">Header</div> },
            main: { children: <div data-testid="main-content">MAIN</div>, resizable: true, initialSize: 0.8 },
            rightBar: { children: <div data-testid="rb-content">RIGHT</div>, resizable: true, initialSize: 0.2 },
            footer: { children: <div data-testid="ftr-content">Footer</div>, resizable: true, initialSize: 0.3 },
          }}
        />
      ),
      container,
    );

    // This is the exact scenario from the bug report.
    expect(container.querySelector('[data-testid="hdr"]')).not.toBeNull();

    const mainEl = container.querySelector('main');
    expect(mainEl).not.toBeNull();
    // Before the fix, mainEl.children.length === 0 (content was displaced).
    expect(mainEl!.childElementCount).toBeGreaterThan(0);
    expect(mainEl!.querySelector('[data-testid="main-content"]')).not.toBeNull();

    const footerEl = container.querySelector('footer');
    expect(footerEl).not.toBeNull();
    expect(footerEl!.querySelector('[data-testid="ftr-content"]')).not.toBeNull();
  });
});
