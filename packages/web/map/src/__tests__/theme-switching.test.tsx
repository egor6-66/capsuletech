/* @vitest-environment jsdom */
/**
 * Theme switching tests — unified isDark signal.
 *
 * Verifies:
 * 1. MapView inits with the correct style when body already has `.dark` on mount.
 * 2. MapView inits with the correct style when matchMedia already returns dark.
 * 3. Multiple dark↔light theme switches all trigger setStyle (no stuck state).
 * 4. MutationObserver fires on non-dark class change → does NOT add extra setStyle calls
 *    beyond what is expected (idempotent: same theme → same style).
 * 5. matchMedia 'change' event → triggers correct setStyle via signal.
 * 6. No orphan listeners after multiple mount/unmount cycles.
 */

import { render } from 'solid-js/web';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// maplibre-gl mock
// ---------------------------------------------------------------------------

type LoadHandler = () => void;

interface MockMapInstance {
  once: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
  setStyle: ReturnType<typeof vi.fn>;
  setCenter: ReturnType<typeof vi.fn>;
  setZoom: ReturnType<typeof vi.fn>;
  setBearing: ReturnType<typeof vi.fn>;
  setPitch: ReturnType<typeof vi.fn>;
  setMaxBounds: ReturnType<typeof vi.fn>;
  getCenter: ReturnType<typeof vi.fn>;
  getZoom: ReturnType<typeof vi.fn>;
  getBearing: ReturnType<typeof vi.fn>;
  getPitch: ReturnType<typeof vi.fn>;
  isStyleLoaded: ReturnType<typeof vi.fn>;
  _ctorOptions: unknown;
  _triggerLoad: () => void;
}

let mapInstances: MockMapInstance[] = [];

vi.mock('maplibre-gl', () => {
  const MockMap = vi.fn(function (this: MockMapInstance, options: unknown) {
    const loadHandlers: LoadHandler[] = [];
    this._ctorOptions = options;
    this.once = vi.fn((event: string, handler: LoadHandler) => {
      if (event === 'load') loadHandlers.push(handler);
    });
    this.on = vi.fn();
    this.remove = vi.fn();
    this.setStyle = vi.fn();
    this.setCenter = vi.fn();
    this.setZoom = vi.fn();
    this.setBearing = vi.fn();
    this.setPitch = vi.fn();
    this.setMaxBounds = vi.fn();
    this.getCenter = vi.fn(() => ({ lng: 0, lat: 0 }));
    this.getZoom = vi.fn(() => 10);
    this.getBearing = vi.fn(() => 0);
    this.getPitch = vi.fn(() => 0);
    this.isStyleLoaded = vi.fn(() => false);
    this._triggerLoad = () => {
      for (const h of loadHandlers) h();
    };
    mapInstances.push(this as unknown as MockMapInstance);
  });
  return { default: { Map: MockMap }, Map: MockMap };
});

// ---------------------------------------------------------------------------
// ResizeObserver mock
// ---------------------------------------------------------------------------

type ResizeCallback = (entries: { contentRect: { width: number; height: number } }[]) => void;

interface MockROInstance {
  trigger: (w: number, h: number) => void;
  disconnect: ReturnType<typeof vi.fn>;
  observe: ReturnType<typeof vi.fn>;
}

let roInstances: MockROInstance[] = [];

vi.stubGlobal(
  'ResizeObserver',
  // biome-ignore lint/complexity/useArrowFunction: must be a `function` — arrow functions cannot be used as constructors with `new`
  vi.fn(function (cb: ResizeCallback) {
    const inst: MockROInstance = {
      observe: vi.fn(),
      disconnect: vi.fn(),
      trigger: (w, h) => cb([{ contentRect: { width: w, height: h } }]),
    };
    roInstances.push(inst);
    return inst;
  }),
);

// ---------------------------------------------------------------------------
// matchMedia mock — controllable .matches + listeners
// ---------------------------------------------------------------------------

type MediaChangeHandler = () => void;

let mqListeners: MediaChangeHandler[] = [];
let mqMatches = false;

const mockMQ = {
  get matches() {
    return mqMatches;
  },
  addEventListener: vi.fn((_: string, handler: MediaChangeHandler) => {
    mqListeners.push(handler);
  }),
  removeEventListener: vi.fn((_: string, handler: MediaChangeHandler) => {
    mqListeners = mqListeners.filter((h) => h !== handler);
  }),
};

vi.stubGlobal(
  'matchMedia',
  vi.fn(() => mockMQ),
);

// ---------------------------------------------------------------------------
// MutationObserver mock — controllable callback invocation
// jsdom fires MutationObserver as a microtask (async); stubbing it lets us
// invoke the callback synchronously in tests for deterministic assertions.
// ---------------------------------------------------------------------------

