/* @vitest-environment jsdom */
/**
 * Unit tests for MapView — ResizeObserver-gated mount.
 *
 * MapLibre requires WebGL which is unavailable in jsdom, so `maplibregl.Map`
 * is mocked entirely. We verify:
 *  1. `new Map()` is NOT called when the container has 0×0 size on mount.
 *  2. `new Map()` IS called once the ResizeObserver fires with size > 0.
 *  3. When the container already has size on mount, `new Map()` is called synchronously.
 *  4. On cleanup, `map.remove()` is called and the ResizeObserver is disconnected.
 *  5. Zero-dimension observer entries are ignored.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'solid-js/web';

// --- maplibre-gl mock ---
// The Map class must be a real constructor (class keyword), otherwise `new Map()` throws.
// We track construction with a module-level call counter.
let mapConstructorCalls = 0;
let lastMapInstance: { once: ReturnType<typeof vi.fn>; remove: ReturnType<typeof vi.fn> } | null =
  null;

vi.mock('maplibre-gl', () => {
  class MockMapLibreMap {
    once: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;

    constructor() {
      mapConstructorCalls++;
      this.once = vi.fn();
      this.remove = vi.fn();
      lastMapInstance = this as unknown as typeof lastMapInstance;
    }
  }

  return { default: { Map: MockMapLibreMap } };
});

// Import MapView AFTER the mock is set up.
import { MapView } from '../MapView';

// --- ResizeObserver mock ---
type ResizeCallback = (entries: ResizeObserverEntry[]) => void;

let observerCallback: ResizeCallback | null = null;
let observeSpy: ReturnType<typeof vi.fn>;
let disconnectSpy: ReturnType<typeof vi.fn>;

const makeObserverClass = () => {
  observerCallback = null;
  observeSpy = vi.fn();
  disconnectSpy = vi.fn();

  class FakeResizeObserver {
    constructor(cb: ResizeCallback) {
      observerCallback = cb;
    }
    observe = observeSpy;
    disconnect = disconnectSpy;
    unobserve = vi.fn();
  }

  return FakeResizeObserver;
};

/**
 * Mock clientWidth/clientHeight on ALL elements globally for a test.
 *
 * jsdom never computes layout, so clientWidth/clientHeight always return 0.
 * For tests that need non-zero dimensions on MapView's internal container div,
 * we override the HTMLElement.prototype getter for the duration of the test.
 *
 * Restoration is handled in afterEach using the module-level original
 * descriptors, which are captured once before any test can mutate them.
 */
const stubAllElementSizes = (width: number, height: number): void => {
  elementSizesStubbed = true;
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get: () => width,
  });
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    get: () => height,
  });
};

// Helper: fire the ResizeObserver callback with given dimensions.
const fireResize = (width: number, height: number) => {
  if (!observerCallback) throw new Error('ResizeObserver callback not registered');
  observerCallback([{ contentRect: { width, height } } as unknown as ResizeObserverEntry]);
};

// Capture the original descriptors ONCE at module load time (before any test
// stubs them), so that afterEach can always restore to the true originals and
// not to an already-stubbed snapshot from a prior test.
const originalClientWidthDescriptor = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  'clientWidth',
);
const originalClientHeightDescriptor = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  'clientHeight',
);

let elementSizesStubbed = false;

beforeEach(() => {
  mapConstructorCalls = 0;
  lastMapInstance = null;
  elementSizesStubbed = false;
  vi.stubGlobal('ResizeObserver', makeObserverClass());
});

