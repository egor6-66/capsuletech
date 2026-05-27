import { cn } from '@capsuletech/web-style';
import { createMemo, For, type JSX, Show, splitProps, type ValidComponent } from 'solid-js';
import { Slot } from '../../slot';
import { mergeStyle, toGap } from '../grid/utils';
import { ResizableHandle, ResizablePanel, ResizableRoot } from './_resize/primitives';
import type {
  FlexAlign,
  FlexDirection,
  FlexJustify,
  FlexOrientation,
  FlexWrap,
  IFlexItem,
  IFlexProps,
} from './interfaces';

// Статические таблицы → Tailwind purge видит все классы в исходниках.
const DIRECTION: Record<FlexDirection, string> = {
  row: 'flex-row',
  'row-reverse': 'flex-row-reverse',
  col: 'flex-col',
  'col-reverse': 'flex-col-reverse',
};

const WRAP: Record<FlexWrap, string> = {
  wrap: 'flex-wrap',
  nowrap: 'flex-nowrap',
  'wrap-reverse': 'flex-wrap-reverse',
};

const ALIGN: Record<FlexAlign, string> = {
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
  stretch: 'items-stretch',
  baseline: 'items-baseline',
};

const JUSTIFY: Record<FlexJustify, string> = {
  start: 'justify-start',
  center: 'justify-center',
  end: 'justify-end',
  between: 'justify-between',
  around: 'justify-around',
  evenly: 'justify-evenly',
};

/** orientation → flex-direction class (для CSS-flex-mode) */
const ORIENTATION_DIR: Record<FlexOrientation, FlexDirection> = {
  horizontal: 'row',
  vertical: 'col',
};

// ---------------------------------------------------------------------------
// fillInitialSizes — равномерно раздаёт остаток между panels без declared size
// ---------------------------------------------------------------------------

const fillInitialSizes = (items: IFlexItem[]): number[] => {
  const declared = items.map((it) => it.initialSize);
  const sum = declared.reduce<number>((s, v) => s + (v ?? 0), 0);
  const missing = declared.filter((v) => v === undefined).length;
  const remainder = Math.max(0, 1 - sum);
  const auto = missing > 0 ? remainder / missing : 0;
  return declared.map((v) => v ?? auto);
};

// ---------------------------------------------------------------------------
// ResizableFlex — внутренний компонент для items-mode с resizable
// ---------------------------------------------------------------------------

interface IResizableFlexProps {
  items: IFlexItem[];
  orientation: FlexOrientation;
  withHandle?: boolean;
  /** Disable handle pointer interaction (layout still applies). */
  handleDisabled?: boolean;
  class?: string;
  /** Forwarded to corvu ResizableRoot — fires whenever panel sizes change. */
  onSizesChange?: (sizes: number[]) => void;
}

const ResizableFlex = (props: IResizableFlexProps) => {
  // Snapshot items via memo so the getter from the outer component (e.g. matrix's
  // `get items() { return buildHorizontalItems(...); }`) is called at most ONCE per
  // reactive update rather than once per access-site.  Multiple accesses within the
  // same computation return the identical array reference, preventing repeated
  // JSX-node creation that would move slot-children DOM nodes out of their panels.
  const items = createMemo(() => props.items);
  const sizes = createMemo(() => fillInitialSizes(items()));

  return (
    <ResizableRoot
      orientation={props.orientation}
      class={props.class}
      onSizesChange={props.onSizesChange}
    >
      <For each={items()}>
        {(item, index) => (
          <>
            <ResizablePanel
              initialSize={sizes()[index()]}
              minSize={item.minSize}
              maxSize={item.maxSize}
              collapsible={item.collapsible}
              class="min-h-0 min-w-0 overflow-hidden"
            >
              {item.children}
            </ResizablePanel>
            <Show
              when={(() => {
                const next = items()[index() + 1];
                return !!next && item.resizable !== false && next.resizable !== false;
              })()}
            >
              <ResizableHandle
                withHandle={props.withHandle}
                disabled={props.handleDisabled}
                classList={{ 'pointer-events-none': !!props.handleDisabled }}
              />
            </Show>
          </>
        )}
      </For>
    </ResizableRoot>
  );
};

// ---------------------------------------------------------------------------
// StaticItemsFlex — items-mode без resize (CSS flex)
// ---------------------------------------------------------------------------

interface IStaticItemsFlexProps {
  items: IFlexItem[];
  orientation: FlexOrientation;
  class?: string;
  style?: JSX.CSSProperties | string;
}

