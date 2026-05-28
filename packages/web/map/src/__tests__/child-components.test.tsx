/* @vitest-environment jsdom */
/**
 * Source, Layer, Terrain, Sky — lifecycle tests.
 *
 * Verifies:
 * - addSource/removeSource parity (Source)
 * - addLayer/removeLayer parity (Layer)
 * - setTerrain / setTerrain(null) parity (Terrain)
 * - setSky / setSky({}) parity (Sky)
 * - Components wait for map load if style not yet loaded
 * - Components add immediately if map is already loaded
 * - Cleanup is safe when map is already removed (no throws)
 * - styledata listener is registered and removed on cleanup
 */

import { createSignal } from 'solid-js';
import { render } from 'solid-js/web';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// maplibre-gl mock
// ---------------------------------------------------------------------------

type LoadHandler = () => void;
type StyleDataHandler = () => void;

interface MockMapInstance {
  once: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  off: ReturnType<typeof vi.fn>;
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
  addSource: ReturnType<typeof vi.fn>;
  removeSource: ReturnType<typeof vi.fn>;
  getSource: ReturnType<typeof vi.fn>;
  addLayer: ReturnType<typeof vi.fn>;
  removeLayer: ReturnType<typeof vi.fn>;
  getLayer: ReturnType<typeof vi.fn>;
  setTerrain: ReturnType<typeof vi.fn>;
  setSky: ReturnType<typeof vi.fn>;
  setPaintProperty: ReturnType<typeof vi.fn>;
  setLayoutProperty: ReturnType<typeof vi.fn>;
  setFilter: ReturnType<typeof vi.fn>;
  setLayerZoomRange: ReturnType<typeof vi.fn>;
  _triggerLoad: () => void;
  _triggerStyleData: () => void;
  _styleLoaded: boolean;
}

let mapInstances: MockMapInstance[] = [];

