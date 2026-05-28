/* @vitest-environment jsdom */
/**
 * MapView — ResizeObserver-gated mount + memory cleanup tests.
 *
 * Strategy: mock `maplibre-gl` entirely (WebGL unavailable in jsdom).
 * The mock exposes constructor spy + method spies so we can assert:
 *   - when Map is constructed (ResizeObserver gate),
 *   - which setters are called after 'load',
 *   - that map.remove() and all listeners are cleaned up on unmount.
 */

import { render } from 'solid-js/web';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// maplibre-gl mock
// ---------------------------------------------------------------------------

type LoadHandler = () => void;
type MoveEndHandler = () => void;

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
  _triggerLoad: () => void;
  _triggerMoveEnd: () => void;
}

let mapInstances: MockMapInstance[] = [];

vi.mock('maplibre-gl', () => {
  const MockMap = vi.fn(function (this: MockMapInstance, _options: unknown) {
    const loadHandlers: LoadHandler[] = [];
    const moveEndHandlers: MoveEndHandler[] = [];

    this.once = vi.fn((event: string, handler: LoadHandler) => {
      if (event === 'load') loadHandlers.push(handler);
    });
    this.on = vi.fn((event: string, handler: MoveEndHandler) => {
      if (event === 'moveend') moveEndHandlers.push(handler);
    });
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
    this._triggerLoad = () => {
      for (const h of loadHandlers) h();
    };
    this._triggerMoveEnd = () => {
      for (const h of moveEndHandlers) h();
    };

    mapInstances.push(this as unknown as MockMapInstance);
  });

  return {
    default: { Map: MockMap },
    Map: MockMap,
  };
});

// ---------------------------------------------------------------------------
// ResizeObserver mock
// ---------------------------------------------------------------------------

type ResizeCallback = (entries: { contentRect: { width: number; height: number } }[]) => void;

interface MockROInstance {
  callback: ResizeCallback;
  disconnect: ReturnType<typeof vi.fn>;
  observe: ReturnType<typeof vi.fn>;
  trigger: (w: number, h: number) => void;
}

let roInstances: MockROInstance[] = [];

vi.stubGlobal(
  'ResizeObserver',
  // biome-ignore lint/complexity/useArrowFunction: must be a `function` — arrow functions cannot be used as constructors with `new`
  vi.fn(function (callback: ResizeCallback) {
    const inst: MockROInstance = {
      callback,
      disconnect: vi.fn(),
      observe: vi.fn(),
      trigger: (w, h) => callback([{ contentRect: { width: w, height: h } }]),
    };
    roInstances.push(inst);
    return inst;
  }),
);

// ---------------------------------------------------------------------------
// matchMedia mock
// ---------------------------------------------------------------------------

type MediaChangeHandler = () => void;

let mqListeners: MediaChangeHandler[] = [];

