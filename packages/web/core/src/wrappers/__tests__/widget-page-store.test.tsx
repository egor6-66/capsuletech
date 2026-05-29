/* @vitest-environment jsdom */
/**
 * widget-page-store.test.tsx
 *
 * Characterization tests for Decision A1:
 *   Widget((Ui, store, props?) => JSX) and Page((Ui, store, props?) => JSX)
 *
 * Contracts verified:
 *  1. Widget factory receives store as 2nd arg when rendered inside a Controller tree.
 *  2. Widget factory receives `undefined` as store when rendered outside a Controller tree.
 *  3. Page factory receives store as 2nd arg when rendered inside a Controller tree.
 *  4. Page factory receives `undefined` as store when rendered outside a Controller tree.
 *  5. Widget props (3rd arg) are still forwarded correctly.
 *  6. Page props (3rd arg) are still forwarded correctly.
 *  7. View factory signature is UNCHANGED: store is NOT injected — props still arrives 2nd.
 *  8. The store passed to Widget/Page is the exact same IBridge object from the context.
 *  9. Widget factory without store/props args — backward-compat, no runtime error.
 * 10. Page factory without store/props args — backward-compat, no runtime error.
 */

import { render } from 'solid-js/web';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Context } from '../../engine/ctx';
import { PageWrapper } from '../page';
import { ViewWrapper } from '../view';
import { WidgetWrapper } from '../widget';

// ---------------------------------------------------------------------------
// Minimal fake IBridge — mirrors the shape used by ui-proxy tests (mkCtx).
// ---------------------------------------------------------------------------

const mkStore = (tag = 'store-a') =>
  ({
    registerComponent: vi.fn(),
    unregisterComponent: vi.fn(),
    update: vi.fn(),
    updateComponent: vi.fn(),
    ctx: { tag },
    styles: {} as Record<string, string>,
    loading: false,
    props: {} as Record<string, any>,
    components: {} as Record<string, any>,
  }) as any;

const mkCtx = (store: any) => ({
  state: { value: 'idle' } as any,
  store,
  controller: { onClick: vi.fn() } as any,
  parent: undefined,
});

// ---------------------------------------------------------------------------
// Test infra
// ---------------------------------------------------------------------------

let container: HTMLDivElement;
let cleanup: () => void;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
});

afterEach(() => {
  cleanup?.();
  document.body.removeChild(container);
  vi.restoreAllMocks();
});

// Helper: wrap `children` inside a fake Context.Provider (simulates being
// inside a Controller/Feature tree without spinning up XState).
function withCtx(store: any, children: () => any) {
  const ctx = mkCtx(store);
  return () => (
    <Context.Provider value={ctx as any}>
      {children()}
    </Context.Provider>
  );
}

// ---------------------------------------------------------------------------
// 1. Widget — store arrives as 2nd arg when inside Controller tree
// ---------------------------------------------------------------------------

describe('WidgetWrapper — store injection', () => {
  it('receives store as 2nd arg when inside a Controller tree', () => {
    const fakeStore = mkStore('widget-test');
    let capturedStore: any = 'NOT_SET';

    const MyWidget = WidgetWrapper((_ui, store) => {
      capturedStore = store;
      return <div data-testid="w">ok</div>;
    });

    cleanup = render(
      withCtx(fakeStore, () => <MyWidget>{null}</MyWidget>),
      container,
    );

    expect(capturedStore).toBe(fakeStore);
    expect(capturedStore?.ctx?.tag).toBe('widget-test');
  });

  it('receives undefined as store when rendered outside a Controller tree', () => {
    let capturedStore: any = 'NOT_SET';

    const MyWidget = WidgetWrapper((_ui, store) => {
      capturedStore = store;
      return <div data-testid="w2">ok</div>;
    });

    cleanup = render(() => <MyWidget>{null}</MyWidget>, container);

    expect(capturedStore).toBeUndefined();
  });

  it('store is the exact same IBridge reference from Context (referential equality)', () => {
    const fakeStore = mkStore('ref-check');
    let capturedStore: any = null;

    const MyWidget = WidgetWrapper((_ui, store) => {
      capturedStore = store;
      return <span />;
    });

    cleanup = render(
      withCtx(fakeStore, () => <MyWidget>{null}</MyWidget>),
      container,
    );

    expect(capturedStore).toBe(fakeStore);
  });
});

// ---------------------------------------------------------------------------
// 2. Widget — props forwarding (3rd arg)
// ---------------------------------------------------------------------------

