import {
  type Accessor,
  type Component,
  Show,
  createContext,
  createMemo,
  createSignal,
  useContext,
} from 'solid-js';
import { Portal } from 'solid-js/web';
import { createWindowAutoScroll } from './autoScroll';
import type {
  DragData,
  DraggableId,
  DroppableId,
  IDnDProviderProps,
  IDraggableEntry,
  IDropInfo,
  IDroppableEntry,
  IPoint,
} from './types';

interface IDnDContext {
  state: {
    activeId: Accessor<DraggableId | null>;
    activeData: Accessor<DragData | null>;
    pointer: Accessor<IPoint | null>;
    overId: Accessor<DroppableId | null>;
    canDrop: Accessor<boolean>;
  };
  registerDraggable: (entry: IDraggableEntry) => () => void;
  registerDroppable: (entry: IDroppableEntry) => () => void;
  startDrag: (id: DraggableId, e: PointerEvent) => void;
}

const Ctx = createContext<IDnDContext>();

/**
 * Minimal built-in drag ghost rendered when `showDefaultOverlay` is true.
 * Renders a small semi-transparent pill at the cursor position so the user
 * has visual confirmation that a drag is in progress.
 * Consumers who need a richer preview should use <DragOverlay> directly.
 */
const DefaultDragOverlay = (innerProps: {
  pointer: Accessor<IPoint | null>;
  activeData: Accessor<DragData | null>;
}) => (
  <Show when={innerProps.activeData() && innerProps.pointer()}>
    <Portal>
      <div
        style={{
          position: 'fixed',
          left: `${innerProps.pointer()!.x}px`,
          top: `${innerProps.pointer()!.y}px`,
          transform: 'translate(-50%, -50%)',
          width: '48px',
          height: '48px',
          'border-radius': '8px',
          background: 'rgba(99,102,241,0.35)',
          border: '2px solid rgba(99,102,241,0.7)',
          'pointer-events': 'none',
          'z-index': '9999',
          'backdrop-filter': 'blur(2px)',
        }}
      />
    </Portal>
  </Show>
);

export const useDnD = (): IDnDContext => {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error('[@capsuletech/dnd] useDnD must be used inside <DnDProvider>');
  }
  return ctx;
};

export const DnDProvider: Component<IDnDProviderProps> = (props) => {
  const [activeId, setActiveId] = createSignal<DraggableId | null>(null);
  const [activeData, setActiveData] = createSignal<DragData | null>(null);
  const [pointer, setPointer] = createSignal<IPoint | null>(null);
  const [overId, setOverId] = createSignal<DroppableId | null>(null);

  // Не реактивные реестры — изменения не должны триггерить ре-рендер всех
  // потребителей контекста. Реактивность отдельных полей даёт signals выше.
  const draggables = new Map<DraggableId, IDraggableEntry>();
  const droppables = new Map<DroppableId, IDroppableEntry>();
  const elToDroppableId = new WeakMap<HTMLElement, DroppableId>();

  // No pointer capture state needed — we use window-level listeners exclusively.
  // setPointerCapture was removed because it redirects document.elementFromPoint
  // to always return the captured element, breaking droppable hit-testing during
  // a drag started externally (e.g. from DragBadge calling dnd.startDrag).
  // Window-level pointermove/pointerup cover all cases without this side-effect.

  const findDroppableAt = (x: number, y: number): IDroppableEntry | null => {
    let el = document.elementFromPoint(x, y) as HTMLElement | null;
    while (el) {
      const id = elToDroppableId.get(el);
      if (id) return droppables.get(id) ?? null;
      el = el.parentElement;
    }
    return null;
  };

  const canDrop = createMemo(() => {
    const data = activeData();
    const oid = overId();
    if (!data || !oid) return false;
    const drop = droppables.get(oid);
    if (!drop) return false;
    return drop.accepts(data);
  });

  const onPointerMove = (e: PointerEvent) => {
    setPointer({ x: e.clientX, y: e.clientY });
    const drop = findDroppableAt(e.clientX, e.clientY);
    setOverId(drop?.id ?? null);
  };

  const onPointerUp = (e: PointerEvent) => {
    const data = activeData();
    const id = activeId();
    if (!data || !id) {
      cleanup();
      return;
    }
    const drop = findDroppableAt(e.clientX, e.clientY);
    if (drop?.accepts(data)) {
      const rect = drop.el.getBoundingClientRect();
      const info: IDropInfo = {
        draggableId: id,
        droppableId: drop.id,
        pointer: { x: e.clientX, y: e.clientY },
        ratio: {
          x: rect.width ? (e.clientX - rect.left) / rect.width : 0,
          y: rect.height ? (e.clientY - rect.top) / rect.height : 0,
        },
      };
      drop.onDrop?.(data, info);
      props.onDragEnd?.({ kind: 'drop', data, info });
    } else {
      props.onDragEnd?.({ kind: 'cancel', data, draggableId: id });
    }
    cleanup();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return;
    const data = activeData();
    const id = activeId();
    if (data && id) {
      props.onDragEnd?.({ kind: 'cancel', data, draggableId: id });
    }
    cleanup();
  };

  const cleanup = () => {
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointercancel', onPointerUp);
    window.removeEventListener('keydown', onKeyDown);
    setActiveId(null);
    setActiveData(null);
    setPointer(null);
    setOverId(null);
  };

  const startDrag = (id: DraggableId, e: PointerEvent) => {
    const entry = draggables.get(id);
    if (!entry) return;
    // Do NOT call setPointerCapture here. Pointer capture redirects
    // document.elementFromPoint to always return the captured element,
    // which breaks droppable hit-testing in findDroppableAt. Window-level
    // listeners are sufficient to track pointermove/up regardless of what
    // element the user is physically hovering.
    const data = entry.data();
    setActiveId(id);
    setActiveData(data);
    setPointer({ x: e.clientX, y: e.clientY });
    props.onDragStart?.(data, id);

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    window.addEventListener('keydown', onKeyDown);
  };

  // Auto-scroll по краям viewport. Активен только при активном drag'е, если
  // включено через `<DnDProvider autoScroll>`.
  if (props.autoScroll) {
    createWindowAutoScroll(pointer, () => activeId() !== null);
  }

  const api: IDnDContext = {
    state: { activeId, activeData, pointer, overId, canDrop },
    registerDraggable: (entry) => {
      draggables.set(entry.id, entry);
      return () => {
        draggables.delete(entry.id);
      };
    },
    registerDroppable: (entry) => {
      droppables.set(entry.id, entry);
      elToDroppableId.set(entry.el, entry.id);
      return () => {
        droppables.delete(entry.id);
        elToDroppableId.delete(entry.el);
      };
    },
    startDrag,
  };

  return (
    <Ctx.Provider value={api}>
      {props.children}
      <Show when={props.showDefaultOverlay}>
        <DefaultDragOverlay pointer={pointer} activeData={activeData} />
      </Show>
    </Ctx.Provider>
  );
};
