/* @vitest-environment jsdom */
import { For, Show } from 'solid-js';
import { render } from 'solid-js/web';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UiProxy, wrapComponent } from '../ui-proxy';

// UiProxy render-path тесты. Тестим `wrapComponent` напрямую (вынесен из
// внутренних closures именно ради этого), чтобы не поднимать lazy ui-kit
// граф через Suspense. Контракт: один и тот же `wrap`, что используется
// UiProxy через Proxy.get.

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

const StubButton = (props: any) => (
  <button data-testid="btn" type={props.type ?? 'button'} {...props}>
    {props.children}
  </button>
);
const StubInput = (props: any) => <input data-testid="inp" {...props} />;

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

describe('wrapComponent — pass-through (no own meta)', () => {
  it('does NOT register in store', () => {
    const ctx = mkCtx() as any;
    const Wrapped = wrapComponent(ctx, {}, StubButton);
    cleanup = render(() => <Wrapped>Hi</Wrapped>, container);
    expect(ctx.store.registerComponent).not.toHaveBeenCalled();
  });

  it('renders children through', () => {
    const ctx = mkCtx() as any;
    const Wrapped = wrapComponent(ctx, {}, StubButton);
    cleanup = render(() => <Wrapped>Hi</Wrapped>, container);
    expect(container.textContent).toBe('Hi');
  });

  it('click does NOT invoke ctx.controller.onClick', () => {
    const ctx = mkCtx() as any;
    const Wrapped = wrapComponent(ctx, {}, StubButton);
    cleanup = render(() => <Wrapped>Hi</Wrapped>, container);
    const btn = container.querySelector('[data-testid="btn"]') as HTMLButtonElement;
    btn.click();
    expect(ctx.controller.onClick).not.toHaveBeenCalled();
  });
});

