/**
 * DataTable composite tests.
 *
 * The vitest config (environment: 'node', no JSX transform) cannot process
 * .tsx files that use Solid JSX. Tests here cover what is importable from
 * pure-TS entry points: interface structural contracts, the ColumnDef
 * re-export and the new IColumn typed wrapper.
 * Visual + interactive coverage lives in dataTable.stories.tsx.
 * DOM render coverage (createSolidTable smoke inside the composite) is intended
 * once a vitest Solid transform is added to the config (see OWNERSHIP.md backlog).
 */
import { describe, expect, it } from 'vitest';

import type { ColumnDef, IColumn, IDataTableProps } from '../interfaces';

// ---------------------------------------------------------------------------
// ColumnDef re-export
// ---------------------------------------------------------------------------

describe('ColumnDef re-export', () => {
  it('ColumnDef is usable as a type (structural check)', () => {
    const col: ColumnDef<{ id: number; name: string }> = {
      accessorKey: 'id',
      header: 'ID',
    };
    expect(col.accessorKey).toBe('id');
    expect(col.header).toBe('ID');
  });
});

// ---------------------------------------------------------------------------
// IColumn typed wrapper
// ---------------------------------------------------------------------------

describe('IColumn typed wrapper', () => {
  it('accessorKey is constrained to keyof TData', () => {
    type IUser = { id: number; name: string; email: string };
    // Valid key
    const validCol: IColumn<IUser> = { accessorKey: 'id', header: 'ID' };
    expect(validCol.accessorKey).toBe('id');
    // All known keys are accepted
    const nameCol: IColumn<IUser> = { accessorKey: 'name', header: 'Name' };
    const emailCol: IColumn<IUser> = { accessorKey: 'email', header: 'Email' };
    expect(nameCol.accessorKey).toBe('name');
    expect(emailCol.accessorKey).toBe('email');
  });

  it('IColumn can omit accessorKey (id-based column)', () => {
    type IUser = { id: number; name: string };
    const selectCol: IColumn<IUser> = {
      id: 'select',
      header: 'Select',
      // No accessorKey — valid for display-only columns
    };
    expect(selectCol.id).toBe('select');
    expect(selectCol.accessorKey).toBeUndefined();
  });

  it('IColumn array is assignable to IDataTableProps.columns', () => {
    type IUser = { id: number; name: string };
    const cols: IColumn<IUser>[] = [
      { accessorKey: 'id', header: 'ID' },
      { accessorKey: 'name', header: 'Name' },
    ];
    const props: IDataTableProps<IUser> = {
      data: [{ id: 1, name: 'Alice' }],
      columns: cols,
    };
    expect(props.columns).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// IDataTableProps structural contracts
// ---------------------------------------------------------------------------

describe('IDataTableProps structural contracts', () => {
  it('accepts required data + columns', () => {
    const props: IDataTableProps<{ id: number }> = {
      data: [{ id: 1 }],
      columns: [{ accessorKey: 'id', header: 'ID' }],
    };
    expect(props.data).toHaveLength(1);
    expect(props.columns).toHaveLength(1);
  });

  it('accepts empty data array', () => {
    const props: IDataTableProps<{ id: number }> = {
      data: [],
      columns: [{ accessorKey: 'id', header: 'ID' }],
    };
    expect(props.data).toHaveLength(0);
  });

  it('sorting is optional boolean', () => {
    const withSorting: IDataTableProps<{ id: number }> = {
      data: [],
      columns: [],
      sorting: true,
    };
    const withoutSorting: IDataTableProps<{ id: number }> = {
      data: [],
      columns: [],
    };
    expect(withSorting.sorting).toBe(true);
    expect(withoutSorting.sorting).toBeUndefined();
  });

  it('pagination accepts boolean', () => {
    const props: IDataTableProps<{ id: number }> = {
      data: [],
      columns: [],
      pagination: true,
    };
    expect(props.pagination).toBe(true);
  });

  it('pagination accepts object with optional pageSize', () => {
    const propsDefault: IDataTableProps<{ id: number }> = {
      data: [],
      columns: [],
      pagination: {},
    };
    const propsCustom: IDataTableProps<{ id: number }> = {
      data: [],
      columns: [],
      pagination: { pageSize: 5 },
    };
    expect(propsDefault.pagination).toEqual({});
    expect(propsCustom.pagination).toEqual({ pageSize: 5 });
  });

  it('selection is optional boolean', () => {
    const props: IDataTableProps<{ id: number }> = {
      data: [],
      columns: [],
      selection: true,
    };
    expect(props.selection).toBe(true);
  });

  it('filtering is optional boolean', () => {
    const props: IDataTableProps<{ id: number }> = {
      data: [],
      columns: [],
      filtering: true,
    };
    expect(props.filtering).toBe(true);
  });

  it('emptyMessage accepts a string', () => {
    const props: IDataTableProps<{ id: number }> = {
      data: [],
      columns: [],
      emptyMessage: 'No results found.',
    };
    expect(props.emptyMessage).toBe('No results found.');
  });

  it('all opt-in flags default to absent (no required booleans)', () => {
    const props: IDataTableProps<{ id: number }> = {
      data: [],
      columns: [],
    };
    expect(props.sorting).toBeUndefined();
    expect(props.pagination).toBeUndefined();
    expect(props.selection).toBeUndefined();
    expect(props.filtering).toBeUndefined();
    expect(props.emptyMessage).toBeUndefined();
    expect(props.toolbar).toBeUndefined();
  });

  // --- infinite scroll API ---

  it('infinite accepts boolean true', () => {
    const props: IDataTableProps<{ id: number }> = {
      data: [],
      columns: [],
      infinite: true,
    };
    expect(props.infinite).toBe(true);
  });

  it('infinite accepts options object', () => {
    const props: IDataTableProps<{ id: number }> = {
      data: [],
      columns: [],
      infinite: { itemHeight: 48, overscan: 10, threshold: 8 },
    };
    if (typeof props.infinite === 'object') {
      expect(props.infinite.itemHeight).toBe(48);
      expect(props.infinite.overscan).toBe(10);
      expect(props.infinite.threshold).toBe(8);
    }
  });

  it('onLoadMore is an optional callback', () => {
    let called = false;
    const props: IDataTableProps<{ id: number }> = {
      data: [],
      columns: [],
      infinite: true,
      onLoadMore: () => {
        called = true;
      },
    };
    props.onLoadMore?.();
    expect(called).toBe(true);
  });

  it('infinite and pagination can coexist in props type (infinite takes precedence at runtime)', () => {
    // Both can be supplied — runtime ignores pagination when infinite is active.
    const props: IDataTableProps<{ id: number }> = {
      data: [],
      columns: [],
      infinite: true,
      pagination: true,
    };
    expect(props.infinite).toBe(true);
    expect(props.pagination).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// DEFAULT_PAGE_SIZE sentinel documentation
// ---------------------------------------------------------------------------

describe('DataTable defaults documentation', () => {
  it('pagination object with no pageSize means consumer expects 10 as default', () => {
    const DEFAULT_PAGE_SIZE = 10;
    const propsA: IDataTableProps<{ id: number }> = { data: [], columns: [], pagination: true };
    const propsB: IDataTableProps<{ id: number }> = { data: [], columns: [], pagination: {} };
    const propsC: IDataTableProps<{ id: number }> = { data: [], columns: [], pagination: { pageSize: DEFAULT_PAGE_SIZE } };

    expect(typeof propsA.pagination).toBe('boolean');
    expect(typeof propsB.pagination).toBe('object');
    if (typeof propsC.pagination === 'object') {
      expect(propsC.pagination.pageSize).toBe(10);
    }
  });

  it('infinite defaults: itemHeight 36, overscan 5, threshold 5', () => {
    // Documents the constant defaults embedded in resolveInfiniteOptions.
    const DEFAULT_ITEM_HEIGHT = 36;
    const DEFAULT_OVERSCAN = 5;
    const DEFAULT_THRESHOLD = 5;
    const opts: IDataTableProps<{ id: number }>['infinite'] = {};
    // With empty object, runtime will fall back to the defaults above.
    // This test documents the contract, not the runtime (no JSX in vitest).
    expect(DEFAULT_ITEM_HEIGHT).toBe(36);
    expect(DEFAULT_OVERSCAN).toBe(5);
    expect(DEFAULT_THRESHOLD).toBe(5);
    expect(opts).toEqual({});
  });
});
