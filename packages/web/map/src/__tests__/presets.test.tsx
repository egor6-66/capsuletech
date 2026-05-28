/* @vitest-environment jsdom */
/**
 * TerrainPreset and BuildingsPreset — composition and prop tests.
 *
 * Verifies:
 * - TerrainPreset adds a raster-dem source + setTerrain (correct defaults + overrides)
 * - TerrainPreset cleanup removes source and resets terrain
 * - BuildingsPreset adds fill-extrusion layer with correct source/source-layer (carto defaults)
 * - BuildingsPreset with custom props passes them through
 * - BuildingsPreset cleanup removes layer
 */

import { render } from 'solid-js/web';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// maplibre-gl mock (same pattern as child-components.test.tsx)
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
    this.off = vi.fn();
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
    this.setPaintProperty = vi.fn();
    this.setLayoutProperty = vi.fn();
    this.setFilter = vi.fn();
    this.setLayerZoomRange = vi.fn();
    this._triggerLoad = () => {
      this._styleLoaded = true;
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

import { BuildingsPreset } from '../BuildingsPreset';
import { MapView } from '../MapView';
import { TerrainPreset } from '../TerrainPreset';

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
// TerrainPreset tests
// ---------------------------------------------------------------------------

describe('TerrainPreset — composition', () => {
  it('adds a raster-dem source with default Terrarium URL', () => {
    const m = mountAndLoad(() => (
      <MapView>
        <TerrainPreset />
      </MapView>
    ));
    expect(m.addSource).toHaveBeenCalledWith(
      '__terrain-preset-dem__',
      expect.objectContaining({
        type: 'raster-dem',
        encoding: 'terrarium',
      }),
    );
    const sourceCall = m.addSource.mock.calls.find(
      (args: unknown[]) => args[0] === '__terrain-preset-dem__',
    );
    expect(sourceCall).toBeDefined();
    const spec = sourceCall![1] as { tiles: string[] };
    expect(spec.tiles[0]).toContain('elevation-tiles-prod');
  });

  it('calls setTerrain with default exaggeration=1', () => {
    const m = mountAndLoad(() => (
      <MapView>
        <TerrainPreset />
      </MapView>
    ));
    expect(m.setTerrain).toHaveBeenCalledWith({
      source: '__terrain-preset-dem__',
      exaggeration: 1,
    });
  });

  it('passes custom exaggeration to setTerrain', () => {
    const m = mountAndLoad(() => (
      <MapView>
        <TerrainPreset exaggeration={2.5} />
      </MapView>
    ));
    expect(m.setTerrain).toHaveBeenCalledWith({
      source: '__terrain-preset-dem__',
      exaggeration: 2.5,
    });
  });

  it('uses custom url when provided', () => {
    const customUrl = 'https://api.maptiler.com/tiles/terrain-rgb/{z}/{x}/{y}.png?key=DEMO';
    const m = mountAndLoad(() => (
      <MapView>
        <TerrainPreset url={customUrl} tileSize={512} />
      </MapView>
    ));
    const sourceCall = m.addSource.mock.calls.find(
      (args: unknown[]) => args[0] === '__terrain-preset-dem__',
    );
    expect(sourceCall).toBeDefined();
    const spec = sourceCall![1] as { tiles: string[]; tileSize: number };
    expect(spec.tiles[0]).toBe(customUrl);
    expect(spec.tileSize).toBe(512);
  });

  it('cleanup: removeSource + setTerrain(null) on unmount', () => {
    const m = mountAndLoad(() => (
      <MapView>
        <TerrainPreset />
      </MapView>
    ));
    dispose();
    dispose = () => {};
    expect(m.removeSource).toHaveBeenCalledWith('__terrain-preset-dem__');
    expect(m.setTerrain).toHaveBeenCalledWith(null);
  });
});

// ---------------------------------------------------------------------------
// BuildingsPreset tests
// ---------------------------------------------------------------------------

describe('BuildingsPreset — composition', () => {
  it('adds a fill-extrusion layer with default carto source', () => {
    const m = mountAndLoad(() => (
      <MapView>
        <BuildingsPreset />
      </MapView>
    ));
    expect(m.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({
        id: '__buildings-preset-3d__',
        type: 'fill-extrusion',
        source: 'carto',
        'source-layer': 'building',
      }),
      undefined,
    );
  });

  it('default layer has minzoom=14', () => {
    const m = mountAndLoad(() => (
      <MapView>
        <BuildingsPreset />
      </MapView>
    ));
    const call = m.addLayer.mock.calls[0][0] as { minzoom: number };
    expect(call.minzoom).toBe(14);
  });

  it('default layer has fill-extrusion-height and fill-extrusion-base paint properties', () => {
    const m = mountAndLoad(() => (
      <MapView>
        <BuildingsPreset />
      </MapView>
    ));
    const spec = m.addLayer.mock.calls[0][0] as {
      paint: {
        'fill-extrusion-height': unknown;
        'fill-extrusion-base': unknown;
        'fill-extrusion-color': string;
        'fill-extrusion-opacity': number;
      };
    };
    expect(spec.paint['fill-extrusion-height']).toBeDefined();
    expect(spec.paint['fill-extrusion-base']).toBeDefined();
    expect(spec.paint['fill-extrusion-color']).toBe('#aaaaaa');
    expect(spec.paint['fill-extrusion-opacity']).toBe(0.8);
  });

  it('accepts custom sourceId and sourceLayer', () => {
    const m = mountAndLoad(() => (
      <MapView>
        <BuildingsPreset sourceId="openmaptiles" sourceLayer="building" />
      </MapView>
    ));
    expect(m.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'openmaptiles',
        'source-layer': 'building',
      }),
      undefined,
    );
  });

  it('accepts custom color and opacity', () => {
    const m = mountAndLoad(() => (
      <MapView>
        <BuildingsPreset color="#c9a96e" opacity={0.9} />
      </MapView>
    ));
    const spec = m.addLayer.mock.calls[0][0] as {
      paint: { 'fill-extrusion-color': string; 'fill-extrusion-opacity': number };
    };
    expect(spec.paint['fill-extrusion-color']).toBe('#c9a96e');
    expect(spec.paint['fill-extrusion-opacity']).toBe(0.9);
  });

  it('accepts custom minZoom', () => {
    const m = mountAndLoad(() => (
      <MapView>
        <BuildingsPreset minZoom={15} />
      </MapView>
    ));
    const spec = m.addLayer.mock.calls[0][0] as { minzoom: number };
    expect(spec.minzoom).toBe(15);
  });

  it('accepts custom layerId', () => {
    const m = mountAndLoad(() => (
      <MapView>
        <BuildingsPreset layerId="my-buildings" />
      </MapView>
    ));
    expect(m.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'my-buildings' }),
      undefined,
    );
  });

  it('cleanup: removeLayer on unmount', () => {
    const m = mountAndLoad(() => (
      <MapView>
        <BuildingsPreset />
      </MapView>
    ));
    dispose();
    dispose = () => {};
    expect(m.removeLayer).toHaveBeenCalledWith('__buildings-preset-3d__');
  });
});