describe('wrapComponent — own meta path', () => {
  it('registers in store on mount', () => {
    const ctx = mkCtx() as any;
    const Wrapped = wrapComponent(ctx, {}, StubButton);
    cleanup = render(() => <Wrapped meta={{ tags: ['submit'] }}>Go</Wrapped>, container);
    expect(ctx.store.registerComponent).toHaveBeenCalledOnce();
    const arg = ctx.store.registerComponent.mock.calls[0][0];
    const [, registered] = Object.entries(arg)[0] as [string, any];
    expect(registered.name).toBe('submit'); // выведено из meta.tags
  });

  it('unregisters on cleanup (Solid dispose)', () => {
    const ctx = mkCtx() as any;
    const Wrapped = wrapComponent(ctx, {}, StubButton);
    const dispose = render(() => <Wrapped meta={{ tags: ['submit'] }}>Go</Wrapped>, container);
    expect(ctx.store.registerComponent).toHaveBeenCalledOnce();
    dispose();
    expect(ctx.store.unregisterComponent).toHaveBeenCalledOnce();
    // cleanup outer afterEach уже без render
    cleanup = () => {};
  });

  it('click invokes ctx.controller.onClick with target + ctx.store.ctx', () => {
    const ctx = mkCtx() as any;
    const Wrapped = wrapComponent(ctx, {}, StubButton);
    cleanup = render(() => <Wrapped meta={{ tags: ['submit'] }}>Go</Wrapped>, container);
    const btn = container.querySelector('[data-testid="btn"]') as HTMLButtonElement;
    btn.click();
    expect(ctx.controller.onClick).toHaveBeenCalledOnce();
    const [target, context] = ctx.controller.onClick.mock.calls[0];
    expect(target.name).toBe('submit');
    expect(context).toEqual({ foo: 'bar' }); // store.ctx pass-through
  });

  it('also invokes props.onClick after ctx.controller.onClick', () => {
    const ctx = mkCtx() as any;
    const userHandler = vi.fn();
    const Wrapped = wrapComponent(ctx, {}, StubButton);
    cleanup = render(
      () => (
        <Wrapped meta={{ tags: ['submit'] }} onClick={userHandler}>
          Go
        </Wrapped>
      ),
      container,
    );
    const btn = container.querySelector('[data-testid="btn"]') as HTMLButtonElement;
    btn.click();
    expect(userHandler).toHaveBeenCalledOnce();
  });

  it('input event: updateStore=true → store.updateComponent called with value+type only', () => {
    const ctx = mkCtx() as any;
    const Wrapped = wrapComponent(ctx, {}, StubInput);
    cleanup = render(() => <Wrapped meta={{ tags: ['email'] }} />, container);
    const inp = container.querySelector('[data-testid="inp"]') as HTMLInputElement;
    inp.value = 'foo@bar';
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    expect(ctx.store.updateComponent).toHaveBeenCalledOnce();
    const arg = ctx.store.updateComponent.mock.calls[0][0];
    const [, payload] = Object.entries(arg)[0] as [string, any];
    expect(Object.keys(payload)).toEqual(['value', 'type']);
    expect(ctx.controller.onInput).toHaveBeenCalledOnce();
  });

  it('input event: store.update (user namespace) NOT called', () => {
    const ctx = mkCtx() as any;
    const Wrapped = wrapComponent(ctx, {}, StubInput);
    cleanup = render(() => <Wrapped meta={{ tags: ['email'] }} />, container);
    const inp = container.querySelector('[data-testid="inp"]') as HTMLInputElement;
    inp.value = 'foo@bar';
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    expect(ctx.store.update).not.toHaveBeenCalled();
  });

  it('click event: updateStore=false → store.updateComponent NOT called', () => {
    const ctx = mkCtx() as any;
    const Wrapped = wrapComponent(ctx, {}, StubButton);
    cleanup = render(() => <Wrapped meta={{ tags: ['submit'] }}>Go</Wrapped>, container);
    const btn = container.querySelector('[data-testid="btn"]') as HTMLButtonElement;
    btn.click();
    expect(ctx.controller.onClick).toHaveBeenCalledOnce();
    expect(ctx.store.updateComponent).not.toHaveBeenCalled();
    expect(ctx.store.update).not.toHaveBeenCalled();
  });
});

describe('wrapComponent — event bubble dedupe', () => {
  it('outer wrapper does not invoke ctx.controller twice for the same event', () => {
    // Эмулируем nested wrappers: Inner с meta, Outer без meta — но обёрнут
    // тоже (wrap pass-through). Реальный сценарий: <Field meta={...}>
    // <button meta={...}/> </Field>. У обоих собственный meta — два registry,
    // но один event = один controller-call на ТЕКУЩЕЙ обёртке.
    const ctx = mkCtx() as any;
    const Inner = (p: any) => (
      <span data-testid="inner" {...p}>
        {p.children}
      </span>
    );
    const Outer = (p: any) => (
      <div data-testid="outer" {...p}>
        {p.children}
      </div>
    );
    const WrappedInner = wrapComponent(ctx, {}, Inner);
    const WrappedOuter = wrapComponent(ctx, {}, Outer);

    cleanup = render(
      () => (
        <WrappedOuter meta={{ tags: ['outer'] }}>
          <WrappedInner meta={{ tags: ['inner'] }}>x</WrappedInner>
        </WrappedOuter>
      ),
      container,
    );

    const inner = container.querySelector('[data-testid="inner"]') as HTMLElement;
    inner.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    // Обе обёртки получили click (через bubbling), но __capsule_onClick__
    // dedupe-флаг пропустил вторую: 1 вызов вместо 2.
    expect(ctx.controller.onClick).toHaveBeenCalledOnce();
  });
});

