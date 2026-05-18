import {
  createDraggable,
  createDroppable,
  createSortable,
  DnDProvider,
  DragOverlay,
} from '@capsuletech/dnd';
import { type LucideProps, MousePointerClick, Package, Rows3, TextCursorInput } from 'lucide-solid';
import { type Component, createSignal, For } from 'solid-js';

interface IPaletteItem {
  type: string;
  category: 'control' | 'layout';
  label: string;
  icon: Component<LucideProps>;
}

const PALETTE: IPaletteItem[] = [
  { type: 'Button', category: 'control', label: 'Button', icon: MousePointerClick },
  { type: 'Input', category: 'control', label: 'Input', icon: TextCursorInput },
  { type: 'Wrapper', category: 'layout', label: 'Wrapper', icon: Package },
  { type: 'Stack', category: 'layout', label: 'Stack', icon: Rows3 },
];

const PaletteItem = (props: { item: IPaletteItem }) => {
  const drag = createDraggable<IPaletteItem & { source: 'palette' }>({
    id: `palette:${props.item.type}`,
    data: () => ({ ...props.item, source: 'palette' }),
  });
  return (
    <div
      ref={drag.ref}
      class="inline-flex items-center gap-2 px-3 py-2 border border-border bg-card rounded-md cursor-grab select-none shadow-sm transition-colors hover:bg-card/70"
      classList={{ 'opacity-40 cursor-grabbing': drag.isDragging() }}
    >
      <props.item.icon size={14} class="text-muted-foreground" />
      <span class="text-sm">{props.item.label}</span>
    </div>
  );
};

const DropZone = (props: {
  id: string;
  category: 'control' | 'layout';
  items: () => string[];
  onAdd: (type: string) => void;
}) => {
  const drop = createDroppable<{ type: string; category: string }>({
    id: props.id,
    accepts: (d) => d.category === props.category,
    onDrop: (d) => props.onAdd(d.type),
  });
  return (
    <div
      ref={drop.ref}
      class="flex-1 min-h-32 p-3 rounded-md border-2 border-dashed transition-colors"
      classList={{
        'border-primary/60 bg-primary/10': drop.canDrop(),
        'border-destructive/60 bg-destructive/10': drop.isOver() && !drop.canDrop(),
        'border-border': !drop.isOver(),
      }}
    >
      <div class="text-xs uppercase tracking-wide text-muted-foreground mb-2">
        Принимает: {props.category}
      </div>
      <div class="flex flex-wrap gap-2">
        <For each={props.items()}>
          {(t) => <span class="px-2 py-1 rounded bg-muted/60 text-sm text-foreground">{t}</span>}
        </For>
      </div>
    </div>
  );
};

const SortableList = () => {
  const [items, setItems] = createSignal(['alpha', 'beta', 'gamma', 'delta']);
  const sortable = createSortable({
    id: 'demo-list',
    items,
    onReorder: setItems,
  });

  return (
    <div class="flex flex-col gap-2 max-w-sm">
      <div class="text-xs uppercase tracking-wide text-muted-foreground">Sortable</div>
      <For each={items()}>
        {(id) => {
          const item = sortable.createItem(id);
          return (
            <div
              ref={item.ref}
              class="px-3 py-2 border border-border rounded-md bg-card cursor-grab select-none transition-colors"
              classList={{
                'opacity-40': item.isDragging(),
                'border-primary/60 bg-primary/10': item.isOver(),
              }}
            >
              {id}
            </div>
          );
        }}
      </For>
    </div>
  );
};

const DnDDemo = Widget(() => {
  const [controls, setControls] = createSignal<string[]>([]);
  const [layouts, setLayouts] = createSignal<string[]>([]);

  return (
    <DnDProvider autoScroll>
      <div class="flex flex-col gap-6 p-6 w-full max-w-4xl">
        <div>
          <div class="text-xs uppercase tracking-wide text-muted-foreground mb-2">Палитра</div>
          <div class="flex gap-2 flex-wrap">
            <For each={PALETTE}>{(item) => <PaletteItem item={item} />}</For>
          </div>
        </div>

        <div class="flex gap-4">
          <DropZone
            id="controls-zone"
            category="control"
            items={controls}
            onAdd={(t) => setControls((p) => [...p, t])}
          />
          <DropZone
            id="layouts-zone"
            category="layout"
            items={layouts}
            onAdd={(t) => setLayouts((p) => [...p, t])}
          />
        </div>

        <SortableList />

        <DragOverlay>
          {(data: any) => (
            <div class="px-3 py-2 border border-border rounded-md bg-card shadow-lg text-card-foreground text-sm">
              {data.label ?? data.itemId ?? data.type ?? '…'}
            </div>
          )}
        </DragOverlay>
      </div>
    </DnDProvider>
  );
});

export default DnDDemo;
