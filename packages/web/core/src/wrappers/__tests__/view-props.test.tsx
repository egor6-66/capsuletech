/* @vitest-environment jsdom */
/**
 * view-props.test.tsx
 *
 * Характеризационные тесты для упрощённой сигнатуры `View((Ui, props) => JSX)`.
 *
 * Контракт (после wrapper-simplify):
 *  - factory `(Ui)` без props — backward-compat: лишний arg JS просто игнорирует.
 *  - factory `(Ui, props)` — получает wrapperProps, переданные при рендере.
 *  - factory `<P>((Ui, props: P) => ...)` — типизированные props инферируются.
 *  - `<DerivedView label="x" />` → `props.label === 'x'` внутри factory.
 *  - `<Dynamic component={DerivedView} label="x" />` — аналогично (Shape `as`-паттерн).
 *  - props реактивны: изменение сигнала в родителе протекает в factory.
 */

import { createSignal } from 'solid-js';
import { Dynamic, render } from 'solid-js/web';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ViewWrapper } from '../view';

let container: HTMLDivElement;
let cleanup: () => void;
let savedWarn: typeof console.warn;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  savedWarn = console.warn;
  console.warn = () => {};
});

afterEach(() => {
  cleanup?.();
  document.body.removeChild(container);
  console.warn = savedWarn;
});

// ---------------------------------------------------------------------------
// Backward-compat: factory без 2-го аргумента
// ---------------------------------------------------------------------------

describe('ViewWrapper — backward-compat (factory без props)', () => {
  it('renders JSX returned from factory', () => {
    const Simple = ViewWrapper(() => <div data-testid="simple">hello</div>);
    cleanup = render(() => <Simple />, container);
    expect(container.querySelector('[data-testid="simple"]')?.textContent).toBe('hello');
  });

  it('receives extra props at render site without runtime error', () => {
    // factory без 2-го arg — JS просто передаёт лишний props, функция не смотрит
    const Simple = ViewWrapper(() => <div data-testid="compat">ok</div>) as any;
    cleanup = render(() => <Simple data-extra="x" />, container);
    expect(container.querySelector('[data-testid="compat"]')).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Новый контракт: factory с 2-м аргументом получает props с render-сайта
// ---------------------------------------------------------------------------

describe('ViewWrapper — props forwarding (factory с props)', () => {
  it('props.label приходит из JSX site', () => {
    let captured: unknown;
    const FieldTpl = ViewWrapper<{ label?: string }>((_ui, props) => {
      captured = props.label;
      return <div data-testid="field">{props.label}</div>;
    });

    cleanup = render(() => <FieldTpl label="Email" />, container);
    expect(captured).toBe('Email');
    expect(container.querySelector('[data-testid="field"]')?.textContent).toBe('Email');
  });

  it('multiple props forwarded correctly', () => {
    let capturedName: unknown;
    let capturedType: unknown;

    const FieldTpl = ViewWrapper<{ name?: string; type?: string }>((_ui, props) => {
      capturedName = props.name;
      capturedType = props.type;
      return <input data-testid="inp" name={props.name} type={props.type} />;
    });

    cleanup = render(() => <FieldTpl name="email" type="email" />, container);
    expect(capturedName).toBe('email');
    expect(capturedType).toBe('email');
    const inp = container.querySelector('[data-testid="inp"]') as HTMLInputElement;
    expect(inp.name).toBe('email');
    expect(inp.type).toBe('email');
  });

  it('props без явного типа (unknown) — factory работает без TS-ошибок', () => {
    let called = false;
    const Tpl = ViewWrapper((_ui, _props) => {
      called = true;
      return <span data-testid="ok">ok</span>;
    });
    cleanup = render(() => <Tpl />, container);
    expect(called).toBe(true);
  });

  it('Dynamic component pattern — Shape `as`-use-case', () => {
    // Воспроизводит: <Dynamic component={FieldTpl} label="Username" />
    // как Shape-wrapper вызывает template при `definition.as = Views.Forms.Field`
    let capturedLabel: unknown;

    const FieldTpl = ViewWrapper<{ label?: string }>((_ui, props) => {
      capturedLabel = props.label;
      return <div data-testid="dyn">{props.label}</div>;
    });

    cleanup = render(
      () => <Dynamic component={FieldTpl} label="Username" />,
      container,
    );
    expect(capturedLabel).toBe('Username');
    expect(container.querySelector('[data-testid="dyn"]')?.textContent).toBe('Username');
  });

  it('props update reactively when signal changes', () => {
    const [label, setLabel] = createSignal('Initial');

    const FieldTpl = ViewWrapper<{ label?: string }>((_ui, props) => (
      <div data-testid="reactive">{props.label}</div>
    ));

    cleanup = render(() => <FieldTpl label={label()} />, container);
    expect(container.querySelector('[data-testid="reactive"]')?.textContent).toBe('Initial');

    setLabel('Updated');
    expect(container.querySelector('[data-testid="reactive"]')?.textContent).toBe('Updated');
  });
});
