import { Toggle } from '@capsuletech/web-ui/toggle';
import { Show } from 'solid-js';
import type { IBooleanField } from '../types';

interface IProps {
  field: IBooleanField;
  value: boolean | undefined;
  onChange: (v: boolean) => void;
}

/**
 * Boolean — inline-layout: label слева, toggle справа. Так компактнее в
 * списке полей и читабельнее («Отключено: ON»).
 */
export const BooleanField = (props: IProps) => (
  <div class="flex flex-col gap-1">
    <div class="flex items-center justify-between gap-2">
      <span class="text-xs opacity-70">{props.field.label}</span>
      <Toggle checked={!!props.value} onChange={props.onChange} disabled={props.field.disabled} />
    </div>
    <Show when={props.field.hint}>
      <span class="text-xs opacity-50">{props.field.hint}</span>
    </Show>
  </div>
);
