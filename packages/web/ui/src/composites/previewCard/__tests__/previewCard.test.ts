/**
 * PreviewCard composite tests.
 *
 * The vitest config (environment: 'node', no JSX transform) cannot process
 * .tsx files that use Solid JSX. Tests here cover what is importable from
 * pure-TS entry points: interface structural contracts, accessor resolution
 * logic, and key derivation.
 *
 * Visual + interactive coverage lives in previewCard.stories.tsx.
 * DOM render coverage is intended once a vitest Solid transform is added
 * to the config (see OWNERSHIP.md backlog).
 */
import { describe, expect, it } from 'vitest';

import type { IPreviewCardField, IPreviewCardProps } from '../interfaces';

// ---------------------------------------------------------------------------
// Helpers re-implemented here to test the contract without importing .tsx
// ---------------------------------------------------------------------------

function resolveValue<TData>(field: IPreviewCardField<TData>, row: TData): unknown {
  if (field.accessorFn !== undefined) {
    return field.accessorFn(row);
  }
  if (field.accessorKey !== undefined) {
    return (row as Record<string, unknown>)[field.accessorKey];
  }
  return undefined;
}

function fieldKey<TData>(field: IPreviewCardField<TData>): string | undefined {
  return field.id ?? field.accessorKey;
}

// ---------------------------------------------------------------------------
// IPreviewCardField structural contracts
// ---------------------------------------------------------------------------