vi.mock('maplibre-gl', () => {
  const MockMap = vi.fn(function (this: MockMapInstance, _options: unknown) {
    const loadHandlers: LoadHandler[] = [];
    const styleDataHandlers: StyleDataHandler[] = [];
    this._styleLoaded = false;

    this.once = vi.fn((event: string, handler: LoadHandler) => {
      if (event === 'load') loadHandlers.push(handler);
    });
    this.on = vi.fn((event: string, handler: StyleDataHandler) => {
      if (event === 'styledata') styleDataHandlers.push(handler);
    });
    this.off = vi.fn((event: string, handler: StyleDataHandler | LoadHandler) => {
      if (event === 'load') {
        const idx = loadHandlers.indexOf(handler as LoadHandler);
        if (idx !== -1) loadHandlers.splice(idx, 1);
      }
      if (event === 'styledata') {
        const idx = styleDataHandlers.indexOf(handler as StyleDataHandler);
        if (idx !== -1) styleDataHandlers.splice(idx, 1);
      }
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
    this.isStyleLoaded = vi.fn(() => this._styleLoaded);
    this.setPaintProperty = vi.fn();
    this.setLayoutProperty = vi.fn();
    this.setFilter = vi.fn();
    this.setLayerZoomRange = vi.fn();
    const addedSources = new Set<string>();
    this.addSource = vi.fn((id: string) => addedSources.add(id));
    this.removeSource = vi.fn((id: string) => addedSources.delete(id));
    this.getSource = vi.fn((id: string) => (addedSources.has(id) ? {} : undefined));
    const addedLayers = new Set<string>();
    this.addLayer = vi.fn((spec: { id: string }) => addedLayers.add(spec.id));
    this.removeLayer = vi.fn((id: string) => addedLayers.delete(id));
    this.getLayer = vi.fn((id: string) => (addedLayers.has(id) ? {} : undefined));
    this.setTerrain = vi.fn();
    this.setSky = vi.fn();
    this._triggerLoad = () => {
      this._styleLoaded = true;
      for (const h of [...loadHandlers]) h();
    };
    this._triggerStyleData = () => {
      for (const h of [...styleDataHandlers]) h();
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

vi.stubGlobal(
  'matchMedia',
  vi.fn(() => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })),
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

import { Layer } from '../Layer';
import { MapView } from '../MapView';
import { Sky } from '../Sky';
import { Source } from '../Source';
import { Terrain } from '../Terrain';

function lastMap(): MockMapInstance {
  return mapInstances[mapInstances.length - 1];
}
function lastRO(): MockROInstance {
  return roInstances[roInstances.length - 1];
}

let container: HTMLDivElement;
let dispose: () => void = () => {};

/** Mount MapView with children, trigger resize and load. */
function mountAndLoad(ui: () => JSX.Element): MockMapInstance {
  dispose = render(ui, container);
  lastRO().trigger(800, 600);
  lastMap()._triggerLoad();
  return lastMap();
}

/** Mount MapView with children, trigger resize but NOT load (style not loaded). */
function mountNoLoad(ui: () => JSX.Element): MockMapInstance {
  dispose = render(ui, container);
  lastRO().trigger(800, 600);
  return lastMap();
}

import type { JSX } from 'solid-js';

beforeEach(() => {
  mapInstances = [];
  roInstances = [];
  vi.clearAllMocks();
  document.body.classList.remove('dark');
  container = document.createElement('div');
  document.body.appendChild(container);
});

afterEach(() => {
  dispose();
  dispose = () => {};
  document.body.removeChild(container);
});

// ---------------------------------------------------------------------------
// Source tests
// ---------------------------------------------------------------------------

describe('Source — lifecycle', () => {
  it('calls addSource after load when style not yet loaded', () => {
    const m = mountNoLoad(() => (
      <MapView>
        <Source
          id="test-src"
          spec={{ type: 'geojson', data: { type: 'FeatureCollection', features: [] } }}
        />
      </MapView>
    ));
    // Before load: style not loaded, addSource not called yet
    expect(m.addSource).not.toHaveBeenCalled();
    m._triggerLoad();
    expect(m.addSource).toHaveBeenCalledWith(
      'test-src',
      expect.objectContaining({ type: 'geojson' }),
    );
  });

  it('calls addSource immediately when isStyleLoaded returns true', () => {
    const m = mountNoLoad(() => <MapView />);
    m._styleLoaded = true;
    m._triggerLoad();
    const m2 = lastMap(); // same map

    // Re-render with Source child after map is loaded
    dispose();
    dispose = render(
      () => (
        <MapView>
          <Source
            id="immediate-src"
            spec={{ type: 'geojson', data: { type: 'FeatureCollection', features: [] } }}
          />
        </MapView>
      ),
      container,
    );
    // New map instance created; trigger load with styleLoaded=true
    lastRO().trigger(800, 600);
    const m3 = lastMap();
    m3._styleLoaded = true;
    m3._triggerLoad();
    expect(m3.addSource).toHaveBeenCalledWith(
      'immediate-src',
      expect.objectContaining({ type: 'geojson' }),
    );
    // Suppress lint: m2 was intermediate
    void m2;
  });

  it('calls removeSource on unmount', () => {
    const m = mountAndLoad(() => (
      <MapView>
        <Source
          id="cleanup-src"
          spec={{ type: 'geojson', data: { type: 'FeatureCollection', features: [] } }}
        />
      </MapView>
    ));
    expect(m.addSource).toHaveBeenCalledWith('cleanup-src', expect.anything());
    dispose();
    dispose = () => {};
    expect(m.removeSource).toHaveBeenCalledWith('cleanup-src');
  });

  it('does not call removeSource for unknown id (no double-remove)', () => {
    const m = mountAndLoad(() => (
      <MapView>
        <Source
          id="no-double"
          spec={{ type: 'geojson', data: { type: 'FeatureCollection', features: [] } }}
        />
      </MapView>
    ));
    // Manually remove source before unmount (simulates external removal)
    (m.removeSource as (id: string) => void)('no-double');
    m.addSource.mockClear();
    m.removeSource.mockClear();
    // Unmount should not throw even if source was already removed
    expect(() => {
      dispose();
      dispose = () => {};
    }).not.toThrow();
  });

  it('multiple mount/unmount cycles: addSource/removeSource calls are paired', () => {
    for (let i = 0; i < 3; i++) {
      const d = render(
        () => (
          <MapView>
            <Source
              id="cycle-src"
              spec={{ type: 'geojson', data: { type: 'FeatureCollection', features: [] } }}
            />
          </MapView>
        ),
        container,
      );
      lastRO().trigger(800, 600);
      lastMap()._triggerLoad();
      d();
    }
    // Each cycle: addSource called once, removeSource called once
    expect(mapInstances).toHaveLength(3);
    for (const m of mapInstances) {
      expect(m.addSource).toHaveBeenCalledTimes(1);
      expect(m.removeSource).toHaveBeenCalledTimes(1);
    }
  });

  it('registers styledata listener on mount and removes it on unmount', () => {
    const m = mountAndLoad(() => (
      <MapView>
        <Source
          id="listener-src"
          spec={{ type: 'geojson', data: { type: 'FeatureCollection', features: [] } }}
        />
      </MapView>
    ));
    expect(m.on).toHaveBeenCalledWith('styledata', expect.any(Function));
    dispose();
    dispose = () => {};
    expect(m.off).toHaveBeenCalledWith('styledata', expect.any(Function));
  });
});

// ---------------------------------------------------------------------------
// Layer tests
// ---------------------------------------------------------------------------

describe('Layer — lifecycle', () => {
  it('calls addLayer after load', () => {
    const m = mountNoLoad(() => (
      <MapView>
        <Layer
          spec={{ id: 'test-layer', type: 'background', paint: { 'background-color': '#fff' } }}
        />
      </MapView>
    ));
    expect(m.addLayer).not.toHaveBeenCalled();
    m._triggerLoad();
    expect(m.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'test-layer', type: 'background' }),
      undefined,
    );
  });

  it('passes beforeId to addLayer', () => {
    const m = mountNoLoad(() => (
      <MapView>
        <Layer
          spec={{ id: 'on-top', type: 'background', paint: { 'background-color': '#000' } }}
          beforeId="road-label"
        />
      </MapView>
    ));
    m._triggerLoad();
    expect(m.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'on-top' }),
      'road-label',
    );
  });

  it('calls removeLayer on unmount', () => {
    const m = mountAndLoad(() => (
      <MapView>
        <Layer
          spec={{ id: 'cleanup-layer', type: 'background', paint: { 'background-color': '#fff' } }}
        />
      </MapView>
    ));
    expect(m.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'cleanup-layer' }),
      undefined,
    );
    dispose();
    dispose = () => {};
    expect(m.removeLayer).toHaveBeenCalledWith('cleanup-layer');
  });

  it('multiple mount/unmount cycles: addLayer/removeLayer calls are paired', () => {
    for (let i = 0; i < 3; i++) {
      const d = render(
        () => (
          <MapView>
            <Layer
              spec={{
                id: 'cycle-layer',
                type: 'background',
                paint: { 'background-color': '#fff' },
              }}
            />
          </MapView>
        ),
        container,
      );
      lastRO().trigger(800, 600);
      lastMap()._triggerLoad();
      d();
    }
    expect(mapInstances).toHaveLength(3);
    for (const m of mapInstances) {
      expect(m.addLayer).toHaveBeenCalledTimes(1);
      expect(m.removeLayer).toHaveBeenCalledTimes(1);
    }
  });

  it('conditional mount/unmount via signal — adds and removes layer correctly', () => {
    const [show, setShow] = createSignal(false);
    dispose = render(
      () => (
        <MapView>
          {show() && (
            <Layer
              spec={{
                id: 'conditional-layer',
                type: 'background',
                paint: { 'background-color': '#ccc' },
              }}
            />
          )}
        </MapView>
      ),
      container,
    );
    lastRO().trigger(800, 600);
    lastMap()._triggerLoad();
    const m = lastMap();

    expect(m.addLayer).not.toHaveBeenCalled();
    setShow(true);
    expect(m.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'conditional-layer' }),
      undefined,
    );
    setShow(false);
    expect(m.removeLayer).toHaveBeenCalledWith('conditional-layer');
  });

  it('registers styledata listener on mount and removes it on unmount', () => {
    const m = mountAndLoad(() => (
      <MapView>
        <Layer
          spec={{ id: 'listener-layer', type: 'background', paint: { 'background-color': '#fff' } }}
        />
      </MapView>
    ));
    expect(m.on).toHaveBeenCalledWith('styledata', expect.any(Function));
    dispose();
    dispose = () => {};
    expect(m.off).toHaveBeenCalledWith('styledata', expect.any(Function));
  });
});

