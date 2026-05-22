/* @vitest-environment jsdom */
/**
 * MapView ResizeObserver-gated mount tests.
 *
 * SKIPPED: The original implementation used a manual ResizeObserver gate
 * before calling `new maplibre.Map()`. After the solid-map-gl rewrite,
 * MapView delegates mounting entirely to solid-map-gl (GIShub4), which
 * handles its own lifecycle. These tests are stale.
 *
 * TODO: replace with integration tests that mock solid-map-gl internals
 * if ResizeObserver-gate behaviour needs to be re-introduced.
 */

import { describe, it } from 'vitest';

describe.skip('MapView — ResizeObserver-gated mount (stale: pre-solid-map-gl)', () => {
  it('does NOT call new Map() when container is 0x0 on mount', () => {});
  it('calls new Map() after ResizeObserver fires with size > 0', () => {});
  it('does NOT re-initialize on subsequent ResizeObserver entries', () => {});
  it('calls new Map() synchronously when container already has size', () => {});
  it('calls map.remove() on cleanup after map was initialized', () => {});
  it('disconnects observer on cleanup when map was never initialized', () => {});
  it('ignores ResizeObserver entries with zero width or height', () => {});
});
