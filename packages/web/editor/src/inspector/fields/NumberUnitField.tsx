import { createMemo, For } from 'solid-js';
import type { INumberUnitField } from '../types';
import { FieldShell } from './FieldShell';
import { formatUnit, parseUnit } from './parse-unit';

interface IProps {
  field: INumberUnitField;
  value: string | undefined;
  onChange: (v: string) => void;
}

/**
 * Число + единица измерения в одной строке. При выборе `auto` числовое поле
 * блокируется, и в onChange улетает строка `'auto'`.
 */
export const NumberUnitField = (props: IProps) => {
  const fallbackUnit = () => props.field.defaultUnit ?? props.field.units[0] ?? 'px';
  const parsed = createMemo(() => parseUnit(props.value, fallbackUnit()));

  const onNumberInput = (raw: number) => {
    if (Number.isNaN(raw)) return;
    props.onChange(formatUnit(raw, parsed().unit));
  };
  const onUnitChange = (nextUnit: string) => {
    props.onChange(formatUnit(parsed().value, nextUnit));
  };

  return (
    <FieldShell label={props.field.label} hint={props.field.hint}>
      <div class="flex gap-1">
        <input
          type="number"
          step={props.field.step}
          class="flex-1 min-w-0 px-2 py-1 bg-white/5 border border-white/15 rounded text-sm outline-none focus:border-blue-400/60 transition-colors disabled:opacity-40"
          value={parsed().value ?? ''}
          disabled={props.field.disabled || parsed().unit === 'auto'}
          onInput={(e) => onNumberInput(e.currentTarget.valueAsNumber)}
        />
        <select
          class="px-2 py-1 bg-white/5 border border-white/15 rounded text-sm outline-none focus:border-blue-400/60 transition-colors disabled:opacity-40"
          value={parsed().unit}
          disabled={props.field.disabled}
          onChange={(e) => onUnitChange(e.currentTarget.value)}
        >
          <For each={props.field.units}>{(u) => <option value={u}>{u}</option>}</For>
        </select>
      </div>
    </FieldShell>
  );
};
