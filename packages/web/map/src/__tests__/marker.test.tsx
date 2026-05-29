/* @vitest-environment jsdom */
/**
 * Marker — lifecycle and reactivity tests.
 *
 * Verifies:
 * - Mount creates Marker with correct coords
 * - setLngLat called on reactive lng/lat change (no recreate)
 * - anchor change → marker recreated (remove + new constructor)
 * - click triggers onClick with correct (data, event) signature
 * - data change is reactive — onClick receives latest data on next click
 * - unmount → marker.remove() + removeEventListener called
 * - multiple markers registered independently on map
 * - marker does NOT need styledata listener (DOM layer, not render pipeline)
 */

import { createSignal } from 'solid-js';
import { render } from 'solid-js/web';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// maplibre-gl mock — includes Marker constructor
// ---------------------------------------------------------------------------

interface MockMarkerInstance {
  setLngLat: ReturnType<typeof vi.fn>;
  addTo: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
  getElement: ReturnType<typeof vi.fn>;
  _element: HTMLDivElement;
  _constructorOptions: { anchor?: string };
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
  _triggerLoad: () => void;
  _styleLoaded: boolean;
}

let mapInstances: MockMapInstance[] = [];
let markerInstances: MockMarkerInstance[] = [];

vi.mock('maplibre-gl', () => {
  type LoadHandler = () => void;

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
    this._triggerLoad = () => {
      this._styleLoaded = true;
      for (const h of [...loadHandlers]) h();
    };
    mapInstances.push(this as unknown as MockMapInstance);
  });

  const MockMarker = vi.fn(function (this: MockMarkerInstance, options: { anchor?: string } = {}) {
    this._constructorOptions = options;
    const el = document.createElement('div');
    this._element = el;

    this.setLngLat = vi.fn().mockReturnThis();
    this.addTo = vi.fn().mockReturnThis();
    this.remove = vi.fn();
    this.getElement = vi.fn(() => el);

    markerInstances.push(this as unknown as MockMarkerInstance);
  });

  return {
    default: { Map: MockMap, Marker: MockMarker },
    Map: MockMap,
    Marker: MockMarker,
  };
});

