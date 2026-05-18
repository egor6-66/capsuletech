import { createSignal, For, Show } from 'solid-js';
import { renderField } from './fields';
import type { ICategory, OnChangeFn, ValuesMap } from './types';

interface ICategoryProps {
  category: ICategory;
  values: ValuesMap;
  onChange: OnChangeFn;
}

/**
 * Одна секция Inspector'а. Collapsible header — клик переключает развёрнутый
 * вид. Начальное состояние — `category.defaultCollapsed`.
 */
export const Category = (props: ICategoryProps) => {
  const [collapsed, setCollapsed] = createSignal(!!props.category.defaultCollapsed);

  return (
    <div class="border border-white/15 rounded overflow-hidden">
      <button
        type="button"
        class="w-full flex items-center justify-between px-3 py-2 text-sm font-medium hover:bg-white/5 transition-colors text-left"
        onClick={() => setCollapsed(!collapsed())}
      >
        <span>{props.category.label}</span>
        <span class="opacity-50 text-xs">{collapsed() ? '▸' : '▾'}</span>
      </button>
      <Show when={!collapsed()}>
        <div class="px-3 py-3 flex flex-col gap-3 border-t border-white/10">
          <Show when={props.category.description}>
            <p class="text-xs opacity-60">{props.category.description}</p>
          </Show>
          <For each={props.category.fields}>
            {(field) => renderField(field, props.values, props.onChange)}
          </For>
        </div>
      </Show>
    </div>
  );
};
