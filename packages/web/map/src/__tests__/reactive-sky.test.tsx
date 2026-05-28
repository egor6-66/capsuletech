/* @vitest-environment jsdom */
/**
 * Sky — reactive props tests.
 *
 * Verifies:
 * - Reactive spec → setSky called with new spec when spec reference changes
 * - Switching from undefined (default) to custom spec → setSky called
 * - Switching from custom back to undefined → setSky called with DEFAULT_SKY
 * - Multiple updates → setSky called for each
 * - Cleanup still calls setSky({}) after reactive updates
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

import type { SkySpecification } from 'maplibre-gl';
import { MapView } from '../MapView';
import { Sky } from '../Sky';

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

describe('Sky — reactive spec', () => {
  it('calls setSky with new spec when spec reference changes', () => {
    const spec1: SkySpecification = { 'sky-color': '#199EF3', 'horizon-color': '#bcd8f4' };
    const spec2: SkySpecification = { 'sky-color': '#0a1a2e', 'horizon-color': '#1a3a5c' };
    const [spec, setSpec] = createSignal<SkySpecification>(spec1);

    const m = mountAndLoad(() => (
      <MapView>
        <Sky spec={spec()} />
      </MapView>
    ));

    expect(m.setSky).toHaveBeenCalledWith(spec1);
    m.setSky.mockClear();

    setSpec(spec2);

    expect(m.setSky).toHaveBeenCalledWith(spec2);
  });

  it('calls setSky multiple times as spec changes', () => {
    const makeSpec = (color: string): SkySpecification => ({ 'sky-color': color });
    const [spec, setSpec] = createSignal<SkySpecification>(makeSpec('#000'));

    const m = mountAndLoad(() => (
      <MapView>
        <Sky spec={spec()} />
      </MapView>
    ));

    m.setSky.mockClear();

    setSpec(makeSpec('#111'));
    setSpec(makeSpec('#222'));
    setSpec(makeSpec('#333'));

    const setCalls = m.setSky.mock.calls.filter(
      (c: unknown[]) =>
        typeof c[0] === 'object' && c[0] !== null && Object.keys(c[0] as object).length > 0,
    );
    expect(setCalls).toHaveLength(3);
    expect(setCalls[2][0]).toEqual({ 'sky-color': '#333' });
  });

  it('falls back to DEFAULT_SKY when spec becomes undefined', () => {
    const customSpec: SkySpecification = { 'sky-color': '#0a1a2e' };
    const [spec, setSpec] = createSignal<SkySpecification | undefined>(customSpec);

    const m = mountAndLoad(() => (
      <MapView>
        <Sky spec={spec()} />
      </MapView>
    ));

    m.setSky.mockClear();

    setSpec(undefined);

    // Should call with DEFAULT_SKY (sky-color '#199EF3')
    expect(m.setSky).toHaveBeenCalledWith(expect.objectContaining({ 'sky-color': '#199EF3' }));
  });

  it('setSky({}) still called on cleanup after reactive updates', () => {
    const [spec, setSpec] = createSignal<SkySpecification>({ 'sky-color': '#aaa' });

    const m = mountAndLoad(() => (
      <MapView>
        <Sky spec={spec()} />
      </MapView>
    ));

    setSpec({ 'sky-color': '#bbb' });
    m.setSky.mockClear();

    dispose();
    dispose = () => {};

    expect(m.setSky).toHaveBeenCalledWith({});
  });

  it('uses default sky when no spec provided (undefined)', () => {
    const m = mountAndLoad(() => (
      <MapView>
        <Sky />
      </MapView>
    ));
    expect(m.setSky).toHaveBeenCalledWith(
      expect.objectContaining({ 'sky-color': '#199EF3', 'horizon-color': '#bcd8f4' }),
    );
  });
});
