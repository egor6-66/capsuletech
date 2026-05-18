import {
  createDraggable,
  createDroppable,
  DnDProvider,
  DragOverlay,
  useDnD,
} from '@capsuletech/dnd';
import {
  addNode,
  createEmptyTree,
  EditorOpError,
  type IEditorTree,
  moveNode,
  type NodeId,
  removeNode,
} from '@capsuletech/editor-state';
import { type ISchema, Renderer } from '@capsuletech/renderer';
import { canAcceptChild, getAllManifests, getManifest } from '@capsuletech/web-manifests';
import { createMemo, createSignal, For, Show } from 'solid-js';

type PaletteDrag = { source: 'palette'; type: string; label: string };
type TreeDrag = { source: 'tree'; nodeId: NodeId; type: string };
type AnyDrag = PaletteDrag | TreeDrag;

const isDescendantOf = (
  tree: IEditorTree,
  maybeAncestor: NodeId,
  nodeId: NodeId | null | undefined,
): boolean => {
  let cur: NodeId | null | undefined = nodeId;
  while (cur) {
    if (cur === maybeAncestor) return true;
    cur = tree.nodes[cur]?.parentId ?? null;
  }
  return false;
};

/** Поиск Y-вставки между прямыми детьми контейнера — для block-уровня drop'а. */
const computeInsertIndex = (containerEl: HTMLElement, pointerY: number): number => {
  const childHeaders = containerEl.querySelectorAll<HTMLElement>(
    ':scope > [data-tree-children] > [data-tree-block] > [data-tree-header]',
  );
  for (let i = 0; i < childHeaders.length; i++) {
    const rect = childHeaders[i].getBoundingClientRect();
    if (pointerY < rect.top + rect.height / 2) return i;
  }
  return childHeaders.length;
};

const computeLineY = (containerEl: HTMLElement, idx: number): number | null => {
  const childHeaders = containerEl.querySelectorAll<HTMLElement>(
    ':scope > [data-tree-children] > [data-tree-block] > [data-tree-header]',
  );
  if (childHeaders.length === 0) {
    const childrenEl = containerEl.querySelector<HTMLElement>(':scope > [data-tree-children]');
    if (!childrenEl) return null;
    return childrenEl.getBoundingClientRect().top + 2;
  }
  if (idx === 0) return childHeaders[0].getBoundingClientRect().top;
  if (idx >= childHeaders.length)
    return childHeaders[childHeaders.length - 1].getBoundingClientRect().bottom;
  const prev = childHeaders[idx - 1].getBoundingClientRect();
  const next = childHeaders[idx].getBoundingClientRect();
  return (prev.bottom + next.top) / 2;
};

interface ITreeRowProps {
  nodeId: NodeId;
  depth: number;
  tree: () => IEditorTree;
  selectedId: () => NodeId | null;
  paletteHover: () => string | null;
  onSelect: (id: NodeId) => void;
  onDrop: (data: AnyDrag, parentId: NodeId, index: number) => void;
}

