/* @vitest-environment jsdom */
/**
 * MapView props-passthrough tests.
 *
 * TODO: rewrite to mock `solid-map-gl` (not `solid-maplibre`).
 * The current implementation uses solid-map-gl (GIShub4) under the hood.
 * Skipped until the mock is updated to match the actual dependency.
 */

import { describe, it } from 'vitest';

describe.skip('MapView — props-passthrough (pending solid-map-gl mock)', () => {
  it('forwards style, center, zoom, bearing, pitch, class, onLoad to solid-map-gl', () => {
    // TODO: implement with vi.mock('solid-map-gl', ...)
  });

  it('useMap() throws when called outside <MapView>', () => {
    // TODO: implement
  });
});
