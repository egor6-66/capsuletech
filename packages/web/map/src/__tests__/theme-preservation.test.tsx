/* @vitest-environment jsdom */
/**
 * Theme preservation tests — Source, Layer, Terrain re-apply after setStyle.
 *
 * Verifies that after a theme switch (setStyle → 'styledata' event) each child
 * component that was previously mounted re-adds itself to the map once the new
 * style is fully loaded (isStyleLoaded() === true).
 *
 * Pattern:
 *   1. Mount MapView + child components → load → assertions pass.
 *   2. Simulate theme switch: clear internal sets (simulates setStyle wiping state),
 *      set isStyleLoaded() to false (style loading), then fire 'styledata' with
 *      isStyleLoaded() still false → no re-add.
 *   3. Set isStyleLoaded() to true, fire 'styledata' again → child re-adds itself.
 */

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
  _wipeUserState: () => void;
  _styleLoaded: boolean;
}

let mapInstances: MockMapInstance[] = [];

vi.mock('maplibre-gl', () => {
  const MockMap = vi.fn(function (this: MockMapInstance, _options: unknown) {
    const loadHandlers: LoadHandler[] = [];
    const styleDataHandlers: StyleDataHandler[] = [];
    this._styleLoaded = false;

    const addedSources = new Set<string>();
    const addedLayers = new Set<string>();

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

    this.addSource = vi.fn((id: string) => addedSources.add(id));
    this.removeSource = vi.fn((id: string) => addedSources.delete(id));
    this.getSource = vi.fn((id: string) => (addedSources.has(id) ? {} : undefined));

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
    // Simulate what setStyle does: wipes all user-added sources and layers
    this._wipeUserState = () => {
      addedSources.clear();
      addedLayers.clear();
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

function mountAndLoad(ui: () => JSX.Element): MockMapInstance {
  dispose = render(ui, container);
  lastRO().trigger(800, 600);
  lastMap()._triggerLoad();
  return lastMap();
}

/** Simulate full theme-switch cycle:
 *  1. wipe map state (as setStyle does)
 *  2. mark style as not loaded
 *  3. fire styledata (style loading, not complete) — should NOT re-add
 *  4. mark style as loaded
 *  5. fire styledata (style fully loaded) — SHOULD re-add
 */
function simulateThemeSwitch(m: MockMapInstance): void {
  m._wipeUserState();
  m._styleLoaded = false;
  m._triggerStyleData(); // intermediate — isStyleLoaded() = false
  m._styleLoaded = true;
  m._triggerStyleData(); // final — isStyleLoaded() = true
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
// Source — style preservation
// ---------------------------------------------------------------------------

describe('Source — style preservation after setStyle', () => {
  it('re-adds source after styledata event when source was wiped', () => {
    const m = mountAndLoad(() => (
      <MapView>
        <Source
          id="preserved-src"
          spec={{ type: 'geojson', data: { type: 'FeatureCollection', features: [] } }}
        />
      </MapView>
    ));
    expect(m.addSource).toHaveBeenCalledTimes(1);
    m.addSource.mockClear();

    simulateThemeSwitch(m);

    // Should have been re-added after style fully loaded
    expect(m.addSource).toHaveBeenCalledWith(
      'preserved-src',
      expect.objectContaining({ type: 'geojson' }),
    );
  });

  it('does NOT re-add source when styledata fires with isStyleLoaded=false', () => {
    const m = mountAndLoad(() => (
      <MapView>
        <Source
          id="not-yet-src"
          spec={{ type: 'geojson', data: { type: 'FeatureCollection', features: [] } }}
        />
      </MapView>
    ));
    m.addSource.mockClear();

    // Fire styledata while style is not yet loaded — should not re-add
    m._wipeUserState();
    m._styleLoaded = false;
    m._triggerStyleData();

    expect(m.addSource).not.toHaveBeenCalled();
  });

  it('re-adds raster-dem source after theme switch', () => {
    const m = mountAndLoad(() => (
      <MapView>
        <Source
          id="dem-src"
          spec={{
            type: 'raster-dem',
            url: 'https://example.com/dem/{z}/{x}/{y}.png',
            tileSize: 512,
          }}
        />
      </MapView>
    ));
    m.addSource.mockClear();

    simulateThemeSwitch(m);

    expect(m.addSource).toHaveBeenCalledWith(
      'dem-src',
      expect.objectContaining({ type: 'raster-dem' }),
    );
  });
});

// ---------------------------------------------------------------------------
// Layer — style preservation
// ---------------------------------------------------------------------------

describe('Layer — style preservation after setStyle', () => {
  it('re-adds layer after styledata event when layer was wiped', () => {
    const m = mountAndLoad(() => (
      <MapView>
        <Layer
          spec={{
            id: 'preserved-layer',
            type: 'background',
            paint: { 'background-color': '#fff' },
          }}
        />
      </MapView>
    ));
    expect(m.addLayer).toHaveBeenCalledTimes(1);
    m.addLayer.mockClear();

    simulateThemeSwitch(m);

    expect(m.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'preserved-layer', type: 'background' }),
      undefined,
    );
  });

  it('does NOT re-add layer when styledata fires with isStyleLoaded=false', () => {
    const m = mountAndLoad(() => (
      <MapView>
        <Layer
          spec={{ id: 'not-yet-layer', type: 'background', paint: { 'background-color': '#fff' } }}
        />
      </MapView>
    ));
    m.addLayer.mockClear();

    m._wipeUserState();
    m._styleLoaded = false;
    m._triggerStyleData();

    expect(m.addLayer).not.toHaveBeenCalled();
  });

  it('re-adds layer with beforeId after theme switch', () => {
    const m = mountAndLoad(() => (
      <MapView>
        <Layer
          spec={{ id: 'ordered-layer', type: 'background', paint: { 'background-color': '#000' } }}
          beforeId="road-label"
        />
      </MapView>
    ));
    m.addLayer.mockClear();

    simulateThemeSwitch(m);

    expect(m.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'ordered-layer' }),
      'road-label',
    );
  });
});

// ---------------------------------------------------------------------------
// Terrain — style preservation
// ---------------------------------------------------------------------------

describe('Terrain — style preservation after setStyle', () => {
  it('re-applies terrain after styledata event', () => {
    const m = mountAndLoad(() => (
      <MapView>
        <Terrain source="terrain-dem" exaggeration={1.5} />
      </MapView>
    ));
    expect(m.setTerrain).toHaveBeenCalledTimes(1);
    m.setTerrain.mockClear();

    simulateThemeSwitch(m);

    expect(m.setTerrain).toHaveBeenCalledWith({ source: 'terrain-dem', exaggeration: 1.5 });
  });

  it('does NOT re-apply terrain when styledata fires with isStyleLoaded=false', () => {
    const m = mountAndLoad(() => (
      <MapView>
        <Terrain source="terrain-dem" />
      </MapView>
    ));
    m.setTerrain.mockClear();

    m._styleLoaded = false;
    m._triggerStyleData();

    expect(m.setTerrain).not.toHaveBeenCalled();
  });

  it('re-applies terrain multiple times across multiple theme switches', () => {
    const m = mountAndLoad(() => (
      <MapView>
        <Terrain source="terrain-dem" exaggeration={2} />
      </MapView>
    ));
    m.setTerrain.mockClear();

    simulateThemeSwitch(m);
    simulateThemeSwitch(m);

    // Each theme switch should trigger one setTerrain re-apply
    const terrainCalls = m.setTerrain.mock.calls.filter((c: unknown[]) => c[0] !== null);
    expect(terrainCalls).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Sky — style preservation
// ---------------------------------------------------------------------------

describe('Sky — style preservation after setStyle', () => {
  it('re-applies sky after styledata event', () => {
    const m = mountAndLoad(() => (
      <MapView>
        <Sky />
      </MapView>
    ));
    expect(m.setSky).toHaveBeenCalledTimes(1);
    m.setSky.mockClear();

    simulateThemeSwitch(m);

    expect(m.setSky).toHaveBeenCalledWith(expect.objectContaining({ 'sky-color': '#199EF3' }));
  });

  it('does NOT re-apply sky when styledata fires with isStyleLoaded=false', () => {
    const m = mountAndLoad(() => (
      <MapView>
        <Sky />
      </MapView>
    ));
    m.setSky.mockClear();

    m._styleLoaded = false;
    m._triggerStyleData();

    expect(m.setSky).not.toHaveBeenCalled();
  });

  it('re-applies custom sky spec after theme switch', () => {
    const customSpec = { 'sky-color': '#0a1a2e', 'horizon-color': '#1a3a5c' };
    const m = mountAndLoad(() => (
      <MapView>
        <Sky spec={customSpec} />
      </MapView>
    ));
    m.setSky.mockClear();

    simulateThemeSwitch(m);

    expect(m.setSky).toHaveBeenCalledWith(
      expect.objectContaining({ 'sky-color': '#0a1a2e', 'horizon-color': '#1a3a5c' }),
    );
  });
});

// ---------------------------------------------------------------------------
// Combined: BuildingsPreset-like scenario — theme switch with full combo
// ---------------------------------------------------------------------------

describe('Source + Layer + Terrain — combined theme switch', () => {
  it('all three re-apply after a single theme switch', () => {
    const m = mountAndLoad(() => (
      <MapView>
        <Source
          id="combo-dem"
          spec={{ type: 'raster-dem', url: 'https://example.com/{z}/{x}/{y}.png', tileSize: 256 }}
        />
        <Layer
          spec={{ id: 'combo-layer', type: 'background', paint: { 'background-color': '#333' } }}
        />
        <Terrain source="combo-dem" exaggeration={1} />
      </MapView>
    ));

    m.addSource.mockClear();
    m.addLayer.mockClear();
    m.setTerrain.mockClear();

    simulateThemeSwitch(m);

    expect(m.addSource).toHaveBeenCalledWith('combo-dem', expect.anything());
    expect(m.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'combo-layer' }),
      undefined,
    );
    expect(m.setTerrain).toHaveBeenCalledWith({ source: 'combo-dem', exaggeration: 1 });
  });
});