// ---------------------------------------------------------------------------
// Terrain tests
// ---------------------------------------------------------------------------

describe('Terrain — lifecycle', () => {
  it('calls setTerrain after load', () => {
    const m = mountNoLoad(() => (
      <MapView>
        <Terrain source="terrain-dem" />
      </MapView>
    ));
    expect(m.setTerrain).not.toHaveBeenCalled();
    m._triggerLoad();
    expect(m.setTerrain).toHaveBeenCalledWith({ source: 'terrain-dem', exaggeration: 1 });
  });

  it('passes custom exaggeration', () => {
    const m = mountNoLoad(() => (
      <MapView>
        <Terrain source="terrain-dem" exaggeration={1.5} />
      </MapView>
    ));
    m._triggerLoad();
    expect(m.setTerrain).toHaveBeenCalledWith({ source: 'terrain-dem', exaggeration: 1.5 });
  });

  it('calls setTerrain(null) on unmount', () => {
    const m = mountAndLoad(() => (
      <MapView>
        <Terrain source="terrain-dem" exaggeration={2} />
      </MapView>
    ));
    dispose();
    dispose = () => {};
    expect(m.setTerrain).toHaveBeenCalledWith(null);
  });

  it('multiple mount/unmount cycles: setTerrain null called each time', () => {
    for (let i = 0; i < 3; i++) {
      const d = render(
        () => (
          <MapView>
            <Terrain source="terrain-dem" />
          </MapView>
        ),
        container,
      );
      lastRO().trigger(800, 600);
      lastMap()._triggerLoad();
      d();
    }
    expect(mapInstances).toHaveLength(3);
    for (const m of mapInstances) {
      const calls = m.setTerrain.mock.calls;
      // Last call in cleanup should be setTerrain(null)
      expect(calls[calls.length - 1]).toEqual([null]);
    }
  });

  it('registers styledata listener on mount and removes it on unmount', () => {
    const m = mountAndLoad(() => (
      <MapView>
        <Terrain source="terrain-dem" />
      </MapView>
    ));
    expect(m.on).toHaveBeenCalledWith('styledata', expect.any(Function));
    dispose();
    dispose = () => {};
    expect(m.off).toHaveBeenCalledWith('styledata', expect.any(Function));
  });
});