const mockMQ = {
  matches: false,
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
// Test helpers
// ---------------------------------------------------------------------------

import { MapView } from '../MapView';

function lastMap(): MockMapInstance {
  return mapInstances[mapInstances.length - 1];
}

function lastRO(): MockROInstance {
  return roInstances[roInstances.length - 1];
}

let container: HTMLDivElement;
let dispose: () => void = () => {};

beforeEach(() => {
  mapInstances = [];
  roInstances = [];
  mqListeners = [];
  vi.clearAllMocks();
  // Re-configure mockMQ listeners after clearAllMocks
  mockMQ.addEventListener = vi.fn((_: string, handler: MediaChangeHandler) => {
    mqListeners.push(handler);
  });
  mockMQ.removeEventListener = vi.fn((_: string, handler: MediaChangeHandler) => {
    mqListeners = mqListeners.filter((h) => h !== handler);
  });
  container = document.createElement('div');
  document.body.appendChild(container);
});

afterEach(() => {
  dispose();
  dispose = () => {};
  document.body.removeChild(container);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MapView — ResizeObserver-gated mount', () => {
  it('does NOT call new Map() when container is 0x0 on mount', () => {
    dispose = render(() => <MapView />, container);
    // ResizeObserver created but no size > 0 reported yet
    expect(mapInstances).toHaveLength(0);
  });

  it('calls new Map() after ResizeObserver fires with size > 0', () => {
    dispose = render(() => <MapView />, container);
    expect(mapInstances).toHaveLength(0);
    lastRO().trigger(800, 600);
    expect(mapInstances).toHaveLength(1);
  });

  it('does NOT re-initialize on subsequent ResizeObserver entries', () => {
    dispose = render(() => <MapView />, container);
    lastRO().trigger(800, 600);
    lastRO().trigger(1024, 768); // second resize
    expect(mapInstances).toHaveLength(1);
  });

  it('ignores ResizeObserver entries with zero width', () => {
    dispose = render(() => <MapView />, container);
    lastRO().trigger(0, 600);
    expect(mapInstances).toHaveLength(0);
  });

  it('ignores ResizeObserver entries with zero height', () => {
    dispose = render(() => <MapView />, container);
    lastRO().trigger(800, 0);
    expect(mapInstances).toHaveLength(0);
  });
});

describe('MapView — initial camera props set after load', () => {
  it('sets center/zoom/bearing/pitch/maxBounds after load event', () => {
    const center: [number, number] = [37.6, 55.75];
    dispose = render(
      () => (
        <MapView
          center={center}
          zoom={10}
          bearing={45}
          pitch={30}
          maxBounds={[-180, -90, 180, 90] as any}
        />
      ),
      container,
    );
    lastRO().trigger(800, 600);
    const m = lastMap();
    // Before load: initial setters not called yet (createEffect hasn't fired because map() is undefined)
    expect(m.setCenter).not.toHaveBeenCalled();

    m._triggerLoad();
    expect(m.setCenter).toHaveBeenCalledWith(center);
    expect(m.setZoom).toHaveBeenCalledWith(10);
    expect(m.setBearing).toHaveBeenCalledWith(45);
    expect(m.setPitch).toHaveBeenCalledWith(30);
    expect(m.setMaxBounds).toHaveBeenCalledWith([-180, -90, 180, 90]);
  });

  it('does not call setCenter/setZoom if props are undefined', () => {
    dispose = render(() => <MapView />, container);
    lastRO().trigger(800, 600);
    lastMap()._triggerLoad();
    const m = lastMap();
    expect(m.setCenter).not.toHaveBeenCalled();
    expect(m.setZoom).not.toHaveBeenCalled();
  });

  it('fires onLoad callback after load event', () => {
    const onLoad = vi.fn();
    dispose = render(() => <MapView onLoad={onLoad} />, container);
    lastRO().trigger(800, 600);
    expect(onLoad).not.toHaveBeenCalled();
    lastMap()._triggerLoad();
    expect(onLoad).toHaveBeenCalledTimes(1);
  });
});

describe('MapView — memory cleanup', () => {
  it('calls map.remove() on unmount', () => {
    dispose = render(() => <MapView />, container);
    lastRO().trigger(800, 600);
    lastMap()._triggerLoad();
    const m = lastMap();
    expect(m.remove).not.toHaveBeenCalled();
    dispose();
    dispose = () => {};
    expect(m.remove).toHaveBeenCalledTimes(1);
  });

  it('disconnects ResizeObserver on cleanup even when map never initialised', () => {
    dispose = render(() => <MapView />, container);
    const ro = lastRO();
    // No resize fired — map never created
    expect(mapInstances).toHaveLength(0);
    dispose();
    dispose = () => {};
    expect(ro.disconnect).toHaveBeenCalledTimes(1);
  });

  it('disconnects ResizeObserver on cleanup after map initialised', () => {
    dispose = render(() => <MapView />, container);
    const ro = lastRO();
    ro.trigger(800, 600);
    lastMap()._triggerLoad();
    dispose();
    dispose = () => {};
    // disconnect() is called once during init (to stop observing after first valid size)
    // and once more in onCleanup as a safety guard — both are correct.
    expect(ro.disconnect).toHaveBeenCalled();
  });

  it('removes matchMedia listener on unmount — no orphaned listeners', () => {
    dispose = render(() => <MapView />, container);
    lastRO().trigger(800, 600);
    lastMap()._triggerLoad();

    // One listener registered during onMount
    expect(mockMQ.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    expect(mqListeners).toHaveLength(1);

    dispose();
    dispose = () => {};

    // removeEventListener must have been called, leaving no registered listeners
    expect(mockMQ.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    expect(mqListeners).toHaveLength(0);
  });

  it('multiple mount/unmount cycles do not accumulate matchMedia listeners', () => {
    for (let i = 0; i < 3; i++) {
      const d = render(() => <MapView />, container);
      lastRO().trigger(800, 600);
      lastMap()._triggerLoad();
      d(); // unmount
    }
    // After each unmount the listener was removed; 0 remain
    expect(mqListeners).toHaveLength(0);
    // Three separate Map instances, each removed exactly once
    expect(mapInstances).toHaveLength(3);
    for (const m of mapInstances) {
      expect(m.remove).toHaveBeenCalledTimes(1);
    }
  });
});

describe('MapView — onViewportChange', () => {
  it('emits viewport after moveend', () => {
    const onViewportChange = vi.fn();
    dispose = render(() => <MapView onViewportChange={onViewportChange} />, container);
    lastRO().trigger(800, 600);
    const m = lastMap();
    m._triggerLoad();
    m.getCenter.mockReturnValue({ lng: 30, lat: 50 });
    m.getZoom.mockReturnValue(8);
    m.getBearing.mockReturnValue(0);
    m.getPitch.mockReturnValue(0);
    m._triggerMoveEnd();
    expect(onViewportChange).toHaveBeenCalledWith({
      center: [30, 50],
      zoom: 8,
      bearing: 0,
      pitch: 0,
    });
  });
});