const StaticItemsFlex = (props: IStaticItemsFlexProps) => {
  const dirClass = props.orientation === 'vertical' ? 'flex flex-col' : 'flex flex-row';

  return (
    <div class={cn(dirClass, props.class)} style={props.style as JSX.CSSProperties | undefined}>
      <For each={props.items}>{(item) => <div>{item.children}</div>}</For>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Flex — public component
// ---------------------------------------------------------------------------

/**
 * Flex — низкоуровневая Flexbox-обёртка для страниц и виджетов.
 *
 * **Два режима:**
 *
 * 1. **CSS-flex mode** (default): передавай `children` как обычно.
 *    ```tsx
 *    <Flex gap={2} align="center">
 *      <Icon /> <span>Label</span>
 *    </Flex>
 *    ```
 *
 * 2. **Resizable mode**: передай `items` вместо `children`.
 *    Если хотя бы один item имеет `resizable: true` — рендерится через corvu.
 *    Иначе — обычный CSS flex.
 *    ```tsx
 *    <Flex
 *      orientation="horizontal"
 *      items={[
 *        { children: <A />, resizable: true, initialSize: 0.3, minSize: 0.1 },
 *        { children: <B />, resizable: true, initialSize: 0.7 },
 *      ]}
 *      withHandle
 *    />
 *    ```
 */
export const Flex = <T extends ValidComponent = 'div'>(props: IFlexProps<T>) => {
  const [own, polyAndRest] = splitProps(props, [
    'orientation',
    'direction',
    'wrap',
    'align',
    'justify',
    'gap',
    'gapX',
    'gapY',
    'inline',
    'class',
    'style',
    'items',
    'withHandle',
    'handleDisabled',
    'onSizesChange',
  ]);
  const [poly, others] = splitProps(polyAndRest, ['as']);

  // ---------------------------------------------------------------------------
  // Items-mode: `items` prop provided
  // ---------------------------------------------------------------------------

  const itemsMode = () => own.items !== undefined;

  const hasResizable = () => {
    const items: IFlexItem[] = own.items ?? [];
    return items.some((it) => it.resizable === true);
  };

  const orientation = (): FlexOrientation => own.orientation ?? 'horizontal';

  if (itemsMode()) {
    // Rendered as items-mode — ignore as/polyProps (no polymorphic in this mode)
    return (
      <Show
        when={hasResizable()}
        fallback={
          <StaticItemsFlex
            items={own.items!}
            orientation={orientation()}
            class={own.class}
            style={own.style as JSX.CSSProperties | undefined}
          />
        }
      >
        <ResizableFlex
          items={own.items!}
          orientation={orientation()}
          withHandle={own.withHandle}
          handleDisabled={own.handleDisabled}
          class={own.class}
          onSizesChange={own.onSizesChange}
        />
      </Show>
    );
  }

  // ---------------------------------------------------------------------------
  // CSS-flex mode: children (original behaviour)
  // ---------------------------------------------------------------------------

  // `orientation` maps to a direction class if `direction` is not explicitly set
  const effectiveDirection = (): FlexDirection | undefined => {
    if (own.direction) return own.direction;
    if (own.orientation) return ORIENTATION_DIR[own.orientation];
    return undefined;
  };

  const classes = () =>
    cn(
      own.inline ? 'inline-flex' : 'flex',
      effectiveDirection() && DIRECTION[effectiveDirection()!],
      own.wrap && WRAP[own.wrap],
      own.align && ALIGN[own.align],
      own.justify && JUSTIFY[own.justify],
      own.class,
    );

  const computed = (): JSX.CSSProperties => {
    const s: JSX.CSSProperties = {};
    if (own.gap !== undefined) s.gap = toGap(own.gap);
    if (own.gapX !== undefined) s['column-gap'] = toGap(own.gapX);
    if (own.gapY !== undefined) s['row-gap'] = toGap(own.gapY);
    return s;
  };

  // Slot is generic over T; the explicit class/style still fight TS because
  // `Omit<ComponentProps<T>, 'as'>` is opaque for an unresolved T. Casting the
  // whole props bag to `any` matches the same shortcut used inside Slot for
  // the `{...others}` spread.
  return (
    <Slot
      {...({
        as: (poly.as as T) ?? ('div' as T),
        class: classes(),
        style: mergeStyle(computed(), own.style) as never,
        ...(others as object),
      } as any)}
    />
  );
};
