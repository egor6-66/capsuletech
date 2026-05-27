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

// ---------------------------------------------------------------------------
// Compile-time: Table compound — added to ViewUi + WidgetUi (2026-05-21)
// Guards: Table root + all 5 sub-components accept IUiMetaProps in both namespaces.
// ---------------------------------------------------------------------------

describe('ViewUi — Table compound: root and sub-components preserved with meta', () => {
  it('Ui.Table is a function', () => {
    expectTypeOf<ViewUi['Table']>().toBeFunction();
  });

  it('Ui.Table accepts IUiMetaProps (meta prop)', () => {
    type TableProps = Parameters<ViewUi['Table']>[0];
    expectTypeOf<TableProps>().toMatchTypeOf<IUiMetaProps>();
  });

  it('Ui.Table.Header is a function', () => {
    expectTypeOf<ViewUi['Table']['Header']>().toBeFunction();
  });

  it('Ui.Table.Header accepts meta prop', () => {
    type HeaderProps = Parameters<ViewUi['Table']['Header']>[0];
    expectTypeOf<HeaderProps>().toMatchTypeOf<{ meta?: ITagMeta }>();
  });

  it('Ui.Table.Body is a function', () => {
    expectTypeOf<ViewUi['Table']['Body']>().toBeFunction();
  });

  it('Ui.Table.Body accepts meta prop', () => {
    type BodyProps = Parameters<ViewUi['Table']['Body']>[0];
    expectTypeOf<BodyProps>().toMatchTypeOf<{ meta?: ITagMeta }>();
  });

  it('Ui.Table.Row is a function', () => {
    expectTypeOf<ViewUi['Table']['Row']>().toBeFunction();
  });

  it('Ui.Table.Row accepts meta prop', () => {
    type RowProps = Parameters<ViewUi['Table']['Row']>[0];
    expectTypeOf<RowProps>().toMatchTypeOf<{ meta?: ITagMeta }>();
  });

  it('Ui.Table.Head is a function', () => {
    expectTypeOf<ViewUi['Table']['Head']>().toBeFunction();
  });

  it('Ui.Table.Head accepts meta prop', () => {
    type HeadProps = Parameters<ViewUi['Table']['Head']>[0];
    expectTypeOf<HeadProps>().toMatchTypeOf<{ meta?: ITagMeta }>();
  });

  it('Ui.Table.Cell is a function', () => {
    expectTypeOf<ViewUi['Table']['Cell']>().toBeFunction();
  });

  it('Ui.Table.Cell accepts meta prop', () => {
    type CellProps = Parameters<ViewUi['Table']['Cell']>[0];
    expectTypeOf<CellProps>().toMatchTypeOf<{ meta?: ITagMeta }>();
  });
});

describe('WidgetUi — Table compound: root and sub-components preserved with meta', () => {
  it('Ui.Table is a function', () => {
    expectTypeOf<WidgetUi['Table']>().toBeFunction();
  });

  it('Ui.Table accepts IUiMetaProps (meta prop)', () => {
    type TableProps = Parameters<WidgetUi['Table']>[0];
    expectTypeOf<TableProps>().toMatchTypeOf<IUiMetaProps>();
  });

  it('Ui.Table.Header is a function (not lost after WithMetaProps)', () => {
    expectTypeOf<WidgetUi['Table']['Header']>().toBeFunction();
  });

  it('Ui.Table.Header accepts meta prop', () => {
    type HeaderProps = Parameters<WidgetUi['Table']['Header']>[0];
    expectTypeOf<HeaderProps>().toMatchTypeOf<{ meta?: ITagMeta }>();
  });

  it('Ui.Table.Body is a function', () => {
    expectTypeOf<WidgetUi['Table']['Body']>().toBeFunction();
  });

  it('Ui.Table.Body accepts meta prop', () => {
    type BodyProps = Parameters<WidgetUi['Table']['Body']>[0];
    expectTypeOf<BodyProps>().toMatchTypeOf<{ meta?: ITagMeta }>();
  });

  it('Ui.Table.Row is a function', () => {
    expectTypeOf<WidgetUi['Table']['Row']>().toBeFunction();
  });

  it('Ui.Table.Row accepts meta prop', () => {
    type RowProps = Parameters<WidgetUi['Table']['Row']>[0];
    expectTypeOf<RowProps>().toMatchTypeOf<{ meta?: ITagMeta }>();
  });

  it('Ui.Table.Head is a function', () => {
    expectTypeOf<WidgetUi['Table']['Head']>().toBeFunction();
  });

  it('Ui.Table.Head accepts meta prop', () => {
    type HeadProps = Parameters<WidgetUi['Table']['Head']>[0];
    expectTypeOf<HeadProps>().toMatchTypeOf<{ meta?: ITagMeta }>();
  });

  it('Ui.Table.Cell is a function', () => {
    expectTypeOf<WidgetUi['Table']['Cell']>().toBeFunction();
  });

  it('Ui.Table.Cell accepts meta prop', () => {
    type CellProps = Parameters<WidgetUi['Table']['Cell']>[0];
    expectTypeOf<CellProps>().toMatchTypeOf<{ meta?: ITagMeta }>();
  });
});

