import { createMemo, For, Show } from 'solid-js';

import type { IResizableItem, IResizableProps } from './interfaces';
import { ResizableHandle, ResizablePanel, ResizableRoot } from './primitives';

/**
 * Для item'ов без явного `initialSize` corvu Panel на mount может посчитать
 * размер `0` (фактический фракционный остаток заполняется только после первого
 * ResizeObserver-тика или первого drag'а). На UI это выглядит как «правый край
 * не на правом краю до первого ресайза».
 *
 * Чтобы initial layout сразу был корректным — равномерно раздаём свободный
 * остаток (1 - sum(declared)) между panels без declared initialSize.
 */
const fillInitialSizes = (items: IResizableItem[]): number[] => {
  const declared = items.map((it) => it.initialSize);
  const sum = declared.reduce<number>((s, v) => s + (v ?? 0), 0);
  const missing = declared.filter((v) => v === undefined).length;
  const remainder = Math.max(0, 1 - sum);
  const auto = missing > 0 ? remainder / missing : 0;
  return declared.map((v) => v ?? auto);
};

/**
 * Высокоуровневый Resizable. Принимает массив `items`, для каждого item
 * рендерит corvu Panel. Между соседями `i` и `i+1` ставит Handle ⇔ у обоих
 * `resizable !== false`.
 */
export const Resizable = (props: IResizableProps) => {
  const sizes = createMemo(() => fillInitialSizes(props.items));

  return (
    <ResizableRoot orientation={props.orientation ?? 'horizontal'} class={props.class}>
      <For each={props.items}>
        {(item, index) => (
          <>
            <ResizablePanel
              initialSize={sizes()[index()]}
              minSize={item.minSize}
              maxSize={item.maxSize}
              collapsible={item.collapsible}
            >
              {item.children}
            </ResizablePanel>
            <Show
              when={(() => {
                const next = props.items[index() + 1];
                return !!next && item.resizable !== false && next.resizable !== false;
              })()}
            >
              <ResizableHandle withHandle={props.withHandle} />
            </Show>
          </>
        )}
      </For>
    </ResizableRoot>
  );
};
