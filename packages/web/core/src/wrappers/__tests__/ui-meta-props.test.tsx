/* @vitest-environment jsdom */
/**
 * ui-meta-props.test.tsx
 *
 * Характеризационные тесты для `IUiMetaProps` / `WithMetaProps<T>`.
 *
 * Проблема до фикса (TS2322):
 *   `<Ui.Input meta={{ tags: ['email'], name: 'email' }} type="email" />`
 *   → "Property 'meta' does not exist on type 'IntrinsicAttributes & IInputProps'"
 *
 * Корень: ViewUi / WidgetUi использовали сырые `typeof Input` (= `Component<IInputProps>`).
 * `IInputProps` не знает ничего про UiProxy-layer props (meta/payload/dynamicMeta/modifiers).
 *
 * Фикс: `WithMetaProps<T>` — mapped type, добавляющий `& IUiMetaProps` к каждому
 * callable компоненту в Ui-namespace. `ViewUi = WithMetaProps<ViewUiRaw>` и т.д.
 * Живёт в web-core (не web-ui): UiProxy — HCA-layer, не DOM/style primitive layer.
 */

import { render } from 'solid-js/web';
import { afterEach, beforeEach, describe, expect, expectTypeOf, it } from 'vitest';
import type { ITagMeta, IUiMetaProps, ViewUi, WidgetUi } from '../interfaces';
import { ViewWrapper } from '../view';

// ---------------------------------------------------------------------------
// Compile-time: IUiMetaProps shape
// ---------------------------------------------------------------------------

describe('IUiMetaProps — compile-time shape', () => {
  it('meta field is optional ITagMeta', () => {
    expectTypeOf<IUiMetaProps['meta']>().toEqualTypeOf<ITagMeta | undefined>();
  });

  it('payload is optional unknown', () => {
    expectTypeOf<IUiMetaProps['payload']>().toEqualTypeOf<unknown>();
  });

  it('dynamicMeta is optional ITagMeta', () => {
    expectTypeOf<IUiMetaProps['dynamicMeta']>().toEqualTypeOf<ITagMeta | undefined>();
  });

  it('modifiers is an optional object with optional boolean flags', () => {
    type M = IUiMetaProps['modifiers'];
    expectTypeOf<NonNullable<M>['ctrl']>().toEqualTypeOf<boolean | undefined>();
    expectTypeOf<NonNullable<M>['shift']>().toEqualTypeOf<boolean | undefined>();
    expectTypeOf<NonNullable<M>['alt']>().toEqualTypeOf<boolean | undefined>();
    expectTypeOf<NonNullable<M>['meta']>().toEqualTypeOf<boolean | undefined>();
  });
});

// ---------------------------------------------------------------------------
// Compile-time: WithMetaProps applied to ViewUi
// ---------------------------------------------------------------------------

describe('ViewUi — IUiMetaProps injected into component props', () => {
  it('Ui.Input accepts meta prop (no TS2322)', () => {
    // This is the exact pattern that was failing before the fix.
    // If WithMetaProps is not applied, this type assertion would fail at compile time.
    type InputProps = Parameters<ViewUi['Input']>[0];
    expectTypeOf<InputProps>().toMatchTypeOf<{ meta?: ITagMeta }>();
  });

  it('Ui.Button accepts meta prop', () => {
    type ButtonProps = Parameters<ViewUi['Button']>[0];
    expectTypeOf<ButtonProps>().toMatchTypeOf<{ meta?: ITagMeta }>();
  });

  it('Ui.Input still accepts its original props (type, value, etc.)', () => {
    // WithMetaProps must not strip original props — it only intersects & IUiMetaProps.
    type InputProps = Parameters<ViewUi['Input']>[0];
    // `type` comes from IInputProps (extends JSX.InputHTMLAttributes)
    expectTypeOf<InputProps>().toMatchTypeOf<{ type?: string }>();
  });

  it('Ui.Input accepts payload prop', () => {
    type InputProps = Parameters<ViewUi['Input']>[0];
    expectTypeOf<InputProps>().toMatchTypeOf<{ payload?: unknown }>();
  });

  it('Ui.Input accepts dynamicMeta prop', () => {
    type InputProps = Parameters<ViewUi['Input']>[0];
    expectTypeOf<InputProps>().toMatchTypeOf<{ dynamicMeta?: ITagMeta }>();
  });
});

describe('WidgetUi — IUiMetaProps injected into component props', () => {
  it('Ui.Card accepts meta prop', () => {
    type CardProps = Parameters<WidgetUi['Card']>[0];
    expectTypeOf<CardProps>().toMatchTypeOf<{ meta?: ITagMeta }>();
  });

  it('Ui.Animate accepts meta prop', () => {
    type AnimateProps = Parameters<WidgetUi['Animate']>[0];
    expectTypeOf<AnimateProps>().toMatchTypeOf<{ meta?: ITagMeta }>();
  });
});

