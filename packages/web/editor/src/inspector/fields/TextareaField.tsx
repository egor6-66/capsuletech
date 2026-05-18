import type { ITextareaField } from '../types';
import { FieldShell } from './FieldShell';

interface IProps {
  field: ITextareaField;
  value: string | undefined;
  onChange: (v: string) => void;
}

export const TextareaField = (props: IProps) => (
  <FieldShell label={props.field.label} hint={props.field.hint}>
    <textarea
      rows={props.field.rows ?? 3}
      class="w-full px-2 py-1 bg-white/5 border border-white/15 rounded text-sm outline-none focus:border-blue-400/60 transition-colors disabled:opacity-40 resize-y"
      classList={{ 'font-mono': props.field.mono }}
      value={props.value ?? ''}
      placeholder={props.field.placeholder}
      disabled={props.field.disabled}
      onInput={(e) => props.onChange(e.currentTarget.value)}
    />
  </FieldShell>
);