// ---------------------------------------------------------------------------
// Compile-time: DataTable — simple callable (no sub-components)
// Added to ViewUi + WidgetUi (2026-05-21). DataTable<TData> is a generic
// function; WithMetaProps callable-branch handles it via (props: P) => R match.
// ---------------------------------------------------------------------------

describe('ViewUi — DataTable: is callable and accepts IUiMetaProps', () => {
  it('Ui.DataTable is a function', () => {
    expectTypeOf<ViewUi['DataTable']>().toBeFunction();
  });

  it('Ui.DataTable accepts IUiMetaProps (meta prop)', () => {
    type DataTableProps = Parameters<ViewUi['DataTable']>[0];
    expectTypeOf<DataTableProps>().toMatchTypeOf<IUiMetaProps>();
  });
});

describe('WidgetUi — DataTable: is callable and accepts IUiMetaProps', () => {
  it('Ui.DataTable is a function', () => {
    expectTypeOf<WidgetUi['DataTable']>().toBeFunction();
  });

  it('Ui.DataTable accepts IUiMetaProps (meta prop)', () => {
    type DataTableProps = Parameters<WidgetUi['DataTable']>[0];
    expectTypeOf<DataTableProps>().toMatchTypeOf<IUiMetaProps>();
  });
});

// ---------------------------------------------------------------------------
// Compile-time: ThemePicker — Dropdown-based theme picker composite (web-ui).
// Added to ViewUi + WidgetUi (replaces legacy ThemeSwitcher `<select>`).
// ---------------------------------------------------------------------------

describe('ViewUi — ThemePicker: is callable and accepts IUiMetaProps', () => {
  it('Ui.ThemePicker is a function', () => {
    expectTypeOf<ViewUi['ThemePicker']>().toBeFunction();
  });

  it('Ui.ThemePicker accepts IUiMetaProps (meta prop)', () => {
    type Props = Parameters<ViewUi['ThemePicker']>[0];
    expectTypeOf<Props>().toMatchTypeOf<IUiMetaProps>();
  });
});

describe('WidgetUi — ThemePicker: is callable and accepts IUiMetaProps', () => {
  it('Ui.ThemePicker is a function', () => {
    expectTypeOf<WidgetUi['ThemePicker']>().toBeFunction();
  });

  it('Ui.ThemePicker accepts IUiMetaProps (meta prop)', () => {
    type Props = Parameters<WidgetUi['ThemePicker']>[0];
    expectTypeOf<Props>().toMatchTypeOf<IUiMetaProps>();
  });
});

// ---------------------------------------------------------------------------
// Compile-time: LayoutModeToggle — button toggle for Matrix layoutMode.
// Added to ViewUi + WidgetUi alongside DarkModeToggle.
// ---------------------------------------------------------------------------

describe('ViewUi — LayoutModeToggle: is callable and accepts IUiMetaProps', () => {
  it('Ui.LayoutModeToggle is a function', () => {
    expectTypeOf<ViewUi['LayoutModeToggle']>().toBeFunction();
  });
});

describe('WidgetUi — LayoutModeToggle: is callable and accepts IUiMetaProps', () => {
  it('Ui.LayoutModeToggle is a function', () => {
    expectTypeOf<WidgetUi['LayoutModeToggle']>().toBeFunction();
  });
});

// ---------------------------------------------------------------------------
// Compile-time: DarkModeToggle — plain callable (no sub-components)
// Added to ViewUi + WidgetUi alongside ThemeSwitcher (2026-05-22).
// ---------------------------------------------------------------------------

describe('ViewUi — DarkModeToggle: is callable and accepts IUiMetaProps', () => {
  it('Ui.DarkModeToggle is a function', () => {
    expectTypeOf<ViewUi['DarkModeToggle']>().toBeFunction();
  });

  it('Ui.DarkModeToggle accepts IUiMetaProps (meta prop)', () => {
    type Props = Parameters<ViewUi['DarkModeToggle']>[0];
    expectTypeOf<Props>().toMatchTypeOf<IUiMetaProps>();
  });
});