const TreeRow = (props: ITreeRowProps) => {
  const node = () => props.tree().nodes[props.nodeId];
  const manifest = () => getManifest(node().type);
  const isRoot = () => props.nodeId === props.tree().root;
  const isLeaf = () => !!manifest()?.isLeaf;
  const parent = () => {
    const pid = node().parentId;
    return pid ? props.tree().nodes[pid] : null;
  };

  let blockRef: HTMLElement | undefined;
  let headerRef: HTMLElement | undefined;
  const dnd = useDnD();

  const drag = createDraggable<TreeDrag>({
    id: `tree:${props.nodeId}`,
    data: () => ({ source: 'tree', nodeId: props.nodeId, type: node().type }),
    disabled: isRoot,
  });

  /**
   * Row-уровень drop'а — drop НА сам header (узкая строка). Дробит на 2 зоны:
   * верх / низ. Это даёт sortable-ощущение: тащишь Header → бросаешь на
   * Content → линия выше/ниже Content → вставка перед/после.
   */
  const rowDrop = createDroppable<AnyDrag>({
    id: `row:${props.nodeId}`,
    accepts: (data) => {
      if (isRoot()) return false; // у root нет parent'а для siblings
      const p = parent();
      if (!p) return false;
      if (data.source === 'tree') {
        // self-on-self — допустим (будет no-op), но в свой subtree — нельзя
        if (isDescendantOf(props.tree(), data.nodeId, p.id)) return false;
      }
      return canAcceptChild(p.type, data.type);
    },
    onDrop: (data, info) => {
      if (!headerRef) return;
      const p = parent();
      if (!p) return;
      const rect = headerRef.getBoundingClientRect();
      const ratio = rect.height ? (info.pointer.y - rect.top) / rect.height : 0.5;
      const idx = p.children.indexOf(props.nodeId);
      const insertIndex = ratio < 0.5 ? idx : idx + 1;
      props.onDrop(data, p.id, insertIndex);
    },
  });

  /**
   * Block-уровень drop'а — на всю коробку (header + дети). Срабатывает только
   * когда курсор НЕ над дочерним header'ом (там innermost rowDrop хапает).
   * Покрывает: пустые контейнеры, gap между детьми, «карман» снизу.
   */
  const blockDrop = createDroppable<AnyDrag>({
    id: `block:${props.nodeId}`,
    accepts: (data) => {
      if (isLeaf()) return false;
      if (data.source === 'tree' && isDescendantOf(props.tree(), data.nodeId, props.nodeId)) {
        return false;
      }
      return canAcceptChild(node().type, data.type);
    },
    onDrop: (data, info) => {
      if (!blockRef) return;
      const idx = computeInsertIndex(blockRef, info.pointer.y);
      props.onDrop(data, props.nodeId, idx);
    },
  });

  /** Какая зона row'а сейчас активна (по pointer.y vs header rect). */
  const rowRegion = createMemo<'before' | 'after' | null>(() => {
    if (!rowDrop.isOver() || !rowDrop.canDrop() || !headerRef) return null;
    const p = dnd.state.pointer();
    if (!p) return null;
    const rect = headerRef.getBoundingClientRect();
    return rect.height && p.y >= rect.top + rect.height / 2 ? 'after' : 'before';
  });

  const isContainerOver = createMemo(() => blockDrop.isOver() && blockDrop.canDrop());

  /** Линия для block-drop — относительные координаты внутри блока. */
  const blockLineY = createMemo<number | null>(() => {
    if (!isContainerOver() || !blockRef) return null;
    const p = dnd.state.pointer();
    if (!p) return null;
    const idx = computeInsertIndex(blockRef, p.y);
    const y = computeLineY(blockRef, idx);
    return y === null ? null : y - blockRef.getBoundingClientRect().top;
  });

  /** Зелёная подсветка: «эта нода может принять hover'нутый из палитры тип». */
  const acceptsHoveredPalette = createMemo(() => {
    if (isLeaf()) return false;
    const ph = props.paletteHover();
    if (!ph) return false;
    if (ph === node().type) return false; // сам себя не подсвечиваем — это палитра-узел
    return canAcceptChild(node().type, ph);
  });

  const blockRefSet = (el: HTMLElement) => {
    blockRef = el;
    blockDrop.ref(el);
  };
  const headerRefSet = (el: HTMLElement) => {
    headerRef = el;
    drag.ref(el);
    rowDrop.ref(el);
  };

  return (
    <div
      ref={blockRefSet}
      data-tree-block
      class="relative rounded transition-colors"
      classList={{
        'bg-blue-500/5 ring-1 ring-blue-400/40': isContainerOver(),
      }}
    >
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: drag-based tree row, keyboard sensor — отдельная задача в @capsuletech/dnd */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: drag-based tree row, keyboard sensor — отдельная задача в @capsuletech/dnd */}
      <div
        ref={headerRefSet}
        data-tree-header
        class="relative px-2 py-1 rounded text-sm font-mono cursor-grab select-none transition-colors"
        classList={{
          'opacity-40': drag.isDragging(),
          // Палитра-hover «может попасть сюда» → зелёная подсветка
          'ring-1 ring-emerald-400/60 bg-emerald-500/10': acceptsHoveredPalette(),
          // Selected — серый ring (только если ни drop-target, ни green-accept активны)
          'ring-1 ring-white/40':
            props.selectedId() === props.nodeId &&
            !isContainerOver() &&
            !acceptsHoveredPalette() &&
            !rowRegion(),
          'bg-blue-500/30 text-blue-50': isContainerOver(),
          'hover:bg-white/5':
            !isContainerOver() && !acceptsHoveredPalette() && props.selectedId() !== props.nodeId,
        }}
        style={{ 'padding-left': `${props.depth * 16 + 8}px` }}
        onClick={() => props.onSelect(props.nodeId)}
      >
        <span class="mr-1">{manifest()?.icon() ?? '·'}</span>
        {manifest()?.label ?? node().type}
        <span class="opacity-40 ml-1 text-xs">#{props.nodeId.slice(0, 4)}</span>
        {/* Линия СВЕРХУ row'а (before) */}
        <Show when={rowRegion() === 'before'}>
          <div class="absolute left-0 right-0 -top-px h-1 bg-blue-400 rounded-full pointer-events-none -translate-y-1/2 shadow-[0_0_8px_2px_rgba(96,165,250,0.5)]" />
        </Show>
        {/* Линия СНИЗУ row'а (after) */}
        <Show when={rowRegion() === 'after'}>
          <div class="absolute left-0 right-0 -bottom-px h-1 bg-blue-400 rounded-full pointer-events-none translate-y-1/2 shadow-[0_0_8px_2px_rgba(96,165,250,0.5)]" />
        </Show>
      </div>
      {/* «Карман» снизу детей — без него последний ребёнок упирается в край
          блока и нельзя дропнуть «в конец». */}
      <div data-tree-children class="pb-2">
        <For each={node().children}>
          {(cid) => <TreeRow {...props} nodeId={cid} depth={props.depth + 1} />}
        </For>
      </div>
      {/* Линия для block-drop (gap между детьми, пустой контейнер, конец). */}
      <Show when={blockLineY()}>
        {(y) => (
          <div
            class="absolute left-0 right-0 h-1 bg-blue-400 pointer-events-none rounded-full shadow-[0_0_8px_2px_rgba(96,165,250,0.5)]"
            style={{ top: `${y()}px` }}
          />
        )}
      </Show>
    </div>
  );
};

