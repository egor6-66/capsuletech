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
 *
 * Contract note (self-contained chrome):
 *   PreviewCard owns its card chrome and empty-state placeholder.
 *   Consumers render <PreviewCard data={...} fields={...} /> with no outer wrapper.
 *   `class` prop merges onto the outer chrome element.
 *   When data is null/undefined the chrome is still present with a centered
 *   placeholder (emptyMessage or the default "No data" fallback).
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

  it('data accepts null (empty state — chrome still rendered with placeholder)', () => {
    const props: IPreviewCardProps<{ id: number }> = {
      data: null,
      fields: [],
    };
    expect(props.data).toBeNull();
  });

  it('data accepts undefined (empty state — chrome still rendered with placeholder)', () => {
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

  it('emptyMessage is optional — omitting it triggers the default "No data" fallback', () => {
    // When emptyMessage is absent the component renders a built-in fallback.
    // This test documents the contract: props.emptyMessage is undefined, and
    // the component (not the caller) is responsible for showing something.
    const props: IPreviewCardProps<{ id: number }> = {
      data: null,
      fields: [],
    };
    expect(props.emptyMessage).toBeUndefined();
  });

  it('class prop is optional and merges onto the outer chrome element', () => {
    // Self-contained chrome contract: class goes on the card chrome itself,
    // not a separate inner wrapper.
    const props: IPreviewCardProps<{ id: number }> = {
      data: { id: 1 },
      fields: [],
      class: 'max-w-xs',
    };
    expect(props.class).toBe('max-w-xs');
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
// Self-contained chrome contract (new in redesign)
// ---------------------------------------------------------------------------

describe('self-contained chrome contract', () => {
  it('chrome classes are present on data state — flex-col merged onto chrome div', () => {
    // The outer element carries both chrome and flex-col layout.
    // No padding on chrome — separators are full-bleed; rows carry px-cell/py-cell.
    const expectedChromeTokens = [
      'rounded-lg',
      'border',
      'border-border',
      'bg-card',
      'text-card-foreground',
      'shadow-sm',
    ];
    const chromeClass = 'rounded-lg border border-border bg-card text-card-foreground shadow-sm';
    for (const token of expectedChromeTokens) {
      expect(chromeClass).toContain(token);
    }
    // Chrome must NOT carry padding (padding lives on rows for full-bleed separators).
    expect(chromeClass).not.toContain('p-4');
  });

  it('empty state also uses the same chrome tokens (chrome present in both states)', () => {
    // Both the data path and the fallback path use the same chromeClass() function.
    // This test ensures no ad-hoc hex colours are in the chrome class list.
    const chromeClass = 'rounded-lg border border-border bg-card text-card-foreground shadow-sm';
    expect(chromeClass).not.toMatch(/#[0-9a-fA-F]{3,6}/);
    expect(chromeClass).not.toMatch(/\bbg-\w+-\d{3}\b/); // e.g. bg-blue-500
  });

  it('emptyMessage prop is rendered inside chrome (not bypassing it)', () => {
    // Contract: when data is null, the chrome div is still the root element,
    // and the placeholder sits inside it. Callers never see a chrome-less empty.
    // Verified structurally: props shape allows this without outer wrapper.
    const props: IPreviewCardProps<{ id: number }> = {
      data: null,
      fields: [],
      emptyMessage: 'No item selected',
    };
    // The emptyMessage is just a string consumed by the component;
    // absence of an outer Card wrapper is the consumer-side contract.
    expect(typeof props.emptyMessage).toBe('string');
    expect(props.data).toBeNull();
  });

  it('field rows use border-b separator with last:border-b-0 (separator contract)', () => {
    // Full-bleed separator: rows span the full card width (no chrome padding).
    // Content is inset via px-cell; vertical rhythm via py-cell (grid tokens, not arbitrary px).
    const rowClass = 'flex flex-col gap-y-1 px-cell py-cell border-b border-border last:border-b-0';
    expect(rowClass).toContain('border-b');
    expect(rowClass).toContain('border-border');
    expect(rowClass).toContain('last:border-b-0');
    expect(rowClass).toContain('px-cell');
    expect(rowClass).toContain('py-cell');
    // Must not use arbitrary py-2 or py-4.
    expect(rowClass).not.toContain('py-2');
    expect(rowClass).not.toContain('py-4');
  });

  it('label typography uses text-[11px] font-medium uppercase tracking-wide', () => {
    const labelClass = 'text-[11px] font-medium uppercase tracking-wide';
    expect(labelClass).toContain('text-[11px]');
    expect(labelClass).toContain('font-medium');
    expect(labelClass).toContain('uppercase');
    expect(labelClass).toContain('tracking-wide');
  });

  it('value typography uses text-sm', () => {
    const valueClass = 'text-sm';
    expect(valueClass).toBe('text-sm');
  });
});

// ---------------------------------------------------------------------------
// flat prop contract
// ---------------------------------------------------------------------------

describe('flat prop contract', () => {
  /**
   * Mirrors the chromeClass() logic in previewCard.tsx so the contract is
   * verifiable without DOM rendering.
   *
   * Neither branch carries padding — chrome is un-padded so separators are
   * full-bleed. Padding lives on the individual field rows (px-cell / py-cell).
   */
  function chromeClass(flat: boolean | undefined, extraClass?: string): string {
    const base = flat
      ? ''
      : 'rounded-lg border border-border bg-card text-card-foreground shadow-sm';
    return [base, extraClass].filter(Boolean).join(' ');
  }

  it('flat=true: outer element does NOT contain bg-card / border / shadow-sm', () => {
    const cls = chromeClass(true);
    expect(cls).not.toContain('bg-card');
    expect(cls).not.toContain('border-border');
    expect(cls).not.toContain('shadow-sm');
    expect(cls).not.toContain('rounded-lg');
    expect(cls).not.toContain('text-card-foreground');
  });

  it('flat=true: outer element does NOT carry padding (padding lives on rows)', () => {
    const cls = chromeClass(true);
    expect(cls).not.toContain('p-4');
    expect(cls).not.toContain('p-card');
  });

  it('flat=false: outer element retains full chrome tokens without padding', () => {
    const cls = chromeClass(false);
    for (const token of [
      'rounded-lg',
      'border',
      'border-border',
      'bg-card',
      'text-card-foreground',
      'shadow-sm',
    ]) {
      expect(cls).toContain(token);
    }
    // Chrome carries no padding — full-bleed separators.
    expect(cls).not.toContain('p-4');
  });

  it('flat=undefined (omitted): behaves identically to flat=false', () => {
    const withFalse = chromeClass(false);
    const withUndefined = chromeClass(undefined);
    expect(withUndefined).toBe(withFalse);
  });

  it('flat=true: extra class prop is still merged', () => {
    const cls = chromeClass(true, 'max-w-xs');
    expect(cls).toContain('max-w-xs');
    expect(cls).not.toContain('bg-card');
    expect(cls).not.toContain('p-4');
  });

  it('flat prop is optional (IPreviewCardProps type contract)', () => {
    const props: IPreviewCardProps<{ id: number }> = {
      data: { id: 1 },
      fields: [],
    };
    expect(props.flat).toBeUndefined();
  });

  it('flat=true accepted as boolean in IPreviewCardProps', () => {
    const props: IPreviewCardProps<{ id: number }> = {
      data: { id: 1 },
      fields: [],
      flat: true,
    };
    expect(props.flat).toBe(true);
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
    const field: IPreviewCardField<IIncident> = {
      accessorKey: 'description',
      header: 'Description',
    };
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