describe('WidgetWrapper — props forwarding (3rd arg)', () => {
  it('props.title arrives as 3rd arg when inside Controller tree', () => {
    const fakeStore = mkStore();
    let capturedTitle: unknown = 'NOT_SET';

    const MyWidget = WidgetWrapper<{ title?: string }>((_ui, _store, props) => {
      capturedTitle = props.title;
      return <div data-testid="title">{props.title}</div>;
    });

    cleanup = render(
      withCtx(fakeStore, () => <MyWidget title="Hello">{null}</MyWidget>),
      container,
    );

    expect(capturedTitle).toBe('Hello');
    expect(container.querySelector('[data-testid="title"]')?.textContent).toBe('Hello');
  });

  it('props.title arrives as 3rd arg when outside Controller tree', () => {
    let capturedTitle: unknown = 'NOT_SET';

    const MyWidget = WidgetWrapper<{ title?: string }>((_ui, _store, props) => {
      capturedTitle = props.title;
      return <div data-testid="title2">{props.title}</div>;
    });

    cleanup = render(
      () => <MyWidget title="Standalone">{null}</MyWidget>,
      container,
    );

    expect(capturedTitle).toBe('Standalone');
  });

  it('backward-compat: factory with only (Ui) — no runtime error', () => {
    const MyWidget = WidgetWrapper((_ui) => {
      return <div data-testid="compat-w">ok</div>;
    });

    cleanup = render(() => <MyWidget>{null}</MyWidget>, container);
    expect(container.querySelector('[data-testid="compat-w"]')?.textContent).toBe('ok');
  });
});

// ---------------------------------------------------------------------------
// 3. Page — store arrives as 2nd arg when inside Controller tree
// ---------------------------------------------------------------------------

describe('PageWrapper — store injection', () => {
  it('receives store as 2nd arg when inside a Controller tree', () => {
    const fakeStore = mkStore('page-test');
    let capturedStore: any = 'NOT_SET';

    const MyPage = PageWrapper((_ui, store) => {
      capturedStore = store;
      return <div data-testid="p">ok</div>;
    });

    cleanup = render(
      withCtx(fakeStore, () => <MyPage>{null}</MyPage>),
      container,
    );

    expect(capturedStore).toBe(fakeStore);
    expect(capturedStore?.ctx?.tag).toBe('page-test');
  });

  it('receives undefined as store when rendered outside a Controller tree', () => {
    let capturedStore: any = 'NOT_SET';

    const MyPage = PageWrapper((_ui, store) => {
      capturedStore = store;
      return <div data-testid="p2">ok</div>;
    });

    cleanup = render(() => <MyPage>{null}</MyPage>, container);

    expect(capturedStore).toBeUndefined();
  });

  it('store is the exact same IBridge reference from Context', () => {
    const fakeStore = mkStore('page-ref');
    let capturedStore: any = null;

    const MyPage = PageWrapper((_ui, store) => {
      capturedStore = store;
      return <span />;
    });

    cleanup = render(
      withCtx(fakeStore, () => <MyPage>{null}</MyPage>),
      container,
    );

    expect(capturedStore).toBe(fakeStore);
  });
});

// ---------------------------------------------------------------------------
// 4. Page — props forwarding (3rd arg)
// ---------------------------------------------------------------------------

describe('PageWrapper — props forwarding (3rd arg)', () => {
  it('props.section arrives as 3rd arg', () => {
    let capturedSection: unknown = 'NOT_SET';

    const MyPage = PageWrapper<{ section?: string }>((_ui, _store, props) => {
      capturedSection = props.section;
      return <div data-testid="section">{props.section}</div>;
    });

    cleanup = render(
      () => <MyPage section="Dashboard">{null}</MyPage>,
      container,
    );

    expect(capturedSection).toBe('Dashboard');
    expect(container.querySelector('[data-testid="section"]')?.textContent).toBe('Dashboard');
  });

  it('backward-compat: factory with only (Ui) — no runtime error', () => {
    const MyPage = PageWrapper((_ui) => {
      return <div data-testid="compat-p">ok</div>;
    });

    cleanup = render(() => <MyPage>{null}</MyPage>, container);
    expect(container.querySelector('[data-testid="compat-p"]')?.textContent).toBe('ok');
  });
});

// ---------------------------------------------------------------------------
// 5. View — signature UNCHANGED: store is NOT injected, props still arrives 2nd
// ---------------------------------------------------------------------------

describe('ViewWrapper — signature unchanged (store NOT injected)', () => {
  it('View 2nd arg is still props, not store', () => {
    const fakeStore = mkStore('should-not-appear');
    let capturedSecondArg: any = 'NOT_SET';

    // Suppress the DEV console.warn for View outside Controller
    const savedWarn = console.warn;
    console.warn = () => {};

    const MyView = ViewWrapper<{ label?: string }>((_ui, props) => {
      capturedSecondArg = props;
      return <div data-testid="view">{props.label}</div>;
    });

    cleanup = render(
      withCtx(fakeStore, () => <MyView label="test-label" />),
      container,
    );

    console.warn = savedWarn;

    // The 2nd arg must be props (has .label), NOT the store (no .ctx.tag)
    expect(capturedSecondArg?.label).toBe('test-label');
    expect(capturedSecondArg?.ctx).toBeUndefined();
    expect(container.querySelector('[data-testid="view"]')?.textContent).toBe('test-label');
  });

  it('View factory (Ui, props) — store from Context does NOT leak into props', () => {
    const fakeStore = mkStore('leak-check');
    let capturedProps: any = null;

    const savedWarn = console.warn;
    console.warn = () => {};

    const MyView = ViewWrapper((_ui, props) => {
      capturedProps = props;
      return <span />;
    });

    cleanup = render(
      withCtx(fakeStore, () => <MyView />),
      container,
    );

    console.warn = savedWarn;

    // props should NOT contain any IBridge fields
    expect(capturedProps?.registerComponent).toBeUndefined();
    expect(capturedProps?.updateComponent).toBeUndefined();
  });
});
