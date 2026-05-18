import { createSignal, Show } from 'solid-js';
import type { IToggleProps } from './interfaces';

/**
 * Минимальный switch-style toggle. role=switch для accessibility,
 * data-checked атрибут для кастомных стилей через CSS-селекторы.
 *
 * Управляется снаружи (controlled) через `checked` + `onChange`. Если
 * `checked` не задан — компонент держит своё внутреннее состояние, опираясь
 * на `defaultChecked` (uncontrolled).
 */
export const Toggle = (props: IToggleProps) => {
  const [internal, setInternal] = createSignal(!!props.defaultChecked);
  const isControlled = () => props.checked !== undefined;
  const checked = () => (isControlled() ? !!props.checked : internal());

  const toggle = () => {
    if (props.disabled) return;
    const next = !checked();
    if (!isControlled()) setInternal(next);
    props.onChange?.(next);
  };

  return (
    <div class="flex items-center gap-2">
      <button
        type="button"
        role="switch"
        aria-checked={checked()}
        disabled={props.disabled}
        data-checked={checked() ? '' : undefined}
        onClick={toggle}
        class={`relative inline-flex h-5 w-9 items-center rounded-full border border-white/20 transition-colors disabled:opacity-40 ${
          checked() ? 'bg-blue-500/70' : 'bg-white/10'
        } ${props.class ?? ''}`}
      >
        <span
          class="block h-3.5 w-3.5 rounded-full bg-white shadow-md transition-transform"
          style={{ transform: checked() ? 'translateX(18px)' : 'translateX(2px)' }}
        />
      </button>
      <Show when={props.label}>
        <button
          type="button"
          class="text-sm select-none cursor-pointer"
          onClick={toggle}
          disabled={props.disabled}
        >
          {props.label}
        </button>
      </Show>
    </div>
  );
};
