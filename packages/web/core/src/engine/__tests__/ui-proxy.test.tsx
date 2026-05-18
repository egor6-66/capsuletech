/* @vitest-environment jsdom */
import { render } from 'solid-js/web';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { wrapComponent } from '../ui-proxy';

// UiProxy render-path тесты. Тестим `wrapComponent` напрямую (вынесен из
// внутренних closures именно ради этого), чтобы не поднимать lazy ui-kit
// граф через Suspense. Контракт: один и тот же `wrap`, что используется
// UiProxy через Proxy.get.

const mkCtx = (overrides: Partial<any> = {}) => {
  const controller: Record<string, ReturnType<typeof vi.fn>> = {
    onClick: vi.fn(),
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

  it('input event: updateStore=true → store.update called', () => {
    const ctx = mkCtx() as any;
    const Wrapped = wrapComponent(ctx, {}, StubInput);
    cleanup = render(
      () => <Wrapped meta={{ tags: ['email'] }} />,
      container,
    );
    const inp = container.querySelector('[data-testid="inp"]') as HTMLInputElement;
    inp.value = 'foo@bar';
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    expect(ctx.store.update).toHaveBeenCalledOnce();
    expect(ctx.controller.onInput).toHaveBeenCalledOnce();
  });

  it('click event: updateStore=false → store.update NOT called', () => {
    const ctx = mkCtx() as any;
    const Wrapped = wrapComponent(ctx, {}, StubButton);
    cleanup = render(
      () => <Wrapped meta={{ tags: ['submit'] }}>Go</Wrapped>,
      container,
    );
    const btn = container.querySelector('[data-testid="btn"]') as HTMLButtonElement;
    btn.click();
    expect(ctx.controller.onClick).toHaveBeenCalledOnce();
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
    const Label = (p: any) => <label {...p}>{p.children}</label>;
    const Field = Object.assign(
      (p: any) => <fieldset {...p}>{p.children}</fieldset>,
      { Label },
    );
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
