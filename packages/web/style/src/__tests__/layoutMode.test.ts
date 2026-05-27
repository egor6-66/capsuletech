import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// localStorage mock — must be set up BEFORE importing the module because the
// module reads localStorage at module-initialisation time.
// ---------------------------------------------------------------------------

const localStorageStore: Record<string, string> = {};

const localStorageMock = {
  getItem: vi.fn((key: string) => localStorageStore[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    localStorageStore[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete localStorageStore[key];
  }),
  clear: vi.fn(() => {
    for (const k of Object.keys(localStorageStore)) delete localStorageStore[k];
  }),
};

// Patch globalThis so `typeof window !== 'undefined'` is true and
// localStorage calls hit our mock.
vi.stubGlobal('window', { localStorage: localStorageMock });
vi.stubGlobal('localStorage', localStorageMock);

// ---------------------------------------------------------------------------
// Import module AFTER stubs are in place.
// ---------------------------------------------------------------------------

// Re-import helpers each test via dynamic import + vi.resetModules to reset
// the module-level signal state.
async function loadModule() {
  const mod = await import('../switcher/layoutMode');
  return mod;
}

describe('useLayoutMode / setLayoutMode / toggleLayoutMode', () => {
  beforeEach(() => {
    vi.resetModules();
    localStorageMock.clear();
    localStorageMock.getItem.mockClear();
    localStorageMock.setItem.mockClear();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('defaults to "view" when localStorage is empty', async () => {
    const { useLayoutMode } = await loadModule();
    expect(useLayoutMode()()).toBe('view');
  });

  it('reads initial value from localStorage', async () => {
    localStorageStore['capsule-layout-mode'] = 'edit';
    const { useLayoutMode } = await loadModule();
    expect(useLayoutMode()()).toBe('edit');
  });

  it('setLayoutMode updates the signal', async () => {
    const { useLayoutMode, setLayoutMode } = await loadModule();
    expect(useLayoutMode()()).toBe('view');
    setLayoutMode('edit');
    expect(useLayoutMode()()).toBe('edit');
  });

  it('setLayoutMode persists to localStorage', async () => {
    const { setLayoutMode } = await loadModule();
    setLayoutMode('edit');
    expect(localStorageMock.setItem).toHaveBeenCalledWith('capsule-layout-mode', 'edit');
  });

  it('toggleLayoutMode flips view → edit', async () => {
    const { useLayoutMode, toggleLayoutMode } = await loadModule();
    expect(useLayoutMode()()).toBe('view');
    toggleLayoutMode();
    expect(useLayoutMode()()).toBe('edit');
  });

  it('toggleLayoutMode flips edit → view', async () => {
    const { useLayoutMode, setLayoutMode, toggleLayoutMode } = await loadModule();
    setLayoutMode('edit');
    toggleLayoutMode();
    expect(useLayoutMode()()).toBe('view');
  });

  it('toggleLayoutMode persists the toggled value', async () => {
    const { toggleLayoutMode } = await loadModule();
    toggleLayoutMode();
    expect(localStorageMock.setItem).toHaveBeenLastCalledWith('capsule-layout-mode', 'edit');
    toggleLayoutMode();
    expect(localStorageMock.setItem).toHaveBeenLastCalledWith('capsule-layout-mode', 'view');
  });
});
