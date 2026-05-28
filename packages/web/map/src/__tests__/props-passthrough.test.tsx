/* @vitest-environment jsdom */
/**
 * MapView props-passthrough + useMap() tests.
 *
 * Verifies that IMapViewProps are correctly forwarded to maplibre-gl Map
 * constructor options and setters, and that useMap() throws outside context.
 */

import { createSignal } from 'solid-js';
import { render } from 'solid-js/web';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// maplibre-gl mock (same pattern as map-view.test.tsx)
// ---------------------------------------------------------------------------

type LoadHandler = () => void;

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
  _ctorOptions: unknown;
}

let mapInstances: MockMapInstance[] = [];

vi.mock('maplibre-gl', () => {
  const MockMap = vi.fn(function (this: MockMapInstance, options: unknown) {
    const loadHandlers: LoadHandler[] = [];
    this._ctorOptions = options;
    this.once = vi.fn((event: string, handler: LoadHandler) => {
      if (event === 'load') loadHandlers.push(handler);
    });
    this.on = vi.fn();
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
    mapInstances.push(this as unknown as MockMapInstance);
  });
  return { default: { Map: MockMap }, Map: MockMap };
});

// ResizeObserver mock
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

// matchMedia mock
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

import { useMap } from '../context';
import { MapView } from '../MapView';
import { DARK_MATTER, POSITRON } from '../styles';

function lastMap(): MockMapInstance {
  return mapInstances[mapInstances.length - 1];
}
function lastRO(): MockROInstance {
  return roInstances[roInstances.length - 1];
}

let container: HTMLDivElement;
let dispose: () => void = () => {};

function mountAndLoad(ui: () => JSX.Element): void {
  dispose = render(ui, container);
  lastRO().trigger(800, 600);
  lastMap()._triggerLoad();
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

describe('MapView — constructor options passthrough', () => {
  it('passes attributionControl=false by default', () => {
    mountAndLoad(() => <MapView />);
    expect((lastMap()._ctorOptions as any).attributionControl).toBe(false);
  });

  it('passes AttributionControlOptions ({}) when attributionControl=true', () => {
    // maplibre-gl 4 types: attributionControl accepts `false | AttributionControlOptions`.
    // Our boolean `true` maps to `{}` (default options) to satisfy the type.
    mountAndLoad(() => <MapView attributionControl={true} />);
    expect((lastMap()._ctorOptions as any).attributionControl).toEqual({});
  });

  it('passes minZoom to constructor when provided', () => {
    mountAndLoad(() => <MapView minZoom={3} />);
    expect((lastMap()._ctorOptions as any).minZoom).toBe(3);
  });

  it('passes maxZoom to constructor when provided', () => {
    mountAndLoad(() => <MapView maxZoom={18} />);
    expect((lastMap()._ctorOptions as any).maxZoom).toBe(18);
  });

  it('does NOT pass center to constructor (NaN guard)', () => {
    mountAndLoad(() => <MapView center={[30, 50]} />);
    expect((lastMap()._ctorOptions as any).center).toBeUndefined();
  });

  it('does NOT pass zoom to constructor (NaN guard)', () => {
    mountAndLoad(() => <MapView zoom={10} />);
    expect((lastMap()._ctorOptions as any).zoom).toBeUndefined();
  });

  it('does NOT pass maxBounds to constructor (NaN guard)', () => {
    mountAndLoad(() => <MapView maxBounds={[-180, -90, 180, 90] as any} />);
    expect((lastMap()._ctorOptions as any).maxBounds).toBeUndefined();
  });

  it('uses POSITRON as default light style', () => {
    mountAndLoad(() => <MapView />);
    expect((lastMap()._ctorOptions as any).style).toBe(POSITRON);
  });

  it('uses custom style when provided', () => {
    mountAndLoad(() => <MapView style="https://my-style.json" />);
    expect((lastMap()._ctorOptions as any).style).toBe('https://my-style.json');
  });
});

describe('MapView — reactive prop sync', () => {
  it('calls setCenter reactively when center prop changes', () => {
    const [center, setCenter] = createSignal<[number, number]>([0, 0]);
    mountAndLoad(() => <MapView center={center()} />);
    const m = lastMap();
    // After load, createEffect fires with initial value
    m.setCenter.mockClear();
    setCenter([30, 50]);
    expect(m.setCenter).toHaveBeenCalledWith([30, 50]);
  });

  it('calls setZoom reactively when zoom prop changes', () => {
    const [zoom, setZoom] = createSignal(5);
    mountAndLoad(() => <MapView zoom={zoom()} />);
    lastMap().setZoom.mockClear();
    setZoom(12);
    expect(lastMap().setZoom).toHaveBeenCalledWith(12);
  });

  it('calls setBearing reactively when bearing prop changes', () => {
    const [bearing, setBearing] = createSignal(0);
    mountAndLoad(() => <MapView bearing={bearing()} />);
    lastMap().setBearing.mockClear();
    setBearing(90);
    expect(lastMap().setBearing).toHaveBeenCalledWith(90);
  });

  it('calls setPitch reactively when pitch prop changes', () => {
    const [pitch, setPitch] = createSignal(0);
    mountAndLoad(() => <MapView pitch={pitch()} />);
    lastMap().setPitch.mockClear();
    setPitch(45);
    expect(lastMap().setPitch).toHaveBeenCalledWith(45);
  });

  it('calls setStyle reactively when style prop changes', () => {
    const [style, setStyle] = createSignal<string>('https://style-a.json');
    mountAndLoad(() => <MapView style={style()} />);
    lastMap().setStyle.mockClear();
    setStyle('https://style-b.json');
    expect(lastMap().setStyle).toHaveBeenCalledWith('https://style-b.json');
  });
});

describe('MapView — dark theme defaults', () => {
  it('DARK_MATTER and POSITRON are distinct style objects', () => {
    expect(DARK_MATTER).toBeDefined();
    expect(POSITRON).toBeDefined();
    expect(DARK_MATTER).not.toBe(POSITRON);
  });
});

describe('useMap — context guard', () => {
  it('throws when called outside MapView', () => {
    expect(() => useMap()).toThrow(
      '[@capsuletech/web-map] useMap() must be called inside <MapView>',
    );
  });
});

describe('MapView — container class/style', () => {
  it('applies default 100%/100% style when no class or classList', () => {
    render(() => <MapView />, container);
    const div = container.querySelector('div');
    expect(div?.style.width).toBe('100%');
    expect(div?.style.height).toBe('100%');
  });

  it('does not apply default size style when class is provided', () => {
    render(() => <MapView class="my-map" />, container);
    const div = container.querySelector('div.my-map') as HTMLElement | null;
    expect(div).not.toBeNull();
    expect(div?.style.width).toBe('');
    expect(div?.style.height).toBe('');
  });

  it('applies style_container when provided', () => {
    render(() => <MapView style_container={{ width: '400px', height: '300px' }} />, container);
    const div = container.querySelector('div');
    expect(div?.style.width).toBe('400px');
    expect(div?.style.height).toBe('300px');
  });
});
