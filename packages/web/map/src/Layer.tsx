import type { FilterSpecification, LayerSpecification } from 'maplibre-gl';
import { createEffect, onCleanup } from 'solid-js';

import { useMap } from './context';

// Utility: extract paint/layout keys from a layer spec as a record
type PaintRecord = Record<string, unknown>;
type LayoutRecord = Record<string, unknown>;

export interface ILayerProps {
  /** Спецификация слоя MapLibre (id, type, source, paint, layout, filter и т.д.). */
  spec: LayerSpecification;
  /**
   * Вставить слой перед слоем с этим id (аналог `map.addLayer(spec, beforeId)`).
   * Если не задан — слой добавляется поверх всех.
   */
  beforeId?: string;
}

/**
 * Declarative MapLibre layer. Вызывает `map.addLayer(spec, beforeId)` после load
 * и `map.removeLayer(spec.id)` при unmount.
 *
 * Должен быть дочерним элементом `<MapView>` — использует `useMap()`.
 *
 * ## Реактивность (что обновляется без пересоздания слоя)
 *
 * - `spec.paint` — любое изменение ключей → `setPaintProperty` для каждого изменённого.
 * - `spec.layout` — любое изменение → `setLayoutProperty`.
 * - `spec.filter` — изменение → `setFilter`.
 * - `spec.minzoom` / `spec.maxzoom` — изменение → `setLayerZoomRange`.
 *
 * ## Structural changes (требуют пересоздания слоя)
 *
 * `spec.type`, `spec.source`, `spec.source-layer` — структурные поля, MapLibre не
 * поддерживает их live update. При изменении этих полей компонент выполняет
 * `removeLayer` + `addLayer` (полное пересоздание). Если такое поведение нежелательно
 * (flickering, порядок слоёв) — используй conditional render с ключом.
 *
 * ## Style preservation (setStyle / theme switch)
 *
 * `map.setStyle()` стирает все user-added layers. Компонент слушает `'styledata'`
 * и автоматически пере-добавляет layer после полной загрузки нового стиля.
 *
 * ```tsx
 * <MapView>
 *   <Source id="my-data" spec={{ type: 'geojson', data: '/data.geojson' }} />
 *   <Layer spec={{ id: 'my-layer', type: 'fill', source: 'my-data', paint: { 'fill-color': '#888' } }} />
 * </MapView>
 * ```
 */
export const Layer = (props: ILayerProps) => {
  const { map } = useMap();

  // --- Mount / styledata re-add effect ---
  createEffect(() => {
    const m = map();
    if (!m) return;

    // Read structural fields to track them (triggers re-run on change)
    const spec = props.spec;
    const layerId = spec.id;
    const beforeId = props.beforeId;

    const addLayer = () => {
      if (m.getLayer(layerId)) {
        // Structural change path: remove old layer and re-add with new spec
        try {
          m.removeLayer(layerId);
        } catch {
          // Ignore if already removed
        }
      }
      m.addLayer(spec, beforeId);
    };

    if (m.isStyleLoaded()) {
      addLayer();
    } else {
      m.once('load', addLayer);
      onCleanup(() => m.off('load', addLayer));
    }

    // Re-apply when style swaps out
    const onStyleData = () => {
      if (!m.isStyleLoaded()) return;
      if (!m.getLayer(layerId)) {
        m.addLayer(spec, beforeId);
      }
    };
    m.on('styledata', onStyleData);

    onCleanup(() => {
      m.off('styledata', onStyleData);
      if (m.getLayer(layerId)) {
        try {
          m.removeLayer(layerId);
        } catch {
          // Silently ignore during mass-unmount (map may already be disposed)
        }
      }
    });
  });

  // --- Reactive paint properties ---
  // Tracks spec.paint by reference; fires when paint object reference changes.
  // For granular per-key reactivity the caller should use a reactive store/signal
  // producing a new paint object — Solid sees the new reference and re-runs this effect.
  createEffect(() => {
    const m = map();
    if (!m) return;
    const spec = props.spec;
    const paint = (spec as { paint?: PaintRecord }).paint;
    if (!paint) return;
    const layerId = spec.id;
    if (!m.getLayer(layerId)) return;
    for (const [key, value] of Object.entries(paint)) {
      m.setPaintProperty(layerId, key, value);
    }
  });

  // --- Reactive layout properties ---
  createEffect(() => {
    const m = map();
    if (!m) return;
    const spec = props.spec;
    const layout = (spec as { layout?: LayoutRecord }).layout;
    if (!layout) return;
    const layerId = spec.id;
    if (!m.getLayer(layerId)) return;
    for (const [key, value] of Object.entries(layout)) {
      m.setLayoutProperty(layerId, key, value);
    }
  });

  // --- Reactive filter ---
  createEffect(() => {
    const m = map();
    if (!m) return;
    const spec = props.spec;
    const filter = (spec as { filter?: FilterSpecification }).filter;
    // Intentionally track even if undefined (removing filter is valid via setFilter(undefined))
    const layerId = spec.id;
    if (!m.getLayer(layerId)) return;
    m.setFilter(layerId, filter);
  });

  // --- Reactive zoom range ---
  createEffect(() => {
    const m = map();
    if (!m) return;
    const spec = props.spec;
    const minzoom = (spec as { minzoom?: number }).minzoom;
    const maxzoom = (spec as { maxzoom?: number }).maxzoom;
    if (minzoom === undefined && maxzoom === undefined) return;
    const layerId = spec.id;
    if (!m.getLayer(layerId)) return;
    m.setLayerZoomRange(layerId, minzoom ?? 0, maxzoom ?? 24);
  });

  return null;
};