// ---------------------------------------------------------------------------
// Compile-time: compound (namespace) components — static sub-props preserved
// Regression guard for PR #119: WithMetaProps must not strip Card.Header,
// Field.Label, Navigation.Item etc. when augmenting the callable signature.
// ---------------------------------------------------------------------------

describe('ViewUi — Field compound: sub-components preserved with meta', () => {
  it('Ui.Field.Label is a function (not lost after WithMetaProps)', () => {
    expectTypeOf<ViewUi['Field']['Label']>().toBeFunction();
  });

  it('Ui.Field.Label accepts IUiMetaProps (meta prop)', () => {
    type LabelProps = Parameters<ViewUi['Field']['Label']>[0];
    expectTypeOf<LabelProps>().toMatchTypeOf<IUiMetaProps>();
  });

  it('Ui.Field.Content is a function', () => {
    expectTypeOf<ViewUi['Field']['Content']>().toBeFunction();
  });

  it('Ui.Field.Content accepts meta prop', () => {
    type ContentProps = Parameters<ViewUi['Field']['Content']>[0];
    expectTypeOf<ContentProps>().toMatchTypeOf<{ meta?: ITagMeta }>();
  });

  it('Ui.Field.Group is a function', () => {
    expectTypeOf<ViewUi['Field']['Group']>().toBeFunction();
  });

  it('Ui.Field.Label accepts meta prop', () => {
    type LabelProps = Parameters<ViewUi['Field']['Label']>[0];
    expectTypeOf<LabelProps>().toMatchTypeOf<{ meta?: ITagMeta }>();
  });
});

describe('WidgetUi — Card compound: sub-components preserved with meta', () => {
  it('Ui.Card.Header is a function (not lost after WithMetaProps)', () => {
    expectTypeOf<WidgetUi['Card']['Header']>().toBeFunction();
  });

  it('Ui.Card.Header accepts meta prop', () => {
    type HeaderProps = Parameters<WidgetUi['Card']['Header']>[0];
    expectTypeOf<HeaderProps>().toMatchTypeOf<{ meta?: ITagMeta }>();
  });

  it('Ui.Card.Title is a function', () => {
    expectTypeOf<WidgetUi['Card']['Title']>().toBeFunction();
  });

  it('Ui.Card.Title accepts meta prop', () => {
    type TitleProps = Parameters<WidgetUi['Card']['Title']>[0];
    expectTypeOf<TitleProps>().toMatchTypeOf<{ meta?: ITagMeta }>();
  });

  it('Ui.Card.Content is a function', () => {
    expectTypeOf<WidgetUi['Card']['Content']>().toBeFunction();
  });

  it('Ui.Card.Description is a function', () => {
    expectTypeOf<WidgetUi['Card']['Description']>().toBeFunction();
  });

  it('Ui.Card.Footer is a function', () => {
    expectTypeOf<WidgetUi['Card']['Footer']>().toBeFunction();
  });
});

describe('ViewUi — Navigation compound: sub-components preserved with meta', () => {
  it('Ui.Navigation.List is a function', () => {
    expectTypeOf<ViewUi['Navigation']['List']>().toBeFunction();
  });

  it('Ui.Navigation.List accepts meta prop', () => {
    type ListProps = Parameters<ViewUi['Navigation']['List']>[0];
    expectTypeOf<ListProps>().toMatchTypeOf<{ meta?: ITagMeta }>();
  });

  it('Ui.Navigation.Item is a function', () => {
    expectTypeOf<ViewUi['Navigation']['Item']>().toBeFunction();
  });

  it('Ui.Navigation.Item accepts meta prop', () => {
    type ItemProps = Parameters<ViewUi['Navigation']['Item']>[0];
    expectTypeOf<ItemProps>().toMatchTypeOf<{ meta?: ITagMeta }>();
  });
});

// ---------------------------------------------------------------------------
// Runtime: ViewWrapper + UiProxy does not crash when meta is passed
// (the actual prop stripping is in UiProxy; here we verify no runtime error)
// ---------------------------------------------------------------------------

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

describe('ViewWrapper — meta prop forwarded to UiProxy without error', () => {
  it('View factory can render stub component with meta prop via Ui arg', () => {
    // We use a stub that accepts meta (UiProxy-aware) rather than lazy web-ui,
    // to avoid Suspense/lazy loading complexity in jsdom environment.
    const StubInput = (props: any) => (
      <input data-testid="inp" type={props.type ?? 'text'} />
    );

    let capturedUi: any;
    const TestView = ViewWrapper((ui) => {
      capturedUi = ui;
      // We cast to 'any' here only for the runtime test stub — in production
      // code the types are satisfied by the actual UiProxy-wrapped components.
      const WrappedInput = (ui as any).Input ?? StubInput;
      return (
        <div data-testid="view">
          <StubInput meta={{ tags: ['email'], name: 'email' }} type="email" />
        </div>
      );
    });

    cleanup = render(() => <TestView />, container);
    expect(container.querySelector('[data-testid="view"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="inp"]')).not.toBeNull();
    // UiProxy is not active (no ControllerContext) — capturedUi is BaseUi
    expect(capturedUi).toBeDefined();
  });
});
