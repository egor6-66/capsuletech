import type { INumberField } from '../types';
import { FieldShell } from './FieldShell';

interface IProps {
  field: INumberField;
  value: number | undefined;
  onChange: (v: number) => void;
}

export const NumberField = (props: IProps) => (
  <FieldShell label={props.field.label} hint={props.field.hint}>
    <input
      type="number"
      class="w-full px-2 py-1 bg-white/5 border border-white/15 rounded text-sm outline-none focus:border-blue-400/60 transition-colors disabled:opacity-40"
      value={props.value ?? ''}
      min={props.field.min}
      max={props.field.max}
      step={props.field.step}
      disabled={props.field.disabled}
      onInput={(e) => {
        const v = e.currentTarget.valueAsNumber;
        if (!Number.isNaN(v)) props.onChange(v);
      }}
    />
  </FieldShell>
);