interface IPaletteItemProps {
  type: string;
  label: string;
  icon: () => any;
  selectedTargetType: () => string | null;
  onHover: (type: string | null) => void;
}

const PaletteItem = (props: IPaletteItemProps) => {
  const drag = createDraggable<PaletteDrag>({
    id: `palette:${props.type}`,
    data: () => ({ source: 'palette', type: props.type, label: props.label }),
  });
  /** «Эту штуку можно вставить в текущий selected-узел дерева» — зелёная подсветка. */
  const canBeAcceptedBySelected = createMemo(() => {
    const t = props.selectedTargetType();
    if (!t) return false;
    return canAcceptChild(t, props.type);
  });
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: drag palette item — pointer-only interaction, keyboard accessibility tracked in @capsuletech/dnd
    <div
      ref={drag.ref}
      class="px-2 py-1 border rounded text-sm cursor-grab select-none transition-colors"
      classList={{
        'border-emerald-400/70 bg-emerald-500/10': canBeAcceptedBySelected(),
        'border-white/20 hover:bg-white/5': !canBeAcceptedBySelected(),
        'opacity-40': drag.isDragging(),
      }}
      onMouseEnter={() => props.onHover(props.type)}
      onMouseLeave={() => props.onHover(null)}
    >
      {props.icon()} {props.label}
    </div>
  );
};

