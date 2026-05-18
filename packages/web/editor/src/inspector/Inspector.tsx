import { For } from 'solid-js';
import { Category } from './Category';
import type { IInspectorProps } from './types';

/**
 * Универсальный редактор пропсов. Принимает список категорий (например
 * «Основное» / «Расширенное»), у каждой — набор типизированных полей.
 *
 * Inspector сам по себе ничего не «знает» о компонентах редактора —
 * это чистая render-функция от описаний полей и текущих значений.
 * Маппинг манифеста компонента → категорий выполняется в host'е.
 */
export const Inspector = (props: IInspectorProps) => (
  <div class={`flex flex-col gap-3 w-full ${props.class ?? ''}`}>
    <For each={props.categories}>
      {(cat) => <Category category={cat} values={props.values} onChange={props.onChange} />}
    </For>
  </div>
);
