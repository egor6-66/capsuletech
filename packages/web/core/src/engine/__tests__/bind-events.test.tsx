/* @vitest-environment jsdom */
/**
 * bind-events.test.tsx
 *
 * Characterization tests for `bindEvents` — the events-only wrapper used by
 * CompositeProxyContext.wrap to bind HCA events on composite internal rows
 * (DataTable.Row, List.Item, etc.) WITHOUT per-row registration in the store.
 *
 * Contracts verified:
 *  1. onClick fires ctx.controller.onClick once with correct target
 *     (meta.tags contains 'incident', payload.id === 1).
 *  2. ctx.store.registerComponent is NOT called (no registration side-effects).
 *  3. createUniqueId is NOT observable through store side-effects.
 *  4. meta and payload are consumed — NOT forwarded to the wrapped Comp as props.
 *  5. Event dedup marker prevents double-dispatch when the wrapped component
 *     is nested inside another bindEvents wrapper (simulates row inside table).
 *  6. onInput fires with correct target value.
 *  7. User-supplied props[eventName] (e.g. props.onClick) is still forwarded.
 */

import { render } from 'solid-js/web';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bindEvents } from '../ui-proxy';

// ---------------------------------------------------------------------------
// Fake ctx — mirrors mkCtx from ui-proxy.test.tsx; no XState dependency
// ---------------------------------------------------------------------------

const mkCtx = (overrides: Partial<any> = {}) => {
  const controller: Record<string, ReturnType<typeof vi.fn>> = {
    onClick: vi.fn(),
    onDblClick: vi.fn(),
    onInput: vi.fn(),
    onChange: vi.fn(),
    onBlur: vi.fn(),
    onFocus: vi.fn(),
    onKeyDown: vi.fn(),
  };
  const store = {
    registerComponent: vi.fn(),
    unregisterComponent: vi.fn(),
    update: vi.fn(),
    updateComponent: vi.fn(),
    ctx: { foo: 'bar' },
    styles: {} as Record<string, string>,
    loading: false,
    props: {} as Record<string, any>,
  };
  return { controller, store, parent: null, state: { value: 'idle' } as any, ...overrides };
};

// ---------------------------------------------------------------------------
// Stub components — record which props they received
// ---------------------------------------------------------------------------

type StubProps = {
  'data-testid'?: string;
  onClick?: (e: MouseEvent) => void;
  meta?: { tags: string[]; [k: string]: unknown };
  payload?: Record<string, unknown>;
  [k: string]: unknown;
};

let receivedProps: StubProps | null = null;

const StubRow = (props: StubProps) => {
  receivedProps = { ...props };
  return <tr data-testid={props['data-testid'] ?? 'row'} onClick={props.onClick as any} />;
};

// ---------------------------------------------------------------------------
// Test infra
// ---------------------------------------------------------------------------

let container: HTMLDivElement;
let cleanup: () => void;

beforeEach(() => {
  receivedProps = null;
  container = document.createElement('div');
  document.body.appendChild(container);
});

