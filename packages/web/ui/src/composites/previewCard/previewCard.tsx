import { cn } from '@capsuletech/web-style';
import { For, Show, splitProps } from 'solid-js';

import { Typography } from '../../primitives/typography';
import type { IPreviewCardField, IPreviewCardProps } from './interfaces';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Resolves the display value for a field given the current row data.
 *
 * Resolution order:
 *  1. `field.accessorFn(row)` — custom extractor (wins over accessorKey).
 *  2. `row[field.accessorKey]` — direct key lookup.
 *  3. `undefined` — neither accessor provided.
 */
function resolveValue<TData>(field: IPreviewCardField<TData>, row: TData): unknown {
  if (field.accessorFn !== undefined) {
    return field.accessorFn(row);
  }
  if (field.accessorKey !== undefined) {
    return (row as Record<string, unknown>)[field.accessorKey];
  }
  return undefined;
}

/**
 * Derives a stable string key for a field entry inside `<For>`.
 * Prefers explicit `id`, falls back to `accessorKey`.
 * Returns `undefined` when neither is set (accessor-fn-only fields without id).
 */
function fieldKey<TData>(field: IPreviewCardField<TData>): string | undefined {
  return field.id ?? field.accessorKey;
}

// ---------------------------------------------------------------------------
// PreviewCard
// ---------------------------------------------------------------------------

/**
 * Self-contained composite that renders a single data object as an ordered list
 * of label + value blocks — a "single-item DataTable" for sidebar / detail panels.
 *
 * PreviewCard owns its own card chrome (rounded border, surface colour, padding,
 * shadow) and its empty-state placeholder. Consumers drop it directly with no
 * outer wrapper and no empty-state handling:
 *
 * ```tsx
 * <PreviewCard data={incident()} fields={fields} emptyMessage="Select an item" />
 * ```
 *
 * The `class` prop merges onto the outer chrome element, allowing callers to
 * override width, margin, etc.
 *
 * **Field resolution order:** `accessorFn` wins over `accessorKey`.
 * **Cell override:** when `cell` is supplied the custom renderer is used instead
 * of the default `<Typography>` value display.
 */
export function PreviewCard<TData>(rawProps: IPreviewCardProps<TData>) {
  const [local] = splitProps(rawProps, ['data', 'fields', 'emptyMessage', 'class', 'flat']);

  const chromeClass = () =>
    local.flat
      ? cn(local.class)
      : cn('rounded-lg border border-border bg-card text-card-foreground shadow-sm', local.class);

  return (
    <Show
      when={local.data != null}
      fallback={
        <div class={chromeClass()}>
          <div class="flex items-center justify-center p-card">
            <Typography variant="muted">{local.emptyMessage ?? 'No data'}</Typography>
          </div>
        </div>
      }
    >
      <div class={`flex flex-col ${chromeClass()}`}>
        <For each={local.fields} fallback={null}>
          {(field) => {
            const key = fieldKey(field);
            const getValue = () => resolveValue(field, local.data as TData);

            return (
              <div
                class="flex flex-col gap-y-1 px-cell py-cell border-b border-border last:border-b-0"
                {...(key !== undefined ? { 'data-field': key } : {})}
              >
                <Typography variant="muted" class="text-[11px] font-medium uppercase tracking-wide">
                  {field.header}
                </Typography>

                <Show
                  when={field.cell !== undefined}
                  fallback={<Typography class="text-sm">{String(getValue() ?? '')}</Typography>}
                >
                  {field.cell!({ getValue, row: local.data as TData })}
                </Show>
              </div>
            );
          }}
        </For>
      </div>
    </Show>
  );
}