describe('wrapComponent — Proxy subcomponent (Field.Label-like)', () => {
  it('sub-component access returns wrapped component', () => {
    const ctx = mkCtx() as any;
    // biome-ignore lint/a11y/noLabelWithoutControl: test stub for sub-component access; not a real form label
    const Label = (p: any) => <label {...p}>{p.children}</label>;
    const Field = Object.assign((p: any) => <fieldset {...p}>{p.children}</fieldset>, { Label });
    const WrappedField = wrapComponent(ctx, {}, Field);
    const WrappedLabel = (WrappedField as any).Label;

    expect(typeof WrappedLabel).toBe('function');
    cleanup = render(
      () => <WrappedLabel meta={{ tags: ['email-label'] }}>Email</WrappedLabel>,
      container,
    );
    expect(ctx.store.registerComponent).toHaveBeenCalledOnce();
  });
});

describe('wrapComponent — KIND_TAGS auto-inject', () => {
  it('whitelist primitive (Input) without explicit "input" tag — registerComponent payload contains "input" in meta.tags', () => {
    const ctx = mkCtx() as any;
    // componentName='Input' simulates UiProxy.get('Input')
    const Wrapped = wrapComponent(ctx, {}, StubInput, 'Input');
    cleanup = render(() => <Wrapped meta={{ tags: ['login'] }} />, container);
    expect(ctx.store.registerComponent).toHaveBeenCalledOnce();
    const arg = ctx.store.registerComponent.mock.calls[0][0];
    const [, registered] = Object.entries(arg)[0] as [string, any];
    expect(registered.meta.tags).toContain('input');
    expect(registered.meta.tags).toContain('login');
  });

  it('whitelist primitive with already-explicit "input" tag — does NOT duplicate', () => {
    const ctx = mkCtx() as any;
    const Wrapped = wrapComponent(ctx, {}, StubInput, 'Input');
    cleanup = render(() => <Wrapped meta={{ tags: ['login', 'input'] }} />, container);
    const arg = ctx.store.registerComponent.mock.calls[0][0];
    const [, registered] = Object.entries(arg)[0] as [string, any];
    const inputOccurrences = registered.meta.tags.filter((t: string) => t === 'input').length;
    expect(inputOccurrences).toBe(1);
  });

  it('non-whitelist primitive (Card) — no auto-tag added', () => {
    const StubCard = (props: any) => (
      <div data-testid="card" {...props}>
        {props.children}
      </div>
    );
    const ctx = mkCtx() as any;
    // componentName='Card' is not in KIND_TAGS
    const Wrapped = wrapComponent(ctx, {}, StubCard, 'Card');
    cleanup = render(() => <Wrapped meta={{ tags: ['profile'] }} />, container);
    const arg = ctx.store.registerComponent.mock.calls[0][0];
    const [, registered] = Object.entries(arg)[0] as [string, any];
    expect(registered.meta.tags).toEqual(['profile']);
  });

  it('deriveName for Input with tags=["login"] returns "login" (user-tags first)', () => {
    const ctx = mkCtx() as any;
    const Wrapped = wrapComponent(ctx, {}, StubInput, 'Input');
    cleanup = render(() => <Wrapped meta={{ tags: ['login'] }} />, container);
    const arg = ctx.store.registerComponent.mock.calls[0][0];
    const [, registered] = Object.entries(arg)[0] as [string, any];
    // deriveName picks the first non-@-prefixed tag — 'login' comes before 'input'
    expect(registered.name).toBe('login');
  });

  it('Button component auto-injects "button" kind-tag', () => {
    const ctx = mkCtx() as any;
    const Wrapped = wrapComponent(ctx, {}, StubButton, 'Button');
    cleanup = render(() => <Wrapped meta={{ tags: ['submit'] }}>Go</Wrapped>, container);
    const arg = ctx.store.registerComponent.mock.calls[0][0];
    const [, registered] = Object.entries(arg)[0] as [string, any];
    expect(registered.meta.tags).toContain('button');
    expect(registered.meta.tags).toContain('submit');
  });

  it('controller.onClick receives effectiveMeta with kind-tag injected', () => {
    const ctx = mkCtx() as any;
    const Wrapped = wrapComponent(ctx, {}, StubButton, 'Button');
    cleanup = render(() => <Wrapped meta={{ tags: ['submit'] }}>Go</Wrapped>, container);
    const btn = container.querySelector('[data-testid="btn"]') as HTMLButtonElement;
    btn.click();
    expect(ctx.controller.onClick).toHaveBeenCalledOnce();
    const [target] = ctx.controller.onClick.mock.calls[0];
    expect(target.meta.tags).toContain('button');
  });

  it('sub-component access (Card.Header) — NO kind-tag injected', () => {
    const Header = (p: any) => (
      <header data-testid="hdr" {...p}>
        {p.children}
      </header>
    );
    const StubCard = Object.assign((p: any) => <div {...p}>{p.children}</div>, { Header });
    const ctx = mkCtx() as any;
    // UiProxy would pass 'Card' as componentName; sub-component is accessed via Proxy.get
    const WrappedCard = wrapComponent(ctx, {}, StubCard, 'Card');
    const WrappedHeader = (WrappedCard as any).Header;

    cleanup = render(
      () => <WrappedHeader meta={{ tags: ['profile-header'] }}>Title</WrappedHeader>,
      container,
    );
    const arg = ctx.store.registerComponent.mock.calls[0][0];
    const [, registered] = Object.entries(arg)[0] as [string, any];
    // 'Card' is not in KIND_TAGS and Header access doesn't propagate componentName
    expect(registered.meta.tags).toEqual(['profile-header']);
  });
});

