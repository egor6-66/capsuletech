/* @vitest-environment jsdom */
/**
 * Source — reactive props tests.
 *
 * Verifies:
 * - GeoJSON source: changing spec.data → setData() called (no removeSource/addSource)
 * - GeoJSON source: initial mount → addSource called (not setData)
 * - Non-GeoJSON source: changing spec (new reference) → removeSource + addSource
 * - Non-GeoJSON source: if no existing source → only addSource
 */

import { createSignal } from 'solid-js';
import { render } from 'solid-js/web';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// maplibre-gl mock
// ---------------------------------------------------------------------------

type LoadHandler = () => void;

interface MockGeoJSONSource {
  setData: ReturnType<typeof vi.fn>;
}

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
  _triggerLoad: () => void;
  _styleLoaded: boolean;
}

let mapInstances: MockMapInstance[] = [];

vi.mock('maplibre-gl', () => {
  const MockMap = vi.fn(function (this: MockMapInstance, _options: unknown) {
    const loadHandlers: LoadHandler[] = [];
    this._styleLoaded = false;

    // GeoJSONSource mock with setData spy; stored per-id
    const geoJSONSources = new Map<string, MockGeoJSONSource>();
    const addedSources = new Set<string>();
    const addedLayers = new Set<string>();

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

    this.addSource = vi.fn((id: string, spec: { type: string }) => {
      addedSources.add(id);
      if (spec.type === 'geojson') {
        geoJSONSources.set(id, { setData: vi.fn() });
      }
    });
    this.removeSource = vi.fn((id: string) => {
      addedSources.delete(id);
      geoJSONSources.delete(id);
    });
    this.getSource = vi.fn((id: string) => {
      if (geoJSONSources.has(id)) return geoJSONSources.get(id);
      if (addedSources.has(id)) return {};
      return undefined;
    });

    this.addLayer = vi.fn((spec: { id: string }) => addedLayers.add(spec.id));
    this.removeLayer = vi.fn((id: string) => addedLayers.delete(id));
    this.getLayer = vi.fn((id: string) => (addedLayers.has(id) ? {} : undefined));

    this.setTerrain = vi.fn();
    this.setSky = vi.fn();

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

import type { GeoJSONSource, GeoJSONSourceSpecification } from 'maplibre-gl';
import { MapView } from '../MapView';
import { Source } from '../Source';

function lastMap(): MockMapInstance {
  return mapInstances[mapInstances.length - 1];
}
function lastRO(): MockROInstance {
  return roInstances[roInstances.length - 1];
}

function getGeoJSONSetData(m: MockMapInstance, id: string): ReturnType<typeof vi.fn> | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mock returns unknown, cast needed
  const src = (m.getSource as (id: string) => unknown)(id) as MockGeoJSONSource | undefined;
  return src?.setData ?? null;
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
// GeoJSON reactive data
// ---------------------------------------------------------------------------

describe('Source — GeoJSON reactive data', () => {
  it('calls addSource on initial mount (not setData)', () => {
    const initialData = { type: 'FeatureCollection' as const, features: [] };
    const m = mountAndLoad(() => (
      <MapView>
        <Source id="geo-src" spec={{ type: 'geojson', data: initialData }} />
      </MapView>
    ));
    expect(m.addSource).toHaveBeenCalledWith(
      'geo-src',
      expect.objectContaining({ type: 'geojson' }),
    );
    // setData should NOT have been called on initial mount
    const setDataSpy = getGeoJSONSetData(m, 'geo-src');
    expect(setDataSpy).not.toBeNull();
    expect(setDataSpy).not.toHaveBeenCalled();
  });

  it('calls setData when spec.data changes (reactive GeoJSON update)', () => {
    const data1 = { type: 'FeatureCollection' as const, features: [] };
    const data2 = {
      type: 'FeatureCollection' as const,
      features: [
        {
          type: 'Feature' as const,
          geometry: { type: 'Point' as const, coordinates: [0, 0] },
          properties: {},
        },
      ],
    };
    const [spec, setSpec] = createSignal<GeoJSONSourceSpecification>({
      type: 'geojson',
      data: data1 as GeoJSONSourceSpecification['data'],
    });

    const m = mountAndLoad(() => (
      <MapView>
        <Source id="geo-src" spec={spec()} />
      </MapView>
    ));

    // Change data — should trigger setData, not removeSource/addSource
    m.addSource.mockClear();
    m.removeSource.mockClear();

    setSpec({ type: 'geojson', data: data2 });

    // setData called with new data
    const setDataSpy = getGeoJSONSetData(m, 'geo-src');
    expect(setDataSpy).toHaveBeenCalledWith(data2);
    // addSource and removeSource must NOT have been called
    expect(m.addSource).not.toHaveBeenCalled();
    expect(m.removeSource).not.toHaveBeenCalled();
  });

  it('calls setData multiple times as data changes', () => {
    const makeData = (n: number) => ({
      type: 'FeatureCollection' as const,
      features: [
        {
          type: 'Feature' as const,
          geometry: { type: 'Point' as const, coordinates: [n, n] },
          properties: {},
        },
      ],
    });

    const [spec, setSpec] = createSignal<{ type: 'geojson'; data: ReturnType<typeof makeData> }>({
      type: 'geojson',
      data: makeData(0),
    });

    const m = mountAndLoad(() => (
      <MapView>
        <Source id="multi-src" spec={spec()} />
      </MapView>
    ));

    const setDataSpy = getGeoJSONSetData(m, 'multi-src');
    const initialCalls = setDataSpy?.mock.calls.length ?? 0;

    setSpec({ type: 'geojson', data: makeData(1) });
    setSpec({ type: 'geojson', data: makeData(2) });
    setSpec({ type: 'geojson', data: makeData(3) });

    expect(setDataSpy?.mock.calls.length ?? 0).toBe(initialCalls + 3);
  });

  it('calls setData with string URL when data is a URL string', () => {
    const [spec, setSpec] = createSignal<{ type: 'geojson'; data: string }>({
      type: 'geojson',
      data: 'https://example.com/data.geojson',
    });

    const m = mountAndLoad(() => (
      <MapView>
        <Source id="url-src" spec={spec()} />
      </MapView>
    ));

    setSpec({ type: 'geojson', data: 'https://example.com/updated.geojson' });

    const setDataSpy = getGeoJSONSetData(m, 'url-src');
    expect(setDataSpy).toHaveBeenCalledWith('https://example.com/updated.geojson');
  });

  // Expose the setData mock for external assertion via getSource (integration check)
  it('getSource returns object with setData when source is GeoJSON', () => {
    const m = mountAndLoad(() => (
      <MapView>
        <Source
          id="check-src"
          spec={{ type: 'geojson', data: { type: 'FeatureCollection', features: [] } }}
        />
      </MapView>
    ));
    const src = (m.getSource as (id: string) => unknown)('check-src') as GeoJSONSource | undefined;
    expect(src).toBeDefined();
    expect(typeof src?.setData).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// Non-GeoJSON reactive spec
// ---------------------------------------------------------------------------

describe('Source — non-GeoJSON reactive spec (removeSource + addSource)', () => {
  it('calls removeSource then addSource when raster-dem spec changes', () => {
    type RasterDemSpec = { type: 'raster-dem'; url: string; tileSize: number };
    const spec1: RasterDemSpec = {
      type: 'raster-dem',
      url: 'https://example.com/dem1/{z}/{x}/{y}.png',
      tileSize: 256,
    };
    const spec2: RasterDemSpec = {
      type: 'raster-dem',
      url: 'https://example.com/dem2/{z}/{x}/{y}.png',
      tileSize: 512,
    };
    const [spec, setSpec] = createSignal<RasterDemSpec>(spec1);

    const m = mountAndLoad(() => (
      <MapView>
        <Source id="dem-src" spec={spec()} />
      </MapView>
    ));

    expect(m.addSource).toHaveBeenCalledTimes(1);
    m.addSource.mockClear();
    m.removeSource.mockClear();

    setSpec(spec2);

    // Should remove old source, then add new one
    expect(m.removeSource).toHaveBeenCalledWith('dem-src');
    expect(m.addSource).toHaveBeenCalledWith('dem-src', expect.objectContaining({ tileSize: 512 }));
  });

  it('does NOT call removeSource on first add when source does not exist', () => {
    const m = mountAndLoad(() => (
      <MapView>
        <Source
          id="raster-src"
          spec={{ type: 'raster', tiles: ['https://example.com/{z}/{x}/{y}.png'], tileSize: 256 }}
        />
      </MapView>
    ));
    // removeSource should NOT be called on initial mount (no existing source)
    expect(m.removeSource).not.toHaveBeenCalled();
    expect(m.addSource).toHaveBeenCalledTimes(1);
  });
});