const EditorState = Widget((Ui) => {
  const [tree, setTree] = createSignal<IEditorTree>(createEmptyTree('ui.Card'));
  const [selectedId, setSelectedId] = createSignal<NodeId | null>(null);
  const [paletteHover, setPaletteHover] = createSignal<string | null>(null);
  const [errorMsg, setErrorMsg] = createSignal<string | null>(null);

  /** Тип выбранной ноды — для подсветки палитры. */
  const selectedTargetType = () => {
    const sid = selectedId();
    if (!sid) return null;
    return tree().nodes[sid]?.type ?? null;
  };

  const run = (fn: () => void) => {
    try {
      fn();
      setErrorMsg(null);
    } catch (err) {
      if (err instanceof EditorOpError) setErrorMsg(err.message);
      else throw err;
    }
  };

  const onDrop = (data: AnyDrag, parentId: NodeId, index: number) => {
    if (data.source === 'palette') {
      run(() => {
        const r = addNode(tree(), { type: data.type, parentId, index });
        setTree(r.tree);
      });
    } else {
      run(() => {
        setTree(moveNode(tree(), { nodeId: data.nodeId, newParentId: parentId, index }));
      });
    }
  };

  const onRemove = () => {
    const id = selectedId();
    if (!id || id === tree().root) return;
    run(() => {
      setTree(removeNode(tree(), { nodeId: id }));
      setSelectedId(null);
    });
  };

  const previewSchema = createMemo<ISchema>(() => ({
    components: { root: tree().root, nodes: tree().nodes },
  }));

  return (
    <DnDProvider autoScroll>
      <div class="flex flex-col gap-4 p-6 w-full max-w-6xl">
        <div class="flex gap-2 flex-wrap items-center">
          <span class="text-sm opacity-60 mr-2">Палитра (drag):</span>
          <For each={getAllManifests().filter((m) => !m.isLeaf || m.category === 'control')}>
            {(m) => (
              <PaletteItem
                type={m.type}
                label={m.label}
                icon={m.icon}
                selectedTargetType={selectedTargetType}
                onHover={setPaletteHover}
              />
            )}
          </For>
          <div class="grow" />
          <button
            type="button"
            class="px-3 py-1 border border-white/20 rounded text-sm disabled:opacity-40 hover:bg-white/5"
            disabled={!selectedId() || selectedId() === tree().root}
            onClick={onRemove}
          >
            🗑 Удалить
          </button>
        </div>

        <Show when={errorMsg()}>
          <div class="text-sm text-red-300 px-3 py-2 rounded border border-red-500/40 bg-red-500/10">
            {errorMsg()}
          </div>
        </Show>

        <div class="grid grid-cols-[320px_1fr] gap-4 min-h-[400px]">
          <div class="border border-white/20 rounded p-2">
            <div class="text-xs uppercase tracking-wide opacity-60 mb-2 px-2">Tree</div>
            <TreeRow
              nodeId={tree().root}
              depth={0}
              tree={tree}
              selectedId={selectedId}
              paletteHover={paletteHover}
              onSelect={setSelectedId}
              onDrop={onDrop}
            />
          </div>
          <div class="border border-white/20 rounded p-4 min-h-[400px] relative">
            <div class="text-xs uppercase tracking-wide opacity-60 mb-2">Preview</div>
            <Show
              when={tree().nodes[tree().root]?.children.length}
              fallback={
                <div class="text-sm opacity-40 italic">
                  Перетащите компонент из палитры в дерево слева
                </div>
              }
            >
              <Renderer schema={previewSchema()} registry={{ ui: Ui }} mode="static" />
            </Show>
          </div>
        </div>

        <DragOverlay>
          {(data: any) => (
            <div class="px-2 py-1 border border-white/30 rounded text-sm shadow-xl bg-black/80 text-white">
              {data.label ?? `${data.type ?? '…'}`}
            </div>
          )}
        </DragOverlay>
      </div>
    </DnDProvider>
  );
});

export default EditorState;