describe('wrapComponent — safeCall error handling', () => {
  it('sync throw in user handler does NOT propagate', () => {
    const ctx = mkCtx() as any;
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const Wrapped = wrapComponent(ctx, {}, StubButton);
    cleanup = render(
      () => (
        <Wrapped
          meta={{ tags: ['submit'] }}
          onClick={() => {
            throw new Error('boom');
          }}
        >
          Go
        </Wrapped>
      ),
      container,
    );
    const btn = container.querySelector('[data-testid="btn"]') as HTMLButtonElement;
    expect(() => btn.click()).not.toThrow();
    expect(errSpy).toHaveBeenCalled();
  });
});

describe('wrapComponent — onDblClick', () => {
  it('dblclick on meta element invokes ctx.controller.onDblClick with correct target', () => {
    const ctx = mkCtx() as any;
    const Wrapped = wrapComponent(ctx, {}, StubButton);
    cleanup = render(() => <Wrapped meta={{ tags: ['row'] }}>Item</Wrapped>, container);
    const btn = container.querySelector('[data-testid="btn"]') as HTMLButtonElement;
    btn.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    expect(ctx.controller.onDblClick).toHaveBeenCalledOnce();
    const [target, context] = ctx.controller.onDblClick.mock.calls[0];
    expect(target.name).toBe('row');
    expect(context).toEqual({ foo: 'bar' });
  });

  it('dblclick: updateStore=false → store.updateComponent NOT called', () => {
    const ctx = mkCtx() as any;
    const Wrapped = wrapComponent(ctx, {}, StubButton);
    cleanup = render(() => <Wrapped meta={{ tags: ['row'] }}>Item</Wrapped>, container);
    const btn = container.querySelector('[data-testid="btn"]') as HTMLButtonElement;
    btn.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    expect(ctx.controller.onDblClick).toHaveBeenCalledOnce();
    expect(ctx.store.updateComponent).not.toHaveBeenCalled();
    expect(ctx.store.update).not.toHaveBeenCalled();
  });

  it('dblclick on element WITHOUT meta does NOT invoke ctx.controller.onDblClick', () => {
    const ctx = mkCtx() as any;
    const Wrapped = wrapComponent(ctx, {}, StubButton);
    cleanup = render(() => <Wrapped>Item</Wrapped>, container);
    const btn = container.querySelector('[data-testid="btn"]') as HTMLButtonElement;
    btn.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    expect(ctx.controller.onDblClick).not.toHaveBeenCalled();
  });

  it('dblclick bubble dedup: nested wrappers dispatch onDblClick only once', () => {
    const ctx = mkCtx() as any;
    const Inner = (p: any) => (
      <span data-testid="inner" {...p}>
        {p.children}
      </span>
    );
    const Outer = (p: any) => (
      <div data-testid="outer" {...p}>
        {p.children}
      </div>
    );
    const WrappedInner = wrapComponent(ctx, {}, Inner);
    const WrappedOuter = wrapComponent(ctx, {}, Outer);

    cleanup = render(
      () => (
        <WrappedOuter meta={{ tags: ['outer'] }}>
          <WrappedInner meta={{ tags: ['inner'] }}>x</WrappedInner>
        </WrappedOuter>
      ),
      container,
    );

    const inner = container.querySelector('[data-testid="inner"]') as HTMLElement;
    inner.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));

    expect(ctx.controller.onDblClick).toHaveBeenCalledOnce();
  });

  it('also invokes props.onDblClick (user handler) after ctx.controller.onDblClick', () => {
    const ctx = mkCtx() as any;
    const userHandler = vi.fn();
    const Wrapped = wrapComponent(ctx, {}, StubButton);
    cleanup = render(
      () => (
        <Wrapped meta={{ tags: ['row'] }} onDblClick={userHandler}>
          Item
        </Wrapped>
      ),
      container,
    );
    const btn = container.querySelector('[data-testid="btn"]') as HTMLButtonElement;
    btn.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    expect(ctx.controller.onDblClick).toHaveBeenCalledOnce();
    expect(userHandler).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// Task 1: UiProxy used from Widget/Page context — meta-tagged element dispatches
// ---------------------------------------------------------------------------
//
// This mirrors the Widget fix: Widget now calls UiProxy(rawUi, ctx, wrapperProps)
// before passing Ui to the factory. We test UiProxy directly (without mounting
// WidgetWrapper) because WidgetWrapper requires the full Context tree (solid
// createContext + Provider). Correctness of the wiring is shown by the fact that
// UiProxy is now called in widget.tsx with the same arguments as in view.tsx.
//
// The critical contract being tested: a component obtained from
// `UiProxy(stubUi, ctx, {})[componentName]` with a meta prop → dispatches to
// ctx.controller.onClick. This is exactly what happens inside a Widget factory
// when `ctx` is present.

describe('UiProxy — Widget binding contract (meta-tagged element dispatches in Controller-tree)', () => {
  it('button obtained via UiProxy.get with meta dispatches onClick to controller', () => {
    const ctx = mkCtx() as any;
    // Simulate the Widget rawUi object that includes a button-like primitive
    const stubUi = { Button: StubButton };
    const proxied = UiProxy(stubUi, ctx, {});
    const WrappedButton = (proxied as any).Button;

    cleanup = render(
      () => <WrappedButton meta={{ tags: ['save'] }}>Save</WrappedButton>,
      container,
    );

    const btn = container.querySelector('[data-testid="btn"]') as HTMLButtonElement;
    btn.click();
    expect(ctx.controller.onClick).toHaveBeenCalledOnce();
    const [target] = ctx.controller.onClick.mock.calls[0];
    expect(target.name).toBe('save');
  });

  it('button obtained via UiProxy.get WITHOUT meta does NOT dispatch', () => {
    const ctx = mkCtx() as any;
    const stubUi = { Button: StubButton };
    const proxied = UiProxy(stubUi, ctx, {});
    const WrappedButton = (proxied as any).Button;

    cleanup = render(() => <WrappedButton>NoMeta</WrappedButton>, container);

    const btn = container.querySelector('[data-testid="btn"]') as HTMLButtonElement;
    btn.click();
    expect(ctx.controller.onClick).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Task 2: Ui.Flow namespace — raw pass-through, correct component references
// ---------------------------------------------------------------------------

describe('UiProxy — Flow namespace is returned raw (not wrapped)', () => {
  it('Flow key is returned verbatim — not a ComponentWrapper', () => {
    const ctx = mkCtx() as any;
    const flowNs = {
      For,
      Show,
      Switch: undefined,
      Match: undefined,
      Index: undefined,
      Dynamic: undefined,
    };
    const stubUi = { Flow: flowNs };
    const proxied = UiProxy(stubUi, ctx, {});

    // The Flow object itself must be the exact same reference — never wrapped
    expect((proxied as any).Flow).toBe(flowNs);
  });

  it('Flow.For is the same reference as solid-js For (not UiProxy-wrapped)', () => {
    const ctx = mkCtx() as any;
    const flowNs = { For, Show };
    const stubUi = { Flow: flowNs };
    const proxied = UiProxy(stubUi, ctx, {});

    expect((proxied as any).Flow.For).toBe(For);
  });

  it('Flow.Show is the same reference as solid-js Show', () => {
    const ctx = mkCtx() as any;
    const flowNs = { For, Show };
    const stubUi = { Flow: flowNs };
    const proxied = UiProxy(stubUi, ctx, {});

    expect((proxied as any).Flow.Show).toBe(Show);
  });

  it('Ui.Flow.For renders items reactively (correct Solid For semantics)', () => {
    const ctx = mkCtx() as any;
    const flowNs = { For };
    const stubUi = { Flow: flowNs };
    const proxied = UiProxy(stubUi, ctx, {});
    const FlowFor = (proxied as any).Flow.For;

    cleanup = render(
      () => (
        <ul>
          <FlowFor each={['a', 'b', 'c']}>
            {(item: string) => <li data-testid="item">{item}</li>}
          </FlowFor>
        </ul>
      ),
      container,
    );

    const items = container.querySelectorAll('[data-testid="item"]');
    expect(items).toHaveLength(3);
    expect(items[0].textContent).toBe('a');
    expect(items[1].textContent).toBe('b');
    expect(items[2].textContent).toBe('c');
  });

  it('Ui.Flow.Show renders children when condition is true', () => {
    const ctx = mkCtx() as any;
    const flowNs = { Show };
    const stubUi = { Flow: flowNs };
    const proxied = UiProxy(stubUi, ctx, {});
    const FlowShow = (proxied as any).Flow.Show;

    cleanup = render(
      () => (
        <FlowShow when={true} fallback={<span data-testid="fallback">hidden</span>}>
          <span data-testid="content">visible</span>
        </FlowShow>
      ),
      container,
    );

    expect(container.querySelector('[data-testid="content"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="fallback"]')).toBeNull();
  });

  it('Ui.Flow.Show renders fallback when condition is false', () => {
    const ctx = mkCtx() as any;
    const flowNs = { Show };
    const stubUi = { Flow: flowNs };
    const proxied = UiProxy(stubUi, ctx, {});
    const FlowShow = (proxied as any).Flow.Show;

    cleanup = render(
      () => (
        <FlowShow when={false} fallback={<span data-testid="fallback">hidden</span>}>
          <span data-testid="content">visible</span>
        </FlowShow>
      ),
      container,
    );

    expect(container.querySelector('[data-testid="fallback"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="content"]')).toBeNull();
  });

  it('Flow.For does NOT invoke ctx.store.registerComponent (not event-wrapped)', () => {
    const ctx = mkCtx() as any;
    const flowNs = { For };
    const stubUi = { Flow: flowNs };
    const proxied = UiProxy(stubUi, ctx, {});
    const FlowFor = (proxied as any).Flow.For;

    cleanup = render(
      () => <FlowFor each={[1, 2]}>{(n: number) => <span>{n}</span>}</FlowFor>,
      container,
    );

    expect(ctx.store.registerComponent).not.toHaveBeenCalled();
  });
});