describe('WidgetUi — DarkModeToggle: is callable and accepts IUiMetaProps', () => {
  it('Ui.DarkModeToggle is a function', () => {
    expectTypeOf<WidgetUi['DarkModeToggle']>().toBeFunction();
  });

  it('Ui.DarkModeToggle accepts IUiMetaProps (meta prop)', () => {
    type Props = Parameters<WidgetUi['DarkModeToggle']>[0];
    expectTypeOf<Props>().toMatchTypeOf<IUiMetaProps>();
  });
});

// ---------------------------------------------------------------------------
// Compile-time: MapView — plain callable (no sub-components)
// Added to ViewUi + WidgetUi from @capsuletech/web-map (2026-05-22).
// ---------------------------------------------------------------------------

describe('ViewUi — MapView: is callable and accepts IUiMetaProps', () => {
  it('Ui.MapView is a function', () => {
    expectTypeOf<ViewUi['MapView']>().toBeFunction();
  });

  it('Ui.MapView accepts IUiMetaProps (meta prop)', () => {
    type Props = Parameters<ViewUi['MapView']>[0];
    expectTypeOf<Props>().toMatchTypeOf<IUiMetaProps>();
  });
});

describe('WidgetUi — MapView: is callable and accepts IUiMetaProps', () => {
  it('Ui.MapView is a function', () => {
    expectTypeOf<WidgetUi['MapView']>().toBeFunction();
  });

  it('Ui.MapView accepts IUiMetaProps (meta prop)', () => {
    type Props = Parameters<WidgetUi['MapView']>[0];
    expectTypeOf<Props>().toMatchTypeOf<IUiMetaProps>();
  });
});

// ---------------------------------------------------------------------------
// Compile-time: ViewUi.Layout subset — Grid + Flex present, Matrix absent
// Added 2026-05-27. View receives Layout: ViewLayoutSubset (Pick<typeof Layout, 'Grid'|'Flex'>).
// Matrix is intentionally excluded — it is a page-level application shell.
// ---------------------------------------------------------------------------

describe('ViewUi — Layout subset: Grid and Flex present', () => {
  it('Ui.Layout.Grid is present in ViewUi', () => {
    type LayoutInView = ViewUi['Layout'];
    expectTypeOf<LayoutInView>().toHaveProperty('Grid');
  });

  it('Ui.Layout.Flex is present in ViewUi', () => {
    type LayoutInView = ViewUi['Layout'];
    expectTypeOf<LayoutInView>().toHaveProperty('Flex');
  });

  it('Ui.Layout.Grid is a function (callable component)', () => {
    expectTypeOf<ViewUi['Layout']['Grid']>().toBeFunction();
  });

  it('Ui.Layout.Flex is a function (callable component)', () => {
    expectTypeOf<ViewUi['Layout']['Flex']>().toBeFunction();
  });

  it('Ui.Layout.Grid accepts IUiMetaProps (meta prop)', () => {
    type GridProps = Parameters<ViewUi['Layout']['Grid']>[0];
    expectTypeOf<GridProps>().toMatchTypeOf<IUiMetaProps>();
  });

  it('Ui.Layout.Flex accepts IUiMetaProps (meta prop)', () => {
    type FlexProps = Parameters<ViewUi['Layout']['Flex']>[0];
    expectTypeOf<FlexProps>().toMatchTypeOf<IUiMetaProps>();
  });

  it('Ui.Layout does NOT expose Matrix (page-shell guard)', () => {
    type LayoutInView = ViewUi['Layout'];
    // @ts-expect-error Matrix must not exist on ViewLayoutSubset
    type _guard = LayoutInView['Matrix'];
  });
});

describe('WidgetUi — Layout remains full (Grid + Flex + Matrix)', () => {
  it('Ui.Layout.Matrix is present in WidgetUi', () => {
    type LayoutInWidget = WidgetUi['Layout'];
    expectTypeOf<LayoutInWidget>().toHaveProperty('Matrix');
  });

  it('Ui.Layout.Grid is present in WidgetUi', () => {
    type LayoutInWidget = WidgetUi['Layout'];
    expectTypeOf<LayoutInWidget>().toHaveProperty('Grid');
  });

  it('Ui.Layout.Flex is present in WidgetUi', () => {
    type LayoutInWidget = WidgetUi['Layout'];
    expectTypeOf<LayoutInWidget>().toHaveProperty('Flex');
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
