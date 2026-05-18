import { For } from 'solid-js';
import type { ISelectField } from '../types';
import { FieldShell } from './FieldShell';

interface IProps {
  field: ISelectField;
  value: string | undefined;
  onChange: (v: string) => void;
}

/**
 * Простой native select на v1. Когда в @capsuletech/ui появится полноценный
 * Select (Kobalte popover + Listbox) — заменим, API наружу не изменится.
 */
export const SelectField = (props: IProps) => (
  <FieldShell label={props.field.label} hint={props.field.hint}>
    <select
      class="w-full px-2 py-1 bg-white/5 border border-white/15 rounded text-sm outline-none focus:border-blue-400/60 transition-colors disabled:opacity-40"
      value={props.value ?? ''}
      disabled={props.field.disabled}
      onChange={(e) => props.onChange(e.currentTarget.value)}
    >
      <For each={props.field.options}>
        {(opt) => <option value={opt.value}>{opt.label ?? opt.value}</option>}
      </For>
    </select>
  </FieldShell>
);