afterEach(() => {
  // Always restore clientWidth/clientHeight to jsdom originals, regardless of
  // how many times stubAllElementSizes was called.
  //
  // In jsdom, clientWidth/clientHeight are NOT defined as own properties on
  // HTMLElement.prototype (getOwnPropertyDescriptor returns undefined). When we
  // stub them with defineProperty we add a new own property. To restore the
  // original (inherited) behaviour we must DELETE that own property — not
  // re-define it.
  if (elementSizesStubbed) {
    if (originalClientWidthDescriptor) {
      Object.defineProperty(HTMLElement.prototype, 'clientWidth', originalClientWidthDescriptor);
    } else {
      // Property did not exist as own — delete the stub so inheritance resumes.
      delete (HTMLElement.prototype as unknown as Record<string, unknown>).clientWidth;
    }
    if (originalClientHeightDescriptor) {
      Object.defineProperty(HTMLElement.prototype, 'clientHeight', originalClientHeightDescriptor);
    } else {
      delete (HTMLElement.prototype as unknown as Record<string, unknown>).clientHeight;
    }
    elementSizesStubbed = false;
  }
  vi.unstubAllGlobals();
});

describe('MapView — ResizeObserver-gated mount', () => {
  it('does NOT call new Map() when container is 0×0 on mount', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    // jsdom returns 0 for clientWidth/clientHeight by default.

    const dispose = render(() => <MapView />, container);

    expect(mapConstructorCalls).toBe(0);
    expect(observeSpy).toHaveBeenCalledTimes(1); // observer watching

    dispose();
    document.body.removeChild(container);
  });

  it('calls new Map() after ResizeObserver fires with size > 0', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    const dispose = render(() => <MapView />, container);

    expect(mapConstructorCalls).toBe(0);

    fireResize(400, 300);

    expect(mapConstructorCalls).toBe(1);
    expect(disconnectSpy).toHaveBeenCalled(); // observer disconnected after init

    dispose();
    document.body.removeChild(container);
  });

  it('does NOT re-initialize on subsequent ResizeObserver entries', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    const dispose = render(() => <MapView />, container);

    fireResize(400, 300);
    // Observer is disconnected after first fire, but verify the guard directly.
    observerCallback?.([
      { contentRect: { width: 600, height: 400 } } as unknown as ResizeObserverEntry,
    ]);

    expect(mapConstructorCalls).toBe(1);

    dispose();
    document.body.removeChild(container);
  });

  it('calls new Map() synchronously when container already has size', () => {
    // Stub ALL element sizes globally so MapView's internal div ref also has dimensions.
    // Cleanup is handled in afterEach using the module-level original descriptors.
    stubAllElementSizes(800, 600);

    const container = document.createElement('div');
    document.body.appendChild(container);

    const dispose = render(() => <MapView />, container);

    expect(mapConstructorCalls).toBe(1);
    expect(observeSpy).not.toHaveBeenCalled(); // no observer needed

    dispose();
    document.body.removeChild(container);
  });

  it('calls map.remove() on cleanup after map was initialized', () => {
    stubAllElementSizes(800, 600);

    const container = document.createElement('div');
    document.body.appendChild(container);

    const dispose = render(() => <MapView />, container);

    expect(mapConstructorCalls).toBe(1);

    dispose();

    expect(lastMapInstance?.remove).toHaveBeenCalledTimes(1);

    document.body.removeChild(container);
  });

  it('disconnects observer on cleanup when map was never initialized', () => {
    const container = document.createElement('div');
    // Stays 0×0 — observer is created but never fires before cleanup.
    document.body.appendChild(container);

    const dispose = render(() => <MapView />, container);

    expect(mapConstructorCalls).toBe(0);
    expect(observeSpy).toHaveBeenCalledTimes(1);

    dispose();

    expect(disconnectSpy).toHaveBeenCalled();
    expect(lastMapInstance).toBeNull(); // map never created

    document.body.removeChild(container);
  });

  it('ignores ResizeObserver entries with zero width or height', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    const dispose = render(() => <MapView />, container);

    fireResize(0, 0);
    expect(mapConstructorCalls).toBe(0);

    fireResize(100, 0);
    expect(mapConstructorCalls).toBe(0);

    fireResize(0, 100);
    expect(mapConstructorCalls).toBe(0);

    fireResize(100, 100);
    expect(mapConstructorCalls).toBe(1);

    dispose();
    document.body.removeChild(container);
  });
});