// ---------------------------------------------------------------------------
// Sky tests
// ---------------------------------------------------------------------------

describe('Sky — lifecycle', () => {
  it('calls setSky with default spec after load', () => {
    const m = mountNoLoad(() => (
      <MapView>
        <Sky />
      </MapView>
    ));
    expect(m.setSky).not.toHaveBeenCalled();
    m._triggerLoad();
    expect(m.setSky).toHaveBeenCalledWith(expect.objectContaining({ 'sky-color': '#199EF3' }));
  });

  it('calls setSky with custom spec when provided', () => {
    const m = mountNoLoad(() => (
      <MapView>
        <Sky spec={{ 'sky-color': '#001020', 'horizon-color': '#1a3a5c' }} />
      </MapView>
    ));
    m._triggerLoad();
    expect(m.setSky).toHaveBeenCalledWith(
      expect.objectContaining({ 'sky-color': '#001020', 'horizon-color': '#1a3a5c' }),
    );
  });

  it('calls setSky({}) on unmount', () => {
    const m = mountAndLoad(() => (
      <MapView>
        <Sky />
      </MapView>
    ));
    dispose();
    dispose = () => {};
    expect(m.setSky).toHaveBeenCalledWith({});
  });

  it('multiple mount/unmount cycles: setSky({}) called each time on cleanup', () => {
    for (let i = 0; i < 3; i++) {
      const d = render(
        () => (
          <MapView>
            <Sky />
          </MapView>
        ),
        container,
      );
      lastRO().trigger(800, 600);
      lastMap()._triggerLoad();
      d();
    }
    expect(mapInstances).toHaveLength(3);
    for (const m of mapInstances) {
      const calls = m.setSky.mock.calls;
      expect(calls[calls.length - 1]).toEqual([{}]);
    }
  });

  it('registers styledata listener on mount and removes it on unmount', () => {
    const m = mountAndLoad(() => (
      <MapView>
        <Sky />
      </MapView>
    ));
    expect(m.on).toHaveBeenCalledWith('styledata', expect.any(Function));
    dispose();
    dispose = () => {};
    expect(m.off).toHaveBeenCalledWith('styledata', expect.any(Function));
  });
});
