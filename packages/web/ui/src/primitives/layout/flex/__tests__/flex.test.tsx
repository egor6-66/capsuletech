/**
 * Flex primitive — behaviour tests.
 *
 * Tests are organised in two groups:
 *
 * 1. Interface/structural contracts (.ts-style, no DOM render needed).
 * 2. Render-level behaviour (jsdom + solid render).
 *
 * The vitest config now includes `vite-plugin-solid`, so .tsx tests with JSX
 * are fully supported.  The `/* @vitest-environment jsdom *\/` comment below
 * activates the jsdom environment for this file.
 */
/* @vitest-environment jsdom */
import { render } from 'solid-js/web';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Flex } from '../flex';
import type { IFlexItem } from '../interfaces';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let container: HTMLDivElement;
let cleanup: (() => void) | undefined;

beforeEach(() => {
  container = document.createElement('div');
  container.style.width = '800px';
  container.style.height = '600px';
  document.body.appendChild(container);
});

afterEach(() => {
  cleanup?.();
  cleanup = undefined;
  document.body.removeChild(container);
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// 1. children-only mode
// ---------------------------------------------------------------------------

describe('Flex — children-only mode', () => {
  it('renders children when no items prop is provided', () => {
    cleanup = render(
      () => (
        <Flex>
          <div data-testid="child-a">A</div>
          <div data-testid="child-b">B</div>
        </Flex>
      ),
      container,
    );

    expect(container.querySelector('[data-testid="child-a"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="child-b"]')).not.toBeNull();
  });

  it('root element is a <div> with flex class', () => {
    cleanup = render(
      () => (
        <Flex>
          <span>hello</span>
        </Flex>
      ),
      container,
    );

    const root = container.firstElementChild as HTMLElement;
    expect(root.tagName.toLowerCase()).toBe('div');
    expect(root.classList.contains('flex')).toBe(true);
  });

  it('no corvu resizable panels are rendered in children mode', () => {
    cleanup = render(
      () => (
        <Flex>
          <div>content</div>
        </Flex>
      ),
      container,
    );

    const panels = container.querySelectorAll('[data-corvu-resizable-panel]');
    expect(panels.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 2. items without any resizable flag → plain CSS flex
// ---------------------------------------------------------------------------

describe('Flex — items without resizable:true renders as plain flex (no corvu)', () => {
  it('does not render corvu resizable panels', () => {
    const items: IFlexItem[] = [
      { children: <div data-testid="item-a">A</div> },
      { children: <div data-testid="item-b">B</div> },
    ];

    cleanup = render(() => <Flex items={items} />, container);

    const panels = container.querySelectorAll('[data-corvu-resizable-panel]');
    expect(panels.length).toBe(0);
  });

  it("renders each item's children inside a div wrapper", () => {
    const items: IFlexItem[] = [
      { children: <div data-testid="item-a">A</div> },
      { children: <div data-testid="item-b">B</div> },
    ];

    cleanup = render(() => <Flex items={items} />, container);

    expect(container.querySelector('[data-testid="item-a"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="item-b"]')).not.toBeNull();
  });

  it('explicit resizable:false on all items stays in plain flex mode', () => {
    const items: IFlexItem[] = [
      { children: <span data-testid="x">X</span>, resizable: false },
      { children: <span data-testid="y">Y</span>, resizable: false },
    ];

    cleanup = render(() => <Flex items={items} />, container);

    const panels = container.querySelectorAll('[data-corvu-resizable-panel]');
    expect(panels.length).toBe(0);
    expect(container.querySelector('[data-testid="x"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="y"]')).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 3. items with resizable:true → corvu Resizable mode
// ---------------------------------------------------------------------------

describe('Flex — items with resizable:true renders corvu Resizable', () => {
  it('renders corvu resizable panels when all items have resizable:true', () => {
    const items: IFlexItem[] = [
      { children: <div data-testid="panel-a">A</div>, resizable: true, initialSize: 0.4 },
      { children: <div data-testid="panel-b">B</div>, resizable: true, initialSize: 0.6 },
    ];

    cleanup = render(() => <Flex items={items} />, container);

    const panels = container.querySelectorAll('[data-corvu-resizable-panel]');
    expect(panels.length).toBeGreaterThanOrEqual(2);
  });

  it('panel content is rendered inside corvu panels', () => {
    const items: IFlexItem[] = [
      { children: <div data-testid="panel-a">A</div>, resizable: true, initialSize: 0.5 },
      { children: <div data-testid="panel-b">B</div>, resizable: true, initialSize: 0.5 },
    ];

    cleanup = render(() => <Flex items={items} />, container);

    expect(container.querySelector('[data-testid="panel-a"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="panel-b"]')).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 4. items mixed (some resizable, some not) → corvu mode
//    Non-resizable items participate in layout but no handle is placed
//    adjacent to them.
// ---------------------------------------------------------------------------

describe('Flex — items mixed (some resizable, some not) uses corvu mode', () => {
  it('enters corvu mode when at least one item has resizable:true', () => {
    const items: IFlexItem[] = [
      { children: <div data-testid="fixed">Fixed</div>, resizable: false, initialSize: 0.2 },
      { children: <div data-testid="flex-a">A</div>, resizable: true, initialSize: 0.4 },
      { children: <div data-testid="flex-b">B</div>, resizable: true, initialSize: 0.4 },
    ];

    cleanup = render(() => <Flex items={items} />, container);

    const panels = container.querySelectorAll('[data-corvu-resizable-panel]');
    // All three items become panels inside corvu root
    expect(panels.length).toBeGreaterThanOrEqual(3);
  });

  it('all item children are rendered even when mixing resizable flags', () => {
    const items: IFlexItem[] = [
      { children: <div data-testid="fixed">Fixed</div>, resizable: false, initialSize: 0.2 },
      { children: <div data-testid="flex-a">A</div>, resizable: true, initialSize: 0.8 },
    ];

    cleanup = render(() => <Flex items={items} />, container);

    expect(container.querySelector('[data-testid="fixed"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="flex-a"]')).not.toBeNull();
  });

  it('handle is NOT placed between a non-resizable item and its neighbour', () => {
    // Item 0: resizable:false → Item 1: resizable:true
    // The handle-show condition: both THIS item and the NEXT item must have
    // resizable !== false.  So no handle should appear after item 0.
    const items: IFlexItem[] = [
      { children: <div>Fixed</div>, resizable: false, initialSize: 0.3 },
      { children: <div>A</div>, resizable: true, initialSize: 0.7 },
    ];

    cleanup = render(() => <Flex items={items} withHandle />, container);

    // Handles are rendered as [data-corvu-resizable-handle].
    // With 2 items where first is resizable:false, there should be 0 handles.
    const handles = container.querySelectorAll('[data-corvu-resizable-handle]');
    expect(handles.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 5. items array of plain domain objects (no children/resizable fields)
//    → fallback to children prop + dev warning
// ---------------------------------------------------------------------------

describe('Flex — plain object array (no children/resizable) falls back to children', () => {
  it('emits a console.warn in dev when items have no children or resizable field', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Simulate domain data accidentally bound to `items`
    const domainData = [
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
    ] as unknown as IFlexItem[];

    cleanup = render(
      () => (
        <Flex items={domainData}>
          <div data-testid="fallback-child">fallback</div>
        </Flex>
      ),
      container,
    );

    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy.mock.calls[0][0]).toContain('[Flex]');
    expect(warnSpy.mock.calls[0][0]).toContain('items');
  });

  it('falls back to rendering children when items is a plain domain array', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const domainData = [
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
    ] as unknown as IFlexItem[];

    cleanup = render(
      () => (
        <Flex items={domainData}>
          <div data-testid="fallback-child">fallback</div>
        </Flex>
      ),
      container,
    );

    expect(container.querySelector('[data-testid="fallback-child"]')).not.toBeNull();
  });

  it('does not render corvu panels when falling back from a plain domain array', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const domainData = [
      { id: 1, label: 'X' },
      { id: 2, label: 'Y' },
    ] as unknown as IFlexItem[];

    cleanup = render(
      () => (
        <Flex items={domainData}>
          <div>child</div>
        </Flex>
      ),
      container,
    );

    const panels = container.querySelectorAll('[data-corvu-resizable-panel]');
    expect(panels.length).toBe(0);
  });

  it('does not warn when items is an empty array', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    cleanup = render(
      () => (
        <Flex items={[]}>
          <div data-testid="child">child</div>
        </Flex>
      ),
      container,
    );

    // Empty array: isValidItemsArray returns false (length === 0), falls through
    // to children-mode silently — no warning because it's an intentional empty state.
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
