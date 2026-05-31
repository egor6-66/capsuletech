/* @vitest-environment jsdom */
/**
 * Marker — lifecycle and reactivity tests.
 *
 * Verifies:
 * - Mount creates Marker with correct coords
 * - setLngLat called on reactive lng/lat change (no recreate)
 * - anchor change → marker recreated (remove + new constructor)
 * - active toggle → NO marker recreation; stable element mutated in-place
 * - first-ever-active marker reverts correctly (orphaned-subscription regression)
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
  _constructorOptions: { anchor?: string; element?: HTMLElement };
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

  const MockMarker = vi.fn(function (
    this: MockMarkerInstance,
    options: { anchor?: string; element?: HTMLElement } = {},
  ) {
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
/**
 * Returns the actual DOM element that was passed to the Marker constructor and
 * has click/dblclick listeners attached. Since we always supply a custom element
 * (`createStableElement`), this is `_constructorOptions.element`, NOT `_element`
 * (the mock's internal fallback div).
 */
function lastMarkerEl(): HTMLDivElement {
  return lastMarker()._constructorOptions.element as HTMLDivElement;
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
// Active variant (dot / pin) tests
// ---------------------------------------------------------------------------

describe('Marker — active variant (dot / pin)', () => {
  it('inactive (default) → passes a stable custom element to the constructor', () => {
    mountAndLoad(() => (
      <MapView>
        <Marker lng={0} lat={0} />
      </MapView>
    ));
    // Both active and inactive variants always use a custom element (stable DOM node).
    expect(lastMarker()._constructorOptions.element).toBeInstanceOf(HTMLDivElement);
  });

  it('active → still passes a stable custom element to the constructor', () => {
    mountAndLoad(() => (
      <MapView>
        <Marker lng={0} lat={0} active />
      </MapView>
    ));
    // active state is expressed via element.innerHTML (SVG), not via the
    // absence of a custom element — the element is always present.
    expect(lastMarker()._constructorOptions.element).toBeInstanceOf(HTMLDivElement);
  });

  it('inactive element has no SVG (dot appearance)', () => {
    mountAndLoad(() => (
      <MapView>
        <Marker lng={0} lat={0} />
      </MapView>
    ));
    const el = lastMarker()._constructorOptions.element as HTMLDivElement;
    expect(el.querySelector('svg')).toBeNull();
    expect(el.style.borderRadius).toBe('9999px');
  });

  it('active element contains an SVG (pin/teardrop appearance)', () => {
    mountAndLoad(() => (
      <MapView>
        <Marker lng={0} lat={0} active />
      </MapView>
    ));
    const el = lastMarker()._constructorOptions.element as HTMLDivElement;
    expect(el.querySelector('svg')).not.toBeNull();
    expect(el.style.borderRadius).toBe('');
  });

  it('toggling active does NOT recreate the marker (stable instance)', () => {
    const [active, setActive] = createSignal(false);
    mountAndLoad(() => (
      <MapView>
        <Marker lng={0} lat={0} active={active()} />
      </MapView>
    ));
    const instanceBefore = lastMarker();
    expect(markerInstances).toHaveLength(1);
    // Confirm dot appearance before toggle
    const el = instanceBefore._constructorOptions.element as HTMLDivElement;
    expect(el.querySelector('svg')).toBeNull();

    setActive(true);

    // No new Marker constructor call — same instance
    expect(markerInstances).toHaveLength(1);
    expect(lastMarker()).toBe(instanceBefore);
    // The SAME element now shows pin appearance
    expect(el.querySelector('svg')).not.toBeNull();

    setActive(false);

    // Still only one instance, reverted to dot
    expect(markerInstances).toHaveLength(1);
    expect(el.querySelector('svg')).toBeNull();
    expect(el.style.borderRadius).toBe('9999px');
  });

  it('toggling active true→false does NOT call marker.remove()', () => {
    const [active, setActive] = createSignal(false);
    mountAndLoad(() => (
      <MapView>
        <Marker lng={0} lat={0} active={active()} />
      </MapView>
    ));
    const marker = lastMarker();

    setActive(true);
    setActive(false);

    expect(marker.remove).not.toHaveBeenCalled();
  });

  it('first-ever-active marker reverts to dot when deactivated (regression)', () => {
    // Regression: the first marker that ever becomes active used to stay a pin
    // permanently because the reactive subscription was orphaned after the first
    // recreation. With the stable-element design this must not happen.
    const [activeA, setActiveA] = createSignal(false);
    const [activeB, setActiveB] = createSignal(false);

    mountAndLoad(() => (
      <MapView>
        <Marker lng={0} lat={0} active={activeA()} />
        <Marker lng={1} lat={1} active={activeB()} />
      </MapView>
    ));

    expect(markerInstances).toHaveLength(2);
    const [markerA, markerB] = markerInstances;
    const elA = markerA._constructorOptions.element as HTMLDivElement;
    const elB = markerB._constructorOptions.element as HTMLDivElement;

    // Step 1: activate A (first-ever-active)
    setActiveA(true);
    expect(elA.querySelector('svg')).not.toBeNull(); // A is pin
    expect(elB.querySelector('svg')).toBeNull(); // B is dot

    // Step 2: move active to B — A must revert to dot (this was the bug)
    setActiveA(false);
    setActiveB(true);
    expect(elA.querySelector('svg')).toBeNull(); // A reverted to dot ✓
    expect(elB.querySelector('svg')).not.toBeNull(); // B is now pin

    // Step 3: move active back to A — must work both ways
    setActiveB(false);
    setActiveA(true);
    expect(elA.querySelector('svg')).not.toBeNull(); // A is pin again
    expect(elB.querySelector('svg')).toBeNull(); // B reverted to dot

    // Total instances must still be 2 — no recreation happened
    expect(markerInstances).toHaveLength(2);
  });

  it('forwards click in the dot (inactive) variant', () => {
    const onClick = vi.fn();
    mountAndLoad(() => (
      <MapView>
        <Marker lng={0} lat={0} onClick={onClick} />
      </MapView>
    ));
    lastMarkerEl().dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('forwards click after active toggle (listener survives on stable element)', () => {
    const onClick = vi.fn();
    const [active, setActive] = createSignal(false);
    mountAndLoad(() => (
      <MapView>
        <Marker lng={0} lat={0} active={active()} onClick={onClick} />
      </MapView>
    ));
    // Capture the stable element before any toggle
    const el = lastMarkerEl();

    setActive(true);
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onClick).toHaveBeenCalledTimes(1);

    setActive(false);
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onClick).toHaveBeenCalledTimes(2);
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
    const el = lastMarkerEl();
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
    const el = lastMarkerEl();
    // Should not throw
    expect(() => el.dispatchEvent(new MouseEvent('click'))).not.toThrow();
  });

  it('removeEventListener called on unmount', () => {
    mountAndLoad(() => (
      <MapView>
        <Marker lng={0} lat={0} onClick={vi.fn()} />
      </MapView>
    ));
    // Spy on the actual element that has the listener (our stable custom element)
    const el = lastMarkerEl();
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
    const el = lastMarkerEl();
    const event = new MouseEvent('click');
    el.dispatchEvent(event);
    expect(onClick).toHaveBeenCalledWith(event);
  });
});

// ---------------------------------------------------------------------------
// Double-click handler tests
// ---------------------------------------------------------------------------

describe('Marker — dblclick handler', () => {
  it('onDblClick receives the native Event on dblclick', () => {
    const onDblClick = vi.fn();
    mountAndLoad(() => (
      <MapView>
        <Marker lng={0} lat={0} onDblClick={onDblClick} />
      </MapView>
    ));
    const el = lastMarkerEl();
    const event = new MouseEvent('dblclick');
    el.dispatchEvent(event);

    expect(onDblClick).toHaveBeenCalledTimes(1);
    expect(onDblClick).toHaveBeenCalledWith(event);
  });

  it('onDblClick is not called if undefined', () => {
    mountAndLoad(() => (
      <MapView>
        <Marker lng={0} lat={0} />
      </MapView>
    ));
    const el = lastMarkerEl();
    // Should not throw
    expect(() => el.dispatchEvent(new MouseEvent('dblclick'))).not.toThrow();
  });

  it('dblclick removeEventListener called on unmount', () => {
    mountAndLoad(() => (
      <MapView>
        <Marker lng={0} lat={0} onDblClick={vi.fn()} />
      </MapView>
    ));
    // Spy on the actual element that has the listener (our stable custom element)
    const el = lastMarkerEl();
    const removeListenerSpy = vi.spyOn(el, 'removeEventListener');

    dispose();
    dispose = () => {};

    expect(removeListenerSpy).toHaveBeenCalledWith('dblclick', expect.any(Function));
  });

  it('onClick and onDblClick fire independently', () => {
    const onClick = vi.fn();
    const onDblClick = vi.fn();
    mountAndLoad(() => (
      <MapView>
        <Marker lng={0} lat={0} onClick={onClick} onDblClick={onDblClick} />
      </MapView>
    ));
    const el = lastMarkerEl();

    el.dispatchEvent(new MouseEvent('click'));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onDblClick).toHaveBeenCalledTimes(0);

    el.dispatchEvent(new MouseEvent('dblclick'));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onDblClick).toHaveBeenCalledTimes(1);
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