afterEach(() => {
  cleanup?.();
  document.body.removeChild(container);
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// 1. onClick fires with correct target; no registration side-effects
// ---------------------------------------------------------------------------

describe('bindEvents — onClick dispatch + no registration', () => {
  it('calls ctx.controller.onClick once with target whose meta.tags includes the tag and payload.id matches', () => {
    const ctx = mkCtx() as any;
    const Wrapped = bindEvents(ctx, StubRow as any, 'DataTableRow') as any;

    cleanup = render(
      () => (
        <table>
          <tbody>
            <Wrapped meta={{ tags: ['incident'] }} payload={{ id: 1 }} />
          </tbody>
        </table>
      ),
      container,
    );

    const row = container.querySelector('[data-testid="row"]') as HTMLElement;
    row.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(ctx.controller.onClick).toHaveBeenCalledOnce();

    const [target, context] = ctx.controller.onClick.mock.calls[0];
    expect(target.meta.tags).toContain('incident');
    expect((target.payload as any).id).toBe(1);
    expect(context).toEqual({ foo: 'bar' }); // store.ctx pass-through
  });

  it('does NOT call ctx.store.registerComponent (no per-row registration)', () => {
    const ctx = mkCtx() as any;
    const Wrapped = bindEvents(ctx, StubRow as any, 'DataTableRow') as any;

    cleanup = render(
      () => (
        <table>
          <tbody>
            <Wrapped meta={{ tags: ['incident'] }} payload={{ id: 1 }} />
          </tbody>
        </table>
      ),
      container,
    );

    const row = container.querySelector('[data-testid="row"]') as HTMLElement;
    row.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(ctx.store.registerComponent).not.toHaveBeenCalled();
    expect(ctx.store.unregisterComponent).not.toHaveBeenCalled();
  });

  it('does NOT call ctx.store.updateComponent on click (updateStore=false for onClick)', () => {
    const ctx = mkCtx() as any;
    const Wrapped = bindEvents(ctx, StubRow as any) as any;

    cleanup = render(
      () => (
        <table>
          <tbody>
            <Wrapped meta={{ tags: ['incident'] }} payload={{ id: 42 }} />
          </tbody>
        </table>
      ),
      container,
    );

    const row = container.querySelector('[data-testid="row"]') as HTMLElement;
    row.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(ctx.store.updateComponent).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 2. meta and payload are consumed — NOT forwarded as props to Comp
// ---------------------------------------------------------------------------

describe('bindEvents — meta/payload consumption', () => {
  it('does NOT pass meta to the wrapped component', () => {
    const ctx = mkCtx() as any;
    const Wrapped = bindEvents(ctx, StubRow as any, 'DataTableRow') as any;

    cleanup = render(
      () => (
        <table>
          <tbody>
            <Wrapped meta={{ tags: ['incident'] }} payload={{ id: 1 }} />
          </tbody>
        </table>
      ),
      container,
    );

    // StubRow records props — meta must NOT be present
    expect(receivedProps?.meta).toBeUndefined();
  });

  it('does NOT pass payload to the wrapped component', () => {
    const ctx = mkCtx() as any;
    const Wrapped = bindEvents(ctx, StubRow as any, 'DataTableRow') as any;

    cleanup = render(
      () => (
        <table>
          <tbody>
            <Wrapped meta={{ tags: ['incident'] }} payload={{ id: 1 }} />
          </tbody>
        </table>
      ),
      container,
    );

    expect(receivedProps?.payload).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 3. Event dedup — nested bindEvents wrappers only dispatch once
// ---------------------------------------------------------------------------

describe('bindEvents — event bubble dedup (eventMarker)', () => {
  it('inner wrapper fires first and marks event; outer bindEvents wrapper skips (total = 1 call)', () => {
    const ctx = mkCtx() as any;

    // Inner: the actual DataTableRow wrapper
    const InnerComp = (props: any) => (
      // biome-ignore lint/a11y/useKeyWithClickEvents: test fixture, not real UI
      <tr data-testid="inner-row" onClick={props.onClick}>
        <td>{props.children}</td>
      </tr>
    );
    const WrappedInner = bindEvents(ctx, InnerComp as any, 'DataTableRow') as any;

    // Outer: simulates a second bindEvents layer (e.g. another wrapping composite)
    const OuterComp = (props: any) => (
      // biome-ignore lint/a11y/useKeyWithClickEvents: test fixture, not real UI
      <tbody data-testid="outer-tbody" onClick={props.onClick}>
        {props.children}
      </tbody>
    );
    const WrappedOuter = bindEvents(ctx, OuterComp as any, 'DataTableOuter') as any;

    cleanup = render(
      () => (
        <table>
          <WrappedOuter meta={{ tags: ['table'] }}>
            <WrappedInner meta={{ tags: ['incident'] }} payload={{ id: 99 }} />
          </WrappedOuter>
        </table>
      ),
      container,
    );

    const inner = container.querySelector('[data-testid="inner-row"]') as HTMLElement;
    inner.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    // Both wrappers received the bubbled click, but __capsule_onClick__ dedup
    // means the innermost handler fires first and marks it — outer is skipped.
    expect(ctx.controller.onClick).toHaveBeenCalledOnce();

    // The target that arrived should be from the INNER wrapper (innermost wins)
    const [target] = ctx.controller.onClick.mock.calls[0];
    expect(target.meta.tags).toContain('incident');
  });
});

// ---------------------------------------------------------------------------
// 4. User-supplied props event handler is also called
// ---------------------------------------------------------------------------

describe('bindEvents — user props event handler forwarding', () => {
  it('calls user-supplied props.onClick after ctx.controller.onClick', () => {
    const ctx = mkCtx() as any;
    const userClickHandler = vi.fn();
    const Wrapped = bindEvents(ctx, StubRow as any) as any;

    cleanup = render(
      () => (
        <table>
          <tbody>
            <Wrapped meta={{ tags: ['incident'] }} payload={{ id: 5 }} onClick={userClickHandler} />
          </tbody>
        </table>
      ),
      container,
    );

    const row = container.querySelector('[data-testid="row"]') as HTMLElement;
    row.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(ctx.controller.onClick).toHaveBeenCalledOnce();
    expect(userClickHandler).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// 5. onInput dispatches with correct target value
// ---------------------------------------------------------------------------

describe('bindEvents — onInput dispatch', () => {
  it('calls ctx.controller.onInput with target.value from the element', () => {
    const ctx = mkCtx() as any;

    const StubInput = (props: any) => (
      <input data-testid="composite-input" onInput={props.onInput} />
    );
    const Wrapped = bindEvents(ctx, StubInput as any) as any;

    cleanup = render(() => <Wrapped meta={{ tags: ['search'] }} />, container);

    const inp = container.querySelector('[data-testid="composite-input"]') as HTMLInputElement;
    inp.value = 'hello';
    inp.dispatchEvent(new Event('input', { bubbles: true }));

    expect(ctx.controller.onInput).toHaveBeenCalledOnce();
    const [target] = ctx.controller.onInput.mock.calls[0];
    expect(target.value).toBe('hello');
    expect(target.meta.tags).toContain('search');
  });
});

// ---------------------------------------------------------------------------
// 6. onDblClick dispatches with correct target; dedup mirrors onClick
// ---------------------------------------------------------------------------

describe('bindEvents — onDblClick dispatch', () => {
  // StubRow only forwards `onClick`; for dblclick tests we use an explicit stub
  // that also forwards `onDblClick` — mirrors how real composite rows pass through
  // all bound event props to their underlying DOM element.
  const StubDblRow = (props: any) => <tr data-testid="dbl-row" onDblClick={props.onDblClick} />;

  it('calls ctx.controller.onDblClick once with correct target (meta.tags + payload)', () => {
    const ctx = mkCtx() as any;
    const Wrapped = bindEvents(ctx, StubDblRow as any, 'DataTableRow') as any;

    cleanup = render(
      () => (
        <table>
          <tbody>
            <Wrapped meta={{ tags: ['incident'] }} payload={{ id: 7 }} />
          </tbody>
        </table>
      ),
      container,
    );

    const row = container.querySelector('[data-testid="dbl-row"]') as HTMLElement;
    row.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));

    expect(ctx.controller.onDblClick).toHaveBeenCalledOnce();
    const [target, context] = ctx.controller.onDblClick.mock.calls[0];
    expect(target.meta.tags).toContain('incident');
    expect((target.payload as any).id).toBe(7);
    expect(context).toEqual({ foo: 'bar' });
  });

  it('does NOT call ctx.store.updateComponent on dblclick (updateStore=false)', () => {
    const ctx = mkCtx() as any;
    const Wrapped = bindEvents(ctx, StubDblRow as any) as any;

    cleanup = render(
      () => (
        <table>
          <tbody>
            <Wrapped meta={{ tags: ['incident'] }} payload={{ id: 7 }} />
          </tbody>
        </table>
      ),
      container,
    );

    const row = container.querySelector('[data-testid="dbl-row"]') as HTMLElement;
    row.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));

    expect(ctx.store.updateComponent).not.toHaveBeenCalled();
  });

  it('dblclick dedup: inner wrapper fires first and marks event; outer bindEvents skips (total = 1 call)', () => {
    const ctx = mkCtx() as any;

    const InnerComp = (props: any) => (
      // biome-ignore lint/a11y/useKeyWithClickEvents: test fixture, not real UI
      <tr data-testid="inner-row" onDblClick={props.onDblClick}>
        <td>{props.children}</td>
      </tr>
    );
    const WrappedInner = bindEvents(ctx, InnerComp as any, 'DataTableRow') as any;

    const OuterComp = (props: any) => (
      // biome-ignore lint/a11y/useKeyWithClickEvents: test fixture, not real UI
      <tbody data-testid="outer-tbody" onDblClick={props.onDblClick}>
        {props.children}
      </tbody>
    );
    const WrappedOuter = bindEvents(ctx, OuterComp as any, 'DataTableOuter') as any;

    cleanup = render(
      () => (
        <table>
          <WrappedOuter meta={{ tags: ['table'] }}>
            <WrappedInner meta={{ tags: ['incident'] }} payload={{ id: 99 }} />
          </WrappedOuter>
        </table>
      ),
      container,
    );

    const inner = container.querySelector('[data-testid="inner-row"]') as HTMLElement;
    inner.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));

    expect(ctx.controller.onDblClick).toHaveBeenCalledOnce();
    const [target] = ctx.controller.onDblClick.mock.calls[0];
    expect(target.meta.tags).toContain('incident');
  });

  it('does NOT call ctx.store.registerComponent (no per-row registration)', () => {
    const ctx = mkCtx() as any;
    const Wrapped = bindEvents(ctx, StubDblRow as any, 'DataTableRow') as any;

    cleanup = render(
      () => (
        <table>
          <tbody>
            <Wrapped meta={{ tags: ['incident'] }} payload={{ id: 7 }} />
          </tbody>
        </table>
      ),
      container,
    );

    const row = container.querySelector('[data-testid="dbl-row"]') as HTMLElement;
    row.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));

    expect(ctx.store.registerComponent).not.toHaveBeenCalled();
  });
});