type MutationCallback = () => void;

interface MockMOInstance {
  callback: MutationCallback;
  disconnect: ReturnType<typeof vi.fn>;
  observe: ReturnType<typeof vi.fn>;
}

let moInstances: MockMOInstance[] = [];

vi.stubGlobal(
  'MutationObserver',
  vi.fn(function (this: MockMOInstance, callback: MutationCallback) {
    this.callback = callback;
    this.disconnect = vi.fn();
    this.observe = vi.fn();
    moInstances.push(this);
    return this;
  }),
);

/** Manually fire the MutationObserver callback (simulates body class attribute change). */
function fireMutationObserver(): void {
  for (const mo of moInstances) {
    mo.callback();
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

import { MapView } from '../MapView';
import { DARK_MATTER, POSITRON } from '../styles';

function lastMap(): MockMapInstance {
  return mapInstances[mapInstances.length - 1];
}

function lastRO(): MockROInstance {
  return roInstances[roInstances.length - 1];
}

let container: HTMLDivElement;
let dispose: () => void = () => {};

/**
 * Simulates a body class change and fires the stubbed MutationObserver callback.
 * The callback in MapView reads body.classList and mqMatches to compute isDark.
 */
function toggleBodyDark(dark: boolean): void {
  if (dark) {
    document.body.classList.add('dark');
  } else {
    document.body.classList.remove('dark');
  }
  // Manually trigger the stubbed MutationObserver (real DOM mutation would be async microtask)
  fireMutationObserver();
}

/** Simulates matchMedia 'prefers-color-scheme: dark' change event. */
function fireMediaChange(dark: boolean): void {
  mqMatches = dark;
  for (const h of [...mqListeners]) h();
}

beforeEach(() => {
  mapInstances = [];
  roInstances = [];
  moInstances = [];
  mqListeners = [];
  mqMatches = false;
  vi.clearAllMocks();
  // Re-configure mockMQ listeners after clearAllMocks
  mockMQ.addEventListener = vi.fn((_: string, handler: MediaChangeHandler) => {
    mqListeners.push(handler);
  });
  mockMQ.removeEventListener = vi.fn((_: string, handler: MediaChangeHandler) => {
    mqListeners = mqListeners.filter((h) => h !== handler);
  });
  // Ensure body starts clean
  document.body.classList.remove('dark');
  container = document.createElement('div');
  document.body.appendChild(container);
});

afterEach(() => {
  dispose();
  dispose = () => {};
  document.body.classList.remove('dark');
  document.body.removeChild(container);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MapView — theme init', () => {
  it('starts with POSITRON (light) when no dark signals active', () => {
    dispose = render(() => <MapView />, container);
    lastRO().trigger(800, 600);
    expect((lastMap()._ctorOptions as any).style).toBe(POSITRON);
  });

  it('starts with DARK_MATTER when body.dark class already present before mount', () => {
    toggleBodyDark(true);
    dispose = render(() => <MapView />, container);
    lastRO().trigger(800, 600);
    expect((lastMap()._ctorOptions as any).style).toBe(DARK_MATTER);
  });

  it('starts with DARK_MATTER when matchMedia already returns dark before mount', () => {
    mqMatches = true;
    dispose = render(() => <MapView />, container);
    lastRO().trigger(800, 600);
    expect((lastMap()._ctorOptions as any).style).toBe(DARK_MATTER);
  });

  it('uses custom darkStyle when body.dark is present', () => {
    toggleBodyDark(true);
    dispose = render(() => <MapView darkStyle="https://custom-dark.json" />, container);
    lastRO().trigger(800, 600);
    expect((lastMap()._ctorOptions as any).style).toBe('https://custom-dark.json');
  });
});

describe('MapView — theme switching via body.classList (MutationObserver)', () => {
  it('calls setStyle with DARK_MATTER after body.dark is added', () => {
    dispose = render(() => <MapView />, container);
    lastRO().trigger(800, 600);
    lastMap()._triggerLoad();
    const m = lastMap();
    m.setStyle.mockClear();

    toggleBodyDark(true);
    expect(m.setStyle).toHaveBeenCalledWith(DARK_MATTER);
  });

  it('calls setStyle with POSITRON after body.dark is removed', () => {
    toggleBodyDark(true);
    dispose = render(() => <MapView />, container);
    lastRO().trigger(800, 600);
    lastMap()._triggerLoad();
    const m = lastMap();
    m.setStyle.mockClear();

    toggleBodyDark(false);
    expect(m.setStyle).toHaveBeenCalledWith(POSITRON);
  });

  it('handles 5 consecutive dark↔light switches without getting stuck', () => {
    dispose = render(() => <MapView />, container);
    lastRO().trigger(800, 600);
    lastMap()._triggerLoad();
    const m = lastMap();
    m.setStyle.mockClear();

    for (let i = 0; i < 5; i++) {
      toggleBodyDark(true);
      expect(m.setStyle).toHaveBeenLastCalledWith(DARK_MATTER);
      m.setStyle.mockClear();

      toggleBodyDark(false);
      expect(m.setStyle).toHaveBeenLastCalledWith(POSITRON);
      m.setStyle.mockClear();
    }
  });

  it('non-dark class changes on body do not trigger DARK_MATTER (idempotent light)', () => {
    dispose = render(() => <MapView />, container);
    lastRO().trigger(800, 600);
    lastMap()._triggerLoad();
    const m = lastMap();
    m.setStyle.mockClear();

    // Fire MO without changing dark state (body.dark not set, mqMatches still false)
    // → isDark stays false → resolveStyle() returns POSITRON → may call setStyle(POSITRON) or not
    fireMutationObserver();
    // Must never call setStyle with DARK_MATTER when there's no dark signal
    expect(m.setStyle).not.toHaveBeenCalledWith(DARK_MATTER);
  });
});

describe('MapView — theme switching via matchMedia', () => {
  it('calls setStyle with DARK_MATTER on matchMedia change to dark', () => {
    dispose = render(() => <MapView />, container);
    lastRO().trigger(800, 600);
    lastMap()._triggerLoad();
    const m = lastMap();
    m.setStyle.mockClear();

    fireMediaChange(true);
    expect(m.setStyle).toHaveBeenCalledWith(DARK_MATTER);
  });

  it('calls setStyle with POSITRON on matchMedia change back to light', () => {
    fireMediaChange(true);
    dispose = render(() => <MapView />, container);
    lastRO().trigger(800, 600);
    lastMap()._triggerLoad();
    const m = lastMap();
    m.setStyle.mockClear();

    fireMediaChange(false);
    expect(m.setStyle).toHaveBeenCalledWith(POSITRON);
  });

  it('handles 5 consecutive matchMedia dark↔light cycles without getting stuck', () => {
    dispose = render(() => <MapView />, container);
    lastRO().trigger(800, 600);
    lastMap()._triggerLoad();
    const m = lastMap();
    m.setStyle.mockClear();

    for (let i = 0; i < 5; i++) {
      fireMediaChange(true);
      expect(m.setStyle).toHaveBeenLastCalledWith(DARK_MATTER);
      m.setStyle.mockClear();

      fireMediaChange(false);
      expect(m.setStyle).toHaveBeenLastCalledWith(POSITRON);
      m.setStyle.mockClear();
    }
  });
});

describe('MapView — style prop reactive with theme', () => {
  it('calls setStyle with custom style (not POSITRON) when style prop provided', () => {
    dispose = render(() => <MapView style="https://style-a.json" />, container);
    lastRO().trigger(800, 600);
    expect((lastMap()._ctorOptions as any).style).toBe('https://style-a.json');
  });

  it('theme switch uses custom darkStyle when provided', () => {
    dispose = render(
      () => <MapView style="https://light.json" darkStyle="https://dark.json" />,
      container,
    );
    lastRO().trigger(800, 600);
    lastMap()._triggerLoad();
    const m = lastMap();
    m.setStyle.mockClear();

    toggleBodyDark(true);
    expect(m.setStyle).toHaveBeenCalledWith('https://dark.json');
    m.setStyle.mockClear();

    toggleBodyDark(false);
    expect(m.setStyle).toHaveBeenCalledWith('https://light.json');
  });
});

describe('MapView — theme listener cleanup', () => {
  it('no orphan matchMedia listeners after multiple mount/unmount cycles', () => {
    for (let i = 0; i < 3; i++) {
      const d = render(() => <MapView />, container);
      lastRO().trigger(800, 600);
      lastMap()._triggerLoad();
      d();
    }
    expect(mqListeners).toHaveLength(0);
  });

  it('MutationObserver callback does not call setStyle after unmount (map is undefined)', () => {
    dispose = render(() => <MapView />, container);
    lastRO().trigger(800, 600);
    lastMap()._triggerLoad();
    const m = lastMap();
    dispose();
    dispose = () => {};
    m.setStyle.mockClear();
    // The reactive effect has been disposed, so even if the MO callback fires setIsDark,
    // the createEffect tracking isDark() no longer runs (owner disposed on unmount).
    // Firing the callback should not cause setStyle to be called on the removed map.
    document.body.classList.add('dark');
    fireMutationObserver();
    expect(m.setStyle).not.toHaveBeenCalled();
    document.body.classList.remove('dark');
  });
});
