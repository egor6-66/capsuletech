import { createSignal, type Accessor } from 'solid-js';

export type LayoutMode = 'view' | 'edit';
const STORAGE_KEY = 'capsule-layout-mode';

// Module-level singleton signal. SSR-safe: localStorage read guarded.
const [mode, setMode] = createSignal<LayoutMode>(
  typeof window !== 'undefined'
    ? ((localStorage.getItem(STORAGE_KEY) as LayoutMode | null) ?? 'view')
    : 'view',
);

/**
 * Reactive accessor for layoutMode. Solid tracks reads automatically
 * in createMemo / JSX. Signal initialised once on module-load from
 * localStorage (browser-only guard). Changes via `setLayoutMode(...)`.
 *
 * Storage key: `capsule-layout-mode`.
 */
export const useLayoutMode = (): Accessor<LayoutMode> => mode;

/** Set + persist. */
export const setLayoutMode = (next: LayoutMode): void => {
  setMode(next);
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, next);
  }
};

/** Toggle helper — `view` ⇔ `edit`. */
export const toggleLayoutMode = (): void => {
  setLayoutMode(mode() === 'edit' ? 'view' : 'edit');
};
