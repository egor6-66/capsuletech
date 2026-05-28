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
 * Stateless composite that renders a single data object as an ordered list of
 * label + value blocks — a "single-item DataTable" for sidebar / detail panels.
 *
 * Atomic: does NOT wrap content in a `<Card>`. Caller is responsible for the
 * outer card chrome, making PreviewCard composable into any container:
 *
 * ```tsx
 * <Card>
 *   <Card.Header><Card.Title>Incident</Card.Title></Card.Header>
 *   <Card.Content>
 *     <PreviewCard data={incident()} fields={fields} emptyMessage="Select an item" />
 *   </Card.Content>
 * </Card>
 * ```
 *
 * **Field resolution order:** `accessorFn` wins over `accessorKey`.
 * **Cell override:** when `cell` is supplied the custom renderer is used instead
 * of the default `<Typography>` value display.
 */
export function PreviewCard<TData>(rawProps: IPreviewCardProps<TData>) {
  const [local] = splitProps(rawProps, ['data', 'fields', 'emptyMessage', 'class']);

  return (
    <Show
      when={local.data != null}
      fallback={
        <Show when={local.emptyMessage !== undefined}>
          <Typography variant="muted">{local.emptyMessage}</Typography>
        </Show>
      }
    >
      {/* data is non-null inside this branch */}
      <div class={`flex flex-col gap-y-cell ${local.class ?? ''}`}>
        <For each={local.fields} fallback={null}>
          {(field) => {
            const key = fieldKey(field);
            const getValue = () => resolveValue(field, local.data as TData);

            return (
              <div
                class="flex flex-col gap-y-1"
                {...(key !== undefined ? { 'data-field': key } : {})}
              >
                <Typography
                  variant="muted"
                  class="text-xs font-semibold uppercase tracking-wide"
                >
                  {field.header}
                </Typography>

                <Show
                  when={field.cell !== undefined}
                  fallback={
                    <Typography>
                      {String(getValue() ?? '')}
                    </Typography>
                  }
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
