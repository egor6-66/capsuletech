import { cn } from '@capsuletech/web-style';
import { For, type JSX, Show, splitProps } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import { Label } from '../label';

const createFieldPart = <T extends keyof JSX.IntrinsicElements>(
  tag: T,
  defaultClass: string,
  slot: string,
) => {
  // Используем JSX.IntrinsicElements[T], чтобы пропсы соответствовали тегу
  return (props: JSX.IntrinsicElements[T]) => {
    const [local, others] = splitProps(props as any, ['class']);

    return (
      <Dynamic
        component={tag}
        data-slot={slot}
        class={cn(defaultClass, local.class)}
        // Используем as any здесь, чтобы TS не пытался проверить
        // совместимость others со всеми возможными тегами сразу
        {...(others as any)}
      />
    );
  };
};

export const FieldContent = createFieldPart(
  'div',
  'group/field-content flex flex-1 flex-col gap-1.5 leading-snug',
  'field-content',
);
export const FieldDescription = createFieldPart(
  'p',
  'text-muted-foreground text-sm font-normal leading-normal group-has-[[data-orientation=horizontal]]/field:text-balance nth-last-2:-mt-1 last:mt-0 [[data-variant=legend]+&]:-mt-1.5 [&>a:hover]:text-primary [&>a]:underline [&>a]:underline-offset-4',
  'field-description',
);
export const FieldGroup = createFieldPart(
  'div',
  'group/field-group @container/field-group flex w-full flex-col gap-2 data-[slot=checkbox-group]:gap-3 [&>[data-slot=field-group]]:gap-4',
  'field-group',
);
export const FieldSet = createFieldPart(
  'fieldset',
  'flex flex-col gap-6 has-[>[data-slot=checkbox-group]]:gap-3 has-[>[data-slot=radio-group]]:gap-3',
  'field-set',
);
export const FieldTitle = createFieldPart(
  'div',
  'flex w-fit items-center gap-2 text-sm font-medium leading-snug group-data-[disabled=true]/field:opacity-50',
  'field-label',
);
export function FieldError(
  props: JSX.HTMLAttributes<HTMLDivElement> & {
    errors?: Array<{ message?: string } | undefined>;
  },
) {
  const [local, others] = splitProps(props, ['class', 'children', 'errors']);

  return (
    <Show when={local.children || (local.errors && local.errors.length > 0)}>
      <div
        role="alert"
        data-slot="field-error"
        class={cn('text-destructive text-sm font-normal', local.class)}
        {...others}
      >
        <Show when={!local.children} fallback={local.children}>
          <Show when={local.errors!.length > 1} fallback={local.errors![0]?.message}>
            <ul class="ml-4 flex list-disc flex-col gap-1">
              <For each={local.errors}>
                {(error) => (
                  <Show when={error?.message}>
                    <li>{error?.message}</li>
                  </Show>
                )}
              </For>
            </ul>
          </Show>
        </Show>
      </div>
    </Show>
  );
}
export function FieldSeparator(props: JSX.HTMLAttributes<HTMLDivElement>) {
  const [local, others] = splitProps(props, ['class', 'children']);

  return (
    <div
      data-slot="field-separator"
      data-content={!!local.children}
      class={cn(
        'relative -my-2 h-5 text-sm group-data-[variant=outline]/field-group:-mb-2',
        local.class,
      )}
      {...others}
    >
      <div class="absolute inset-0 top-1/2 border-t border-border" />{' '}
      {/* Заменил List на простой div для примера */}
      <Show when={local.children}>
        <span
          class="bg-background text-muted-foreground relative mx-auto block w-fit px-2"
          data-slot="field-separator-content"
        >
          {local.children}
        </span>
      </Show>
    </div>
  );
}

export function FieldLegend(
  props: JSX.HTMLAttributes<HTMLLegendElement> & { variant?: 'legend' | 'label' },
) {
  const [local, others] = splitProps(props, ['class', 'variant']);
  const variant = () => local.variant || 'legend';

  return (
    <legend
      data-slot="field-legend"
      data-variant={variant()}
      class={cn('mb-3 font-medium', variant() === 'legend' ? 'text-base' : 'text-sm', local.class)}
      {...others}
    />
  );
}
export function FieldLabel(props: JSX.LabelHTMLAttributes<HTMLLabelElement>) {
  // Отделяем class, чтобы смешать его с нашими стилями
  const [local, others] = splitProps(props, ['class']);

  return (
    <Label
      data-slot="field-label"
      class={cn(
        'group/field-label peer/field-label flex w-fit gap-2 leading-snug group-data-[disabled=true]/field:opacity-50',
        'has-[>[data-slot=field]]:w-full has-[>[data-slot=field]]:flex-col has-[>[data-slot=field]]:rounded-md has-[>[data-slot=field]]:border [&>[data-slot=field]]:p-4',
        'has-data-[state=checked]:bg-primary/5 has-data-[state=checked]:border-primary dark:has-data-[state=checked]:bg-primary/10',
        local.class,
      )}
      {...others}
    />
  );
}
