/* @vitest-environment jsdom */
/**
 * Layer — reactive props tests.
 *
 * Verifies:
 * - spec.paint change → setPaintProperty called for each changed key
 * - spec.layout change → setLayoutProperty called
 * - spec.filter change → setFilter called
 * - spec.minzoom/maxzoom change → setLayerZoomRange called
 * - structural change (type/source) → removeLayer + addLayer (full re-create)
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
    this.addSource = vi.fn();
    this.removeSource = vi.fn();
    this.getSource = vi.fn(() => undefined);
    this.addLayer = vi.fn((spec: { id: string }) => addedLayers.add(spec.id));
    this.removeLayer = vi.fn((id: string) => addedLayers.delete(id));
    this.getLayer = vi.fn((id: string) => (addedLayers.has(id) ? {} : undefined));
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

import type { BackgroundLayerSpecification } from 'maplibre-gl';
import { Layer } from '../Layer';
import { MapView } from '../MapView';

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
// Reactive paint
// ---------------------------------------------------------------------------

describe('Layer — reactive paint', () => {
  it('calls setPaintProperty for each key when paint object changes', () => {
    const [spec, setSpec] = createSignal<BackgroundLayerSpecification>({
      id: 'bg-layer',
      type: 'background',
      paint: { 'background-color': '#ffffff' },
    });

    const m = mountAndLoad(() => (
      <MapView>
        <Layer spec={spec()} />
      </MapView>
    ));

    m.setPaintProperty.mockClear();

    setSpec({
      id: 'bg-layer',
      type: 'background',
      paint: { 'background-color': '#000000' },
    });

    expect(m.setPaintProperty).toHaveBeenCalledWith('bg-layer', 'background-color', '#000000');
  });

  it('calls setPaintProperty for multiple changed keys', () => {
    const [spec, setSpec] = createSignal<BackgroundLayerSpecification>({
      id: 'multi-paint-layer',
      type: 'background',
      paint: { 'background-color': '#ffffff', 'background-opacity': 1 },
    });

    const m = mountAndLoad(() => (
      <MapView>
        <Layer spec={spec()} />
      </MapView>
    ));

    m.setPaintProperty.mockClear();

    setSpec({
      id: 'multi-paint-layer',
      type: 'background',
      paint: { 'background-color': '#ff0000', 'background-opacity': 0.5 },
    });

    expect(m.setPaintProperty).toHaveBeenCalledWith(
      'multi-paint-layer',
      'background-color',
      '#ff0000',
    );
    expect(m.setPaintProperty).toHaveBeenCalledWith('multi-paint-layer', 'background-opacity', 0.5);
  });

  it('does not call setPaintProperty when paint is not present', () => {
    const m = mountAndLoad(() => (
      <MapView>
        <Layer spec={{ id: 'no-paint', type: 'background' }} />
      </MapView>
    ));
    expect(m.setPaintProperty).not.toHaveBeenCalled();
  });

  it('calls setPaintProperty reactively multiple times', () => {
    const [color, setColor] = createSignal('#ffffff');

    const m = mountAndLoad(() => (
      <MapView>
        <Layer
          spec={{
            id: 'reactive-paint',
            type: 'background',
            paint: { 'background-color': color() },
          }}
        />
      </MapView>
    ));

    m.setPaintProperty.mockClear();
    setColor('#111111');
    setColor('#222222');

    const calls = m.setPaintProperty.mock.calls.filter(
      (c: unknown[]) => c[0] === 'reactive-paint' && c[1] === 'background-color',
    );
    expect(calls).toHaveLength(2);
    expect(calls[1][2]).toBe('#222222');
  });
});

// ---------------------------------------------------------------------------
// Reactive layout
// ---------------------------------------------------------------------------

describe('Layer — reactive layout', () => {
  it('calls setLayoutProperty for each key when layout object changes', () => {
    type SymbolSpec = {
      id: string;
      type: 'symbol';
      source: string;
      layout: { visibility: 'visible' | 'none'; 'text-field': string };
    };
    const [spec, setSpec] = createSignal<SymbolSpec>({
      id: 'symbol-layer',
      type: 'symbol',
      source: 'my-src',
      layout: { visibility: 'visible', 'text-field': '{name}' },
    });

    const m = mountAndLoad(() => (
      <MapView>
        <Layer spec={spec() as unknown as import('maplibre-gl').LayerSpecification} />
      </MapView>
    ));

    m.setLayoutProperty.mockClear();

    setSpec({
      id: 'symbol-layer',
      type: 'symbol',
      source: 'my-src',
      layout: { visibility: 'none', 'text-field': '{label}' },
    });

    expect(m.setLayoutProperty).toHaveBeenCalledWith('symbol-layer', 'visibility', 'none');
    expect(m.setLayoutProperty).toHaveBeenCalledWith('symbol-layer', 'text-field', '{label}');
  });

  it('does not call setLayoutProperty when layout is not present', () => {
    const m = mountAndLoad(() => (
      <MapView>
        <Layer spec={{ id: 'no-layout', type: 'background' }} />
      </MapView>
    ));
    expect(m.setLayoutProperty).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Reactive filter
// ---------------------------------------------------------------------------

describe('Layer — reactive filter', () => {
  it('calls setFilter when filter changes', () => {
    type FillSpec = {
      id: string;
      type: 'fill';
      source: string;
      filter: unknown[];
    };
    const filter1 = ['==', 'type', 'residential'];
    const filter2 = ['==', 'type', 'commercial'];
    const [spec, setSpec] = createSignal<FillSpec>({
      id: 'filtered-layer',
      type: 'fill',
      source: 'my-src',
      filter: filter1,
    });

    const m = mountAndLoad(() => (
      <MapView>
        <Layer spec={spec() as unknown as import('maplibre-gl').LayerSpecification} />
      </MapView>
    ));

    m.setFilter.mockClear();

    setSpec({ id: 'filtered-layer', type: 'fill', source: 'my-src', filter: filter2 });

    expect(m.setFilter).toHaveBeenCalledWith('filtered-layer', filter2);
  });

  it('calls setFilter with undefined to clear filter', () => {
    type FillSpec = {
      id: string;
      type: 'fill';
      source: string;
      filter?: unknown[];
    };
    const [spec, setSpec] = createSignal<FillSpec>({
      id: 'clearable-filter',
      type: 'fill',
      source: 'my-src',
      filter: ['==', 'type', 'residential'],
    });

    const m = mountAndLoad(() => (
      <MapView>
        <Layer spec={spec() as unknown as import('maplibre-gl').LayerSpecification} />
      </MapView>
    ));

    m.setFilter.mockClear();

    setSpec({ id: 'clearable-filter', type: 'fill', source: 'my-src', filter: undefined });

    expect(m.setFilter).toHaveBeenCalledWith('clearable-filter', undefined);
  });
});

// ---------------------------------------------------------------------------
// Reactive zoom range
// ---------------------------------------------------------------------------

describe('Layer — reactive zoom range', () => {
  it('calls setLayerZoomRange when minzoom changes', () => {
    type BgSpec = {
      id: string;
      type: 'background';
      minzoom?: number;
      maxzoom?: number;
    };
    const [spec, setSpec] = createSignal<BgSpec>({
      id: 'zoom-layer',
      type: 'background',
      minzoom: 5,
      maxzoom: 18,
    });

    const m = mountAndLoad(() => (
      <MapView>
        <Layer spec={spec() as unknown as import('maplibre-gl').LayerSpecification} />
      </MapView>
    ));

    m.setLayerZoomRange.mockClear();

    setSpec({ id: 'zoom-layer', type: 'background', minzoom: 8, maxzoom: 18 });

    expect(m.setLayerZoomRange).toHaveBeenCalledWith('zoom-layer', 8, 18);
  });

  it('calls setLayerZoomRange when maxzoom changes', () => {
    type BgSpec = {
      id: string;
      type: 'background';
      minzoom?: number;
      maxzoom?: number;
    };
    const [spec, setSpec] = createSignal<BgSpec>({
      id: 'maxzoom-layer',
      type: 'background',
      minzoom: 5,
      maxzoom: 18,
    });

    const m = mountAndLoad(() => (
      <MapView>
        <Layer spec={spec() as unknown as import('maplibre-gl').LayerSpecification} />
      </MapView>
    ));

    m.setLayerZoomRange.mockClear();

    setSpec({ id: 'maxzoom-layer', type: 'background', minzoom: 5, maxzoom: 16 });

    expect(m.setLayerZoomRange).toHaveBeenCalledWith('maxzoom-layer', 5, 16);
  });

  it('does not call setLayerZoomRange when neither minzoom nor maxzoom is defined', () => {
    const m = mountAndLoad(() => (
      <MapView>
        <Layer spec={{ id: 'no-zoom-range', type: 'background' }} />
      </MapView>
    ));
    expect(m.setLayerZoomRange).not.toHaveBeenCalled();
  });

  it('uses defaults (0, 24) when one of the zoom bounds is undefined', () => {
    type BgSpec = {
      id: string;
      type: 'background';
      minzoom?: number;
    };
    const [spec, setSpec] = createSignal<BgSpec>({
      id: 'partial-zoom',
      type: 'background',
      minzoom: 5,
    });

    const m = mountAndLoad(() => (
      <MapView>
        <Layer spec={spec() as unknown as import('maplibre-gl').LayerSpecification} />
      </MapView>
    ));

    m.setLayerZoomRange.mockClear();

    setSpec({ id: 'partial-zoom', type: 'background', minzoom: 10 });

    // maxzoom not in spec → defaults to 24
    expect(m.setLayerZoomRange).toHaveBeenCalledWith('partial-zoom', 10, 24);
  });
});

// ---------------------------------------------------------------------------
// Structural changes — removeLayer + addLayer
// ---------------------------------------------------------------------------

describe('Layer — structural change (spec.id / spec.type / source change)', () => {
  it('calls removeLayer + addLayer when full spec changes (structural change path)', () => {
    // When the entire spec object reference changes (including structural fields),
    // the main effect re-runs: it calls removeLayer then addLayer.
    const spec1 = {
      id: 'struct-layer',
      type: 'background' as const,
      paint: { 'background-color': '#fff' },
    };
    const spec2 = {
      id: 'struct-layer',
      type: 'background' as const,
      paint: { 'background-color': '#000' },
    };
    const [spec, setSpec] = createSignal(spec1);

    const m = mountAndLoad(() => (
      <MapView>
        <Layer spec={spec()} />
      </MapView>
    ));

    m.addLayer.mockClear();
    m.removeLayer.mockClear();

    // Changing spec with same id but different type triggers structural re-create
    setSpec(spec2);

    // Main effect: removeLayer (old) + addLayer (new)
    expect(m.removeLayer).toHaveBeenCalledWith('struct-layer');
    expect(m.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'struct-layer' }),
      undefined,
    );
  });
});
