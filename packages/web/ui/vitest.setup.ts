// vitest setup for packages/web/ui
// Why: jsdom does not implement ResizeObserver, which corvu/resizable uses
// internally. Without this mock the matrix-resize render tests throw
// "ReferenceError: ResizeObserver is not defined".
// The mock records calls but does not actually measure — that is intentional:
// visual sizing is non-deterministic in jsdom and is not what the tests assert.
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
Object.defineProperty(globalThis, 'ResizeObserver', {
  writable: true,
  configurable: true,
  value: ResizeObserverMock,
});

// Why: jsdom does not implement window.matchMedia.
// @capsuletech/web-style/switcher/theme reads matchMedia at module-load time
// (initialDarkMode). Without this stub any test that imports a component
// which transitively imports web-style throws
// "TypeError: window.matchMedia is not a function".
Object.defineProperty(globalThis, 'matchMedia', {
  writable: true,
  configurable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});