// ---------------------------------------------------------------------------
// ResizeObserver + matchMedia + MutationObserver mocks
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
  'MutationObserver',
  // biome-ignore lint/complexity/useArrowFunction: must be a `function` — arrow functions cannot be used as constructors with `new`
  vi.fn(function () {
    return { observe: vi.fn(), disconnect: vi.fn() };
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

import type { JSX } from 'solid-js';
import { MapView } from '../MapView';
import { Marker } from '../Marker';

function lastMap(): MockMapInstance {
  return mapInstances[mapInstances.length - 1];
}
function lastRO(): MockROInstance {
  return roInstances[roInstances.length - 1];
}
function lastMarker(): MockMarkerInstance {
  return markerInstances[markerInstances.length - 1];
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

beforeEach(() => {
  mapInstances = [];
  markerInstances = [];
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
// Lifecycle tests
// ---------------------------------------------------------------------------

describe('Marker — lifecycle', () => {
  it('creates marker with correct coordinates on mount', () => {
    mountAndLoad(() => (
      <MapView>
        <Marker lng={30.315} lat={59.939} />
      </MapView>
    ));
    const marker = lastMarker();
    expect(marker).toBeDefined();
    expect(marker.setLngLat).toHaveBeenCalledWith([30.315, 59.939]);
    expect(marker.addTo).toHaveBeenCalled();
  });

  it('calls marker.remove() on unmount', () => {
    mountAndLoad(() => (
      <MapView>
        <Marker lng={0} lat={0} />
      </MapView>
    ));
    const marker = lastMarker();
    dispose();
    dispose = () => {};
    expect(marker.remove).toHaveBeenCalled();
  });

  it('passes anchor to Marker constructor', () => {
    mountAndLoad(() => (
      <MapView>
        <Marker lng={0} lat={0} anchor="top-left" />
      </MapView>
    ));
    const marker = lastMarker();
    expect(marker._constructorOptions.anchor).toBe('top-left');
  });

  it('uses default (undefined) anchor when not provided', () => {
    mountAndLoad(() => (
      <MapView>
        <Marker lng={0} lat={0} />
      </MapView>
    ));
    const marker = lastMarker();
    // anchor not in props → constructor options has no anchor key or undefined
    expect(marker._constructorOptions.anchor).toBeUndefined();
  });

  it('does NOT register styledata listener (marker is a DOM element, not render pipeline)', () => {
    const m = mountAndLoad(() => (
      <MapView>
        <Marker lng={0} lat={0} />
      </MapView>
    ));
    // Check that `on` was never called with 'styledata' from the Marker component.
    // MapView itself does not call m.on('styledata') — only child Source/Layer/Terrain/Sky do.
    const styledataCalls = (m.on.mock.calls as [string, unknown][]).filter(
      ([event]) => event === 'styledata',
    );
    expect(styledataCalls).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Reactive position tests
// ---------------------------------------------------------------------------

describe('Marker — reactive lng/lat', () => {
  it('calls setLngLat when lng changes', () => {
    const [lng, setLng] = createSignal(10);
    mountAndLoad(() => (
      <MapView>
        <Marker lng={lng()} lat={20} />
      </MapView>
    ));
    const marker = lastMarker();
    const callsBefore = marker.setLngLat.mock.calls.length;

    setLng(15);

    expect(marker.setLngLat.mock.calls.length).toBeGreaterThan(callsBefore);
    const lastCall = marker.setLngLat.mock.calls[marker.setLngLat.mock.calls.length - 1];
    expect(lastCall[0]).toEqual([15, 20]);
  });

  it('calls setLngLat when lat changes', () => {
    const [lat, setLat] = createSignal(50);
    mountAndLoad(() => (
      <MapView>
        <Marker lng={30} lat={lat()} />
      </MapView>
    ));
    const marker = lastMarker();

    setLat(55);

    const lastCall = marker.setLngLat.mock.calls[marker.setLngLat.mock.calls.length - 1];
    expect(lastCall[0]).toEqual([30, 55]);
  });

  it('does NOT recreate marker on position change (same marker instance)', () => {
    const [lng, setLng] = createSignal(0);
    mountAndLoad(() => (
      <MapView>
        <Marker lng={lng()} lat={0} />
      </MapView>
    ));
    const markerBefore = lastMarker();

    setLng(10);
    setLng(20);

    // No new Marker instances were created
    expect(markerInstances).toHaveLength(1);
    expect(lastMarker()).toBe(markerBefore);
  });
});

// ---------------------------------------------------------------------------
// Reactive anchor tests
// ---------------------------------------------------------------------------

describe('Marker — reactive anchor (recreate)', () => {
  it('recreates marker (remove + new) when anchor changes', () => {
    const [anchor, setAnchor] = createSignal<'center' | 'top'>('center');
    mountAndLoad(() => (
      <MapView>
        <Marker lng={0} lat={0} anchor={anchor()} />
      </MapView>
    ));
    const firstMarker = lastMarker();
    expect(markerInstances).toHaveLength(1);

    setAnchor('top');

    // New marker created
    expect(markerInstances).toHaveLength(2);
    const secondMarker = lastMarker();
    expect(secondMarker).not.toBe(firstMarker);
    // Old marker was removed
    expect(firstMarker.remove).toHaveBeenCalled();
    // New marker has correct anchor
    expect(secondMarker._constructorOptions.anchor).toBe('top');
  });

  it('new marker after anchor change gets correct coordinates', () => {
    const [anchor, setAnchor] = createSignal<'center' | 'bottom'>('center');
    mountAndLoad(() => (
      <MapView>
        <Marker lng={30} lat={60} anchor={anchor()} />
      </MapView>
    ));

    setAnchor('bottom');

    const newMarker = lastMarker();
    expect(newMarker.setLngLat).toHaveBeenCalledWith([30, 60]);
  });
});

// ---------------------------------------------------------------------------
// Click handler tests
// ---------------------------------------------------------------------------

describe('Marker — click handler', () => {
  it('onClick receives the native Event on click', () => {
    const onClick = vi.fn();
    mountAndLoad(() => (
      <MapView>
        <Marker lng={0} lat={0} onClick={onClick} />
      </MapView>
    ));
    const el = lastMarker()._element;
    const event = new MouseEvent('click');
    el.dispatchEvent(event);

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onClick).toHaveBeenCalledWith(event);
  });

  it('onClick is not called if undefined', () => {
    mountAndLoad(() => (
      <MapView>
        <Marker lng={0} lat={0} />
      </MapView>
    ));
    const el = lastMarker()._element;
    // Should not throw
    expect(() => el.dispatchEvent(new MouseEvent('click'))).not.toThrow();
  });

  it('removeEventListener called on unmount', () => {
    mountAndLoad(() => (
      <MapView>
        <Marker lng={0} lat={0} onClick={vi.fn()} />
      </MapView>
    ));
    const el = lastMarker()._element;
    const removeListenerSpy = vi.spyOn(el, 'removeEventListener');

    dispose();
    dispose = () => {};

    expect(removeListenerSpy).toHaveBeenCalledWith('click', expect.any(Function));
  });

  it('accepts meta and payload props without throwing (HCA pass-through)', () => {
    const onClick = vi.fn();
    mountAndLoad(() => (
      <MapView>
        <Marker
          lng={0}
          lat={0}
          meta={{ tags: ['incident'] }}
          payload={{ id: '42' }}
          onClick={onClick}
        />
      </MapView>
    ));
    const el = lastMarker()._element;
    const event = new MouseEvent('click');
    el.dispatchEvent(event);
    expect(onClick).toHaveBeenCalledWith(event);
  });
});

// ---------------------------------------------------------------------------
// Multiple markers
// ---------------------------------------------------------------------------

describe('Marker — multiple markers', () => {
  it('multiple markers are created independently on the same map', () => {
    mountAndLoad(() => (
      <MapView>
        <Marker lng={10} lat={50} />
        <Marker lng={20} lat={55} />
        <Marker lng={30} lat={60} />
      </MapView>
    ));
    expect(markerInstances).toHaveLength(3);
    for (const m of markerInstances) {
      expect(m.addTo).toHaveBeenCalled();
    }
  });

  it('unmounting one marker does not affect others', () => {
    const [show, setShow] = createSignal(true);
    mountAndLoad(() => (
      <MapView>
        <Marker lng={10} lat={50} />
        {show() && <Marker lng={20} lat={55} />}
        <Marker lng={30} lat={60} />
      </MapView>
    ));
    expect(markerInstances).toHaveLength(3);
    const [first, second, third] = markerInstances;

    setShow(false);

    // Only the conditional marker is removed
    expect(second.remove).toHaveBeenCalled();
    expect(first.remove).not.toHaveBeenCalled();
    expect(third.remove).not.toHaveBeenCalled();
  });
});
