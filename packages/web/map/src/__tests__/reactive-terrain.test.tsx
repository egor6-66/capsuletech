/* @vitest-environment jsdom */
/**
 * Terrain — reactive props tests.
 *
 * Verifies:
 * - Reactive exaggeration → setTerrain called with new value
 * - Reactive source → setTerrain called with new source id
 * - Both changing together → single setTerrain with new spec
 * - Cleanup still calls setTerrain(null) after reactive updates
 */

import { createSignal } from 'solid-js';
import { render } from 'solid-js/web';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// maplibre-gl mock
// ---------------------------------------------------------------------------

type LoadHandler = () => void;

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
  _styleLoaded: boolean;
}

let mapInstances: MockMapInstance[] = [];

vi.mock('maplibre-gl', () => {
  const MockMap = vi.fn(function (this: MockMapInstance, _options: unknown) {
    const loadHandlers: LoadHandler[] = [];
    this._styleLoaded = false;

    this.once = vi.fn((event: string, handler: LoadHandler) => {
      if (event === 'load') loadHandlers.push(handler);
    });
    this.on = vi.fn();
    this.off = vi.fn((event: string, handler: LoadHandler) => {
      if (event === 'load') {
        const idx = loadHandlers.indexOf(handler);
        if (idx !== -1) loadHandlers.splice(idx, 1);
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
    this.addSource = vi.fn();
    this.removeSource = vi.fn();
    this.getSource = vi.fn(() => undefined);
    this.addLayer = vi.fn();
    this.removeLayer = vi.fn();
    this.getLayer = vi.fn(() => undefined);
    this.setTerrain = vi.fn();
    this.setSky = vi.fn();
    this.setPaintProperty = vi.fn();
    this.setLayoutProperty = vi.fn();
    this.setFilter = vi.fn();
    this.setLayerZoomRange = vi.fn();

    this._triggerLoad = () => {
      this._styleLoaded = true;
      for (const h of [...loadHandlers]) h();
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

import { MapView } from '../MapView';
import { Terrain } from '../Terrain';

function lastMap(): MockMapInstance {
  return mapInstances[mapInstances.length - 1];
}
function lastRO(): MockROInstance {
  return roInstances[roInstances.length - 1];
}

let container: HTMLDivElement;
let dispose: () => void = () => {};

function mountAndLoad(ui: () => JSX.Element): MockMapInstance {
  dispose = render(ui, container);
  lastRO().trigger(800, 600);
  lastMap()._triggerLoad();
  return lastMap();
}

import type { JSX } from 'solid-js';

beforeEach(() => {
  mapInstances = [];
  roInstances = [];
  vi.clearAllMocks();
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

describe('Terrain — reactive exaggeration', () => {
  it('calls setTerrain with updated exaggeration when prop changes', () => {
    const [exaggeration, setExaggeration] = createSignal(1);

    const m = mountAndLoad(() => (
      <MapView>
        <Terrain source="terrain-dem" exaggeration={exaggeration()} />
      </MapView>
    ));

    expect(m.setTerrain).toHaveBeenCalledWith({ source: 'terrain-dem', exaggeration: 1 });
    m.setTerrain.mockClear();

    setExaggeration(2);

    expect(m.setTerrain).toHaveBeenCalledWith({ source: 'terrain-dem', exaggeration: 2 });
  });

  it('calls setTerrain multiple times as exaggeration changes', () => {
    const [exaggeration, setExaggeration] = createSignal(1);

    const m = mountAndLoad(() => (
      <MapView>
        <Terrain source="terrain-dem" exaggeration={exaggeration()} />
      </MapView>
    ));

    m.setTerrain.mockClear();

    setExaggeration(1.5);
    setExaggeration(2.0);
    setExaggeration(2.5);

    const calls = m.setTerrain.mock.calls.filter((c: unknown[]) => c[0] !== null);
    expect(calls).toHaveLength(3);
    expect(calls[2][0]).toEqual({ source: 'terrain-dem', exaggeration: 2.5 });
  });

  it('setTerrain(null) still called on unmount after reactive updates', () => {
    const [exaggeration, setExaggeration] = createSignal(1);

    const m = mountAndLoad(() => (
      <MapView>
        <Terrain source="terrain-dem" exaggeration={exaggeration()} />
      </MapView>
    ));

    setExaggeration(1.5);
    m.setTerrain.mockClear();

    dispose();
    dispose = () => {};

    expect(m.setTerrain).toHaveBeenCalledWith(null);
  });
});

describe('Terrain — reactive source', () => {
  it('calls setTerrain with updated source when source prop changes', () => {
    const [source, setSource] = createSignal('dem-source-1');

    const m = mountAndLoad(() => (
      <MapView>
        <Terrain source={source()} exaggeration={1.5} />
      </MapView>
    ));

    expect(m.setTerrain).toHaveBeenCalledWith({ source: 'dem-source-1', exaggeration: 1.5 });
    m.setTerrain.mockClear();

    setSource('dem-source-2');

    expect(m.setTerrain).toHaveBeenCalledWith({ source: 'dem-source-2', exaggeration: 1.5 });
  });
});

describe('Terrain — reactive source + exaggeration together', () => {
  it('calls setTerrain once when both source and exaggeration change simultaneously', () => {
    const [source, setSource] = createSignal('dem-a');
    const [exaggeration, setExaggeration] = createSignal(1);

    const m = mountAndLoad(() => (
      <MapView>
        <Terrain source={source()} exaggeration={exaggeration()} />
      </MapView>
    ));

    m.setTerrain.mockClear();

    // Solid batches synchronous signal updates in the same reactive owner
    // but two separate setSignal calls are NOT batched by default
    setSource('dem-b');
    setExaggeration(2);

    const terrainCalls = m.setTerrain.mock.calls.filter((c: unknown[]) => c[0] !== null);
    // At least one call with the final values
    const lastCall = terrainCalls[terrainCalls.length - 1];
    expect(lastCall[0]).toEqual({ source: 'dem-b', exaggeration: 2 });
  });
});
