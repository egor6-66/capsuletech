import { createEffect, createSignal, type JSX, onCleanup, onMount, Show } from 'solid-js';

const STORAGE_KEY = 'capsule:profiler:dashboard';

interface IPersistedState {
  x: number;
  y: number;
  collapsed: boolean;
  tab?: string;
}

function readState(): Partial<IPersistedState> {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Partial<IPersistedState>) : {};
  } catch {
    return {};
  }
}

function writeState(s: IPersistedState): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* swallow */
  }
}

export interface IProfilerWindowProps {
  children: JSX.Element;
  title?: JSX.Element;
  initialX?: number;
  initialY?: number;
  tabKey?: string;
  onTabPersist?: (tab: string) => void;
}

export function ProfilerWindow(props: IProfilerWindowProps) {
  const persisted = readState();
  const [x, setX] = createSignal(persisted.x ?? props.initialX ?? 15);
  const [y, setY] = createSignal(persisted.y ?? props.initialY ?? 15);
  const [collapsed, setCollapsed] = createSignal(persisted.collapsed ?? false);
  const [dragging, setDragging] = createSignal(false);

  let dragOffsetX = 0;
  let dragOffsetY = 0;

  const persist = () => {
    writeState({ x: x(), y: y(), collapsed: collapsed(), tab: props.tabKey });
  };

  createEffect(() => {
    void x();
    void y();
    void collapsed();
    persist();
  });

  const onPointerDown = (e: PointerEvent) => {
    if ((e.target as HTMLElement).dataset.profilerDragHandle !== 'true') return;
    setDragging(true);
    dragOffsetX = e.clientX - x();
    dragOffsetY = e.clientY - y();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: PointerEvent) => {
    if (!dragging()) return;
    const vw = typeof window !== 'undefined' ? window.innerWidth : 0;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 0;
    const nextX = Math.max(0, Math.min(vw - 100, e.clientX - dragOffsetX));
    const nextY = Math.max(0, Math.min(vh - 30, e.clientY - dragOffsetY));
    setX(nextX);
    setY(nextY);
  };

  const onPointerUp = (e: PointerEvent) => {
    if (!dragging()) return;
    setDragging(false);
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
  };

  onMount(() => {
    if (typeof window === 'undefined') return;
    const clampToViewport = () => {
      setX((cur) => Math.max(0, Math.min(window.innerWidth - 100, cur)));
      setY((cur) => Math.max(0, Math.min(window.innerHeight - 30, cur)));
    };
    window.addEventListener('resize', clampToViewport);
    onCleanup(() => window.removeEventListener('resize', clampToViewport));
  });

  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      style={{
        position: 'fixed',
        left: `${x()}px`,
        top: `${y()}px`,
        'background-color': 'rgba(15, 15, 15, 0.95)',
        color: '#fff',
        'border-radius': '10px',
        'font-size': '11px',
        'z-index': '10000',
        'font-family': 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        'min-width': '280px',
        'max-width': '440px',
        border: '1px solid #333',
        'box-shadow': '0 10px 30px rgba(0,0,0,0.5)',
        'user-select': dragging() ? 'none' : 'auto',
        cursor: dragging() ? 'grabbing' : 'auto',
      }}
    >
      <div
        data-profiler-drag-handle="true"
        style={{
          'font-weight': 'bold',
          padding: '8px 12px',
          'border-bottom': collapsed() ? 'none' : '1px solid #333',
          color: '#00d4ff',
          cursor: 'grab',
          display: 'flex',
          'justify-content': 'space-between',
          'align-items': 'center',
          gap: '8px',
        }}
      >
        <span data-profiler-drag-handle="true">{props.title ?? '🚀 PROFILER'}</span>
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          style={{
            background: 'transparent',
            border: '1px solid #444',
            color: '#aaa',
            'border-radius': '4px',
            padding: '2px 6px',
            cursor: 'pointer',
            'font-family': 'inherit',
            'font-size': '10px',
          }}
        >
          {collapsed() ? '▸' : '▾'}
        </button>
      </div>
      <Show when={!collapsed()}>
        <div style={{ padding: '8px 12px 10px' }}>{props.children}</div>
      </Show>
    </div>
  );
}

export function readPersistedTab(): string | undefined {
  return readState().tab;
}

export function persistTab(tab: string): void {
  const cur = readState();
  writeState({
    x: cur.x ?? 15,
    y: cur.y ?? 15,
    collapsed: cur.collapsed ?? false,
    tab,
  });
}