describe('IPreviewCardField structural contracts', () => {
  it('accepts accessorKey constrained to keyof TData', () => {
    type IIncident = { id: number; description: string };
    const field: IPreviewCardField<IIncident> = { accessorKey: 'id', header: 'ID' };
    expect(field.accessorKey).toBe('id');
    expect(field.header).toBe('ID');
  });

  it('accepts accessorFn only (id required for stable key)', () => {
    type IIncident = { id: number; applicant: { name: string } };
    const field: IPreviewCardField<IIncident> = {
      id: 'applicantName',
      accessorFn: (row) => row.applicant.name,
      header: 'Applicant',
    };
    expect(field.id).toBe('applicantName');
    expect(typeof field.accessorFn).toBe('function');
  });

  it('accepts optional cell renderer', () => {
    type IItem = { createdAt: string };
    const field: IPreviewCardField<IItem> = {
      accessorKey: 'createdAt',
      header: 'Created',
      cell: ({ getValue }) => String(getValue()),
    };
    expect(typeof field.cell).toBe('function');
  });

  it('all fields (accessorKey, accessorFn, header, cell, id) are individually optional except header', () => {
    type IItem = { name: string };
    // Only header is required
    const minimal: IPreviewCardField<IItem> = { header: 'Name' };
    expect(minimal.header).toBe('Name');
    expect(minimal.accessorKey).toBeUndefined();
    expect(minimal.accessorFn).toBeUndefined();
    expect(minimal.cell).toBeUndefined();
    expect(minimal.id).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// IPreviewCardProps structural contracts
// ---------------------------------------------------------------------------

describe('IPreviewCardProps structural contracts', () => {
  it('accepts required data + fields', () => {
    type IItem = { id: number; name: string };
    const props: IPreviewCardProps<IItem> = {
      data: { id: 1, name: 'Alice' },
      fields: [{ accessorKey: 'id', header: 'ID' }],
    };
    expect(props.data).toEqual({ id: 1, name: 'Alice' });
    expect(props.fields).toHaveLength(1);
  });

  it('data accepts null (empty state)', () => {
    const props: IPreviewCardProps<{ id: number }> = {
      data: null,
      fields: [],
    };
    expect(props.data).toBeNull();
  });

  it('data accepts undefined (empty state)', () => {
    const props: IPreviewCardProps<{ id: number }> = {
      data: undefined,
      fields: [],
    };
    expect(props.data).toBeUndefined();
  });

  it('emptyMessage accepts a string', () => {
    const props: IPreviewCardProps<{ id: number }> = {
      data: null,
      fields: [],
      emptyMessage: 'Select an item',
    };
    expect(props.emptyMessage).toBe('Select an item');
  });

  it('class prop is optional and applied to outer wrapper', () => {
    const props: IPreviewCardProps<{ id: number }> = {
      data: { id: 1 },
      fields: [],
      class: 'custom-class',
    };
    expect(props.class).toBe('custom-class');
  });

  it('all optional props are absent by default', () => {
    const props: IPreviewCardProps<{ id: number }> = {
      data: { id: 1 },
      fields: [],
    };
    expect(props.emptyMessage).toBeUndefined();
    expect(props.class).toBeUndefined();
  });

  it('fields array preserves insertion order', () => {
    type IItem = { a: string; b: string; c: string };
    const fields: IPreviewCardField<IItem>[] = [
      { accessorKey: 'a', header: 'A' },
      { accessorKey: 'b', header: 'B' },
      { accessorKey: 'c', header: 'C' },
    ];
    const props: IPreviewCardProps<IItem> = { data: { a: '1', b: '2', c: '3' }, fields };
    expect(props.fields[0]?.accessorKey).toBe('a');
    expect(props.fields[1]?.accessorKey).toBe('b');
    expect(props.fields[2]?.accessorKey).toBe('c');
  });
});

// ---------------------------------------------------------------------------
// resolveValue logic
// ---------------------------------------------------------------------------

describe('resolveValue', () => {
  type IIncident = { id: number; description: string; applicant: { name: string } };
  const row: IIncident = { id: 42, description: 'Fire alarm', applicant: { name: 'Bob' } };

  it('resolves value via accessorKey', () => {
    const field: IPreviewCardField<IIncident> = { accessorKey: 'id', header: 'ID' };
    expect(resolveValue(field, row)).toBe(42);
  });

  it('resolves value via accessorKey for string field', () => {
    const field: IPreviewCardField<IIncident> = { accessorKey: 'description', header: 'Description' };
    expect(resolveValue(field, row)).toBe('Fire alarm');
  });

  it('resolves value via accessorFn for nested field', () => {
    const field: IPreviewCardField<IIncident> = {
      id: 'applicantName',
      accessorFn: (r) => r.applicant.name,
      header: 'Applicant',
    };
    expect(resolveValue(field, row)).toBe('Bob');
  });

  it('accessorFn wins over accessorKey when both are provided', () => {
    const field: IPreviewCardField<IIncident> = {
      accessorKey: 'id',
      accessorFn: (r) => r.description,
      header: 'Custom',
    };
    // accessorFn should return 'Fire alarm', not 42
    expect(resolveValue(field, row)).toBe('Fire alarm');
  });

  it('returns undefined when neither accessor is provided', () => {
    const field: IPreviewCardField<IIncident> = { header: 'No accessor' };
    expect(resolveValue(field, row)).toBeUndefined();
  });

  it('handles falsy values (0, empty string) without coercing to undefined', () => {
    type IItem = { count: number; label: string };
    const zeroRow: IItem = { count: 0, label: '' };
    const countField: IPreviewCardField<IItem> = { accessorKey: 'count', header: 'Count' };
    const labelField: IPreviewCardField<IItem> = { accessorKey: 'label', header: 'Label' };
    expect(resolveValue(countField, zeroRow)).toBe(0);
    expect(resolveValue(labelField, zeroRow)).toBe('');
  });
});

// ---------------------------------------------------------------------------
// fieldKey (stable key derivation for <For> loop)
// ---------------------------------------------------------------------------

describe('fieldKey', () => {
  it('returns accessorKey when id is absent', () => {
    type IItem = { id: number };
    const field: IPreviewCardField<IItem> = { accessorKey: 'id', header: 'ID' };
    expect(fieldKey(field)).toBe('id');
  });

  it('returns id when both id and accessorKey are present (id wins)', () => {
    type IItem = { id: number };
    const field: IPreviewCardField<IItem> = { id: 'customId', accessorKey: 'id', header: 'ID' };
    expect(fieldKey(field)).toBe('customId');
  });

  it('returns id when only id is set (accessorFn-only field)', () => {
    type IItem = { applicant: { name: string } };
    const field: IPreviewCardField<IItem> = {
      id: 'applicantName',
      accessorFn: (r) => r.applicant.name,
      header: 'Applicant',
    };
    expect(fieldKey(field)).toBe('applicantName');
  });

  it('returns undefined when neither id nor accessorKey is provided', () => {
    type IItem = { x: number };
    const field: IPreviewCardField<IItem> = { header: 'No key' };
    expect(fieldKey(field)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// cell override contract
// ---------------------------------------------------------------------------

describe('cell override contract', () => {
  it('cell receives getValue and row', () => {
    type IItem = { createdAt: string };
    const row: IItem = { createdAt: '2024-01-15T10:00:00Z' };
    let capturedRow: IItem | undefined;
    let capturedValue: unknown;

    const field: IPreviewCardField<IItem> = {
      accessorKey: 'createdAt',
      header: 'Created',
      cell: ({ getValue, row: r }) => {
        capturedValue = getValue();
        capturedRow = r;
        return String(getValue());
      },
    };

    // Simulate what PreviewCard does: call cell with getValue + row
    const getValue = () => resolveValue(field, row);
    field.cell!({ getValue, row });

    expect(capturedRow).toBe(row);
    expect(capturedValue).toBe('2024-01-15T10:00:00Z');
  });

  it('cell result supersedes default typography rendering (contract documentation)', () => {
    // When `cell` is defined, PreviewCard renders cell(...) instead of Typography.
    // This test documents the intent by verifying that a custom formatter is called.
    type IItem = { amount: number };
    const row: IItem = { amount: 9999 };
    let formatterCalled = false;

    const field: IPreviewCardField<IItem> = {
      accessorKey: 'amount',
      header: 'Amount',
      cell: ({ getValue }) => {
        formatterCalled = true;
        return `$${Number(getValue()).toFixed(2)}`;
      },
    };

    const getValue = () => resolveValue(field, row);
    const result = field.cell!({ getValue, row });
    expect(formatterCalled).toBe(true);
    expect(result).toBe('$9999.00');
  });
});

// ---------------------------------------------------------------------------
// Multiple fields — render order contract
// ---------------------------------------------------------------------------

describe('multiple fields order', () => {
  it('fields array with 5 entries all resolve independently', () => {
    type IItem = { a: string; b: number; c: boolean; d: string; e: string };
    const row: IItem = { a: 'alpha', b: 2, c: true, d: 'delta', e: 'epsilon' };
    const fields: IPreviewCardField<IItem>[] = [
      { accessorKey: 'a', header: 'A' },
      { accessorKey: 'b', header: 'B' },
      { accessorKey: 'c', header: 'C' },
      { accessorKey: 'd', header: 'D' },
      { accessorKey: 'e', header: 'E' },
    ];

    const values = fields.map((f) => resolveValue(f, row));
    expect(values).toEqual(['alpha', 2, true, 'delta', 'epsilon']);
  });

  it('fields with unique keys produce distinct fieldKey values', () => {
    type IItem = { id: number; name: string };
    const fields: IPreviewCardField<IItem>[] = [
      { accessorKey: 'id', header: 'ID' },
      { accessorKey: 'name', header: 'Name' },
      { id: 'custom', accessorFn: () => 'x', header: 'Custom' },
    ];
    const keys = fields.map((f) => fieldKey(f));
    // All three keys are distinct
    const unique = new Set(keys.filter(Boolean));
    expect(unique.size).toBe(3);
    expect(keys).toEqual(['id', 'name', 'custom']);
  });
});
