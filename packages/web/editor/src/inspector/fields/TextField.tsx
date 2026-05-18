import type { ITextField } from '../types';
import { FieldShell } from './FieldShell';

interface IProps {
  field: ITextField;
  value: string | undefined;
  onChange: (v: string) => void;
}

export const TextField = (props: IProps) => (
  <FieldShell label={props.field.label} hint={props.field.hint}>
    <input
      type="text"
      class="w-full px-2 py-1 bg-white/5 border border-white/15 rounded text-sm outline-none focus:border-blue-400/60 transition-colors disabled:opacity-40"
      classList={{ 'font-mono': props.field.mono }}
      value={props.value ?? ''}
      placeholder={props.field.placeholder}
      disabled={props.field.disabled}
      onInput={(e) => props.onChange(e.currentTarget.value)}
    />
  </FieldShell>
);
