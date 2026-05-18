import type { JSX } from 'solid-js';
import { Show } from 'solid-js';

interface IFieldShellProps {
  label: string;
  hint?: string;
  /** Если true, label рендерится inline (для toggle с подписью справа). */
  inline?: boolean;
  children: JSX.Element;
}

/**
 * Общий обёрточный layout для одного поля: label сверху, content под ним,
 * опциональный hint мелким шрифтом внизу. Все Field-компоненты используют
 * эту обёртку, чтобы вид был согласованным.
 */
export const FieldShell = (props: IFieldShellProps) => (
  <div
    classList={{
      'flex flex-col gap-1': !props.inline,
      'flex items-center justify-between gap-2': props.inline,
    }}
  >
    <span class="text-xs opacity-70">{props.label}</span>
    <div>{props.children}</div>
    <Show when={props.hint}>
      <span class="text-xs opacity-50">{props.hint}</span>
    </Show>
  </div>
);
