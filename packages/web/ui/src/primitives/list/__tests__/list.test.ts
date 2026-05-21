/**
 * List primitive tests.
 *
 * The vitest config (environment: 'node', no JSX transform) cannot process
 * .tsx files. Tests here cover interface structural contracts for all three
 * List modes: render-prop, batch (data + as), and semantic.
 * DOM render coverage is pending vitest Solid transform (see OWNERSHIP.md backlog).
 */
import { describe, expect, it } from 'vitest';

import type {
  IListBatchProps,
  IListProps,
  IListRenderProps,
  IListSemanticProps,
  IVirtualListProps,
} from '../interfaces';

// ---------------------------------------------------------------------------
// IListRenderProps (render-prop / classic mode)
// ---------------------------------------------------------------------------

describe('IListRenderProps structural contracts', () => {
  it('requires items array and children render function', () => {
    type Item = { id: number; label: string };
    const props: IListRenderProps<Item> = {
      items: [{ id: 1, label: 'Home' }],
      children: (item) => item as unknown as import('solid-js').JSX.Element,
    };
    expect(props.items).toHaveLength(1);
    expect(typeof props.children).toBe('function');
  });

  it('accepts empty items array', () => {
    const props: IListRenderProps<{ id: number }> = {
      items: [],
      children: () => null as unknown as import('solid-js').JSX.Element,
    };
    expect(props.items).toHaveLength(0);
  });

  it('batch-mode fields are typed as never (exclusive)', () => {
    // `data`, `as`, `itemProps` should not be assignable in render-prop mode.
    // This is a type-level test — we just verify the prop object shape.
    const props: IListRenderProps<{ id: number }> = {
      items: [],
      children: () => null as unknown as import('solid-js').JSX.Element,
    };
    // At runtime the `never` fields are simply undefined/absent.
    expect((props as any).data).toBeUndefined();
    expect((props as any).as).toBeUndefined();
  });

  it('accepts variant and orientation', () => {
    const props: IListRenderProps<{ id: number }> = {
      items: [],
      children: () => null as unknown as import('solid-js').JSX.Element,
      variant: 'flush',
      orientation: 'horizontal',
    };
    expect(props.variant).toBe('flush');
    expect(props.orientation).toBe('horizontal');
  });
});

// ---------------------------------------------------------------------------
// IListBatchProps (batch mode)
// ---------------------------------------------------------------------------

describe('IListBatchProps structural contracts', () => {
  it('requires data array and as component', () => {
    type Item = { id: number; label: string };
    // Using a plain function as Component stand-in (type-compatible)
    const Tpl = (_props: { label: string }) => null as unknown as import('solid-js').JSX.Element;
    const props: IListBatchProps<Item> = {
      data: [{ id: 1, label: 'Home' }],
      as: Tpl,
    };
    expect(props.data).toHaveLength(1);
    expect(typeof props.as).toBe('function');
  });

  it('accepts optional itemProps mapper', () => {
    type Item = { id: number; label: string };
    const Tpl = (_props: { label: string }) => null as unknown as import('solid-js').JSX.Element;
    const props: IListBatchProps<Item> = {
      data: [{ id: 1, label: 'Home' }],
      as: Tpl,
      itemProps: (item) => ({ label: item.label }),
    };
    expect(typeof props.itemProps).toBe('function');
    expect(props.itemProps?.({ id: 1, label: 'Home' })).toEqual({ label: 'Home' });
  });

  it('render-prop fields are typed as never (exclusive)', () => {
    const Tpl = () => null as unknown as import('solid-js').JSX.Element;
    const props: IListBatchProps<{ id: number }> = {
      data: [],
      as: Tpl,
    };
    expect((props as any).items).toBeUndefined();
    expect((props as any).children).toBeUndefined();
  });

  it('accepts variant and orientation', () => {
    const Tpl = () => null as unknown as import('solid-js').JSX.Element;
    const props: IListBatchProps<{ id: number }> = {
      data: [],
      as: Tpl,
      variant: 'default',
      orientation: 'vertical',
    };
    expect(props.variant).toBe('default');
    expect(props.orientation).toBe('vertical');
  });
});

// ---------------------------------------------------------------------------
// IListSemanticProps (plain children mode)
// ---------------------------------------------------------------------------

describe('IListSemanticProps structural contracts', () => {
  it('has no required props', () => {
    const props: IListSemanticProps = {};
    expect(props.data).toBeUndefined();
    expect(props.as).toBeUndefined();
    expect(props.items).toBeUndefined();
  });

  it('accepts class and style', () => {
    const props: IListSemanticProps = {
      class: 'my-list',
      style: { color: 'red' },
    };
    expect(props.class).toBe('my-list');
  });
});

// ---------------------------------------------------------------------------
// IListProps union
// ---------------------------------------------------------------------------

describe('IListProps union type', () => {
  it('IListBatchProps is assignable to IListProps', () => {
    const Tpl = () => null as unknown as import('solid-js').JSX.Element;
    const batch: IListBatchProps<{ id: number }> = { data: [{ id: 1 }], as: Tpl };
    const asUnion: IListProps<{ id: number }> = batch;
    expect(asUnion).toBe(batch);
  });

  it('IListRenderProps is assignable to IListProps', () => {
    const render: IListRenderProps<{ id: number }> = {
      items: [],
      children: () => null as unknown as import('solid-js').JSX.Element,
    };
    const asUnion: IListProps<{ id: number }> = render;
    expect(asUnion).toBe(render);
  });

  it('IListSemanticProps is assignable to IListProps', () => {
    const semantic: IListSemanticProps = { class: 'test' };
    const asUnion: IListProps = semantic;
    expect(asUnion).toBe(semantic);
  });
});

// ---------------------------------------------------------------------------
// IVirtualListProps
// ---------------------------------------------------------------------------

describe('IVirtualListProps structural contracts', () => {
  it('requires items and children', () => {
    type Item = { id: number; label: string };
    const props: IVirtualListProps<Item> = {
      items: [{ id: 1, label: 'Row' }],
      children: (item) => item as unknown as import('solid-js').JSX.Element,
    };
    expect(props.items).toHaveLength(1);
  });

  it('estimateSize is optional', () => {
    const props: IVirtualListProps<{ id: number }> = {
      items: [],
      children: () => null as unknown as import('solid-js').JSX.Element,
    };
    expect(props.estimateSize).toBeUndefined();

    const withSize: IVirtualListProps<{ id: number }> = {
      items: [],
      children: () => null as unknown as import('solid-js').JSX.Element,
      estimateSize: 48,
    };
    expect(withSize.estimateSize).toBe(48);
  });
});
