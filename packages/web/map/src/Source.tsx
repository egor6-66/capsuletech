import type { GeoJSONSource, GeoJSONSourceSpecification, SourceSpecification } from 'maplibre-gl';
import { createEffect, onCleanup, untrack } from 'solid-js';

import { useMap } from './context';

export interface ISourceProps {
  /** Уникальный идентификатор источника (используется в `<Layer source={id}>` и т.д.). */
  id: string;
  /** Спецификация источника данных MapLibre (type + все поля для данного типа). */
  spec: SourceSpecification;
}

/**
 * Declarative MapLibre source. Вызывает `map.addSource(id, spec)` после load
 * и `map.removeSource(id)` при unmount.
 *
 * Должен быть дочерним элементом `<MapView>` — использует `useMap()`.
 *
 * ## Реактивность
 *
 * **GeoJSON** (`spec.type === 'geojson'`): изменение `spec.data` вызывает
 * `(map.getSource(id) as GeoJSONSource).setData(newData)`. Это инкрементальный
 * нативный API — source не пересоздаётся, данные обновляются без removeSource.
 *
 * **Другие типы** (raster, vector, raster-dem и т.д.): MapLibre не предоставляет
 * `setSource()`. При изменении `spec` у non-GeoJSON источника компонент делает
 * `removeSource` → `addSource`. Это безопасно только если нет layer'ов, зависящих
 * от источника в данный момент. Для безопасной смены non-GeoJSON source с зависимыми
 * слоями — используй conditional render (unmount/remount компонента с key).
 *
 * ## Style preservation (setStyle / theme switch)
 *
 * `map.setStyle()` стирает все user-added sources. Компонент слушает `'styledata'`
 * и автоматически пере-добавляет source после полной загрузки нового стиля
 * (`isStyleLoaded() === true`). Гарантирует, что source всегда присутствует
 * пока компонент смонтирован.
 *
 * ```tsx
 * <MapView>
 *   <Source id="terrain-dem" spec={{ type: 'raster-dem', url: '...', tileSize: 512 }} />
 * </MapView>
 * ```
 */
export const Source = (props: ISourceProps) => {
  const { map } = useMap();

  // --- Mount / unmount / styledata re-add effect ---
  // Tracks only map() and props.id. The spec is read via `untrack` to avoid
  // re-running this effect on spec changes — spec changes are handled separately
  // in the reactive-update effect below.
  createEffect(() => {
    const m = map();
    if (!m) return;
    const id = props.id;

    // Read spec without tracking (to avoid re-running on spec changes)
    const spec = untrack(() => props.spec);

    const addSource = () => {
      if (!m.getSource(id)) {
        m.addSource(id, spec);
      }
    };

    if (m.isStyleLoaded()) {
      addSource();
    } else {
      m.once('load', addSource);
      onCleanup(() => m.off('load', addSource));
    }

    // Re-apply when style swaps out (setStyle wipes all user sources)
    const onStyleData = () => {
      if (!m.isStyleLoaded()) return;
      if (!m.getSource(id)) {
        // Re-add using current spec (read via closure over reactive props.spec)
        m.addSource(id, props.spec);
      }
    };
    m.on('styledata', onStyleData);

    onCleanup(() => {
      m.off('styledata', onStyleData);
      // Guard: map may already be removed (parent MapView unmount)
      if (m.getSource(id)) {
        try {
          m.removeSource(id);
        } catch {
          // Source may be in use by layers — silently ignore during mass-unmount
        }
      }
    });
  });

  // --- Reactive GeoJSON data update ---
  // Tracks props.spec (the whole spec object reference). On re-run after initial
  // mount: if type is geojson and source exists → call setData with new data.
  // Uses a "first run" flag (via effect's prev parameter) to skip the initial call.
  createEffect<boolean>((initialized) => {
    const m = map();
    if (!m) return initialized;
    const spec = props.spec;
    if (spec.type !== 'geojson') return true; // not geojson, skip entirely

    const id = props.id;
    const data = (spec as GeoJSONSourceSpecification).data;

    if (!initialized) {
      // Initial run — addSource is handled by the mount effect; no setData needed
      return true;
    }

    // Subsequent runs — source should already exist; call setData
    const existing = m.getSource(id) as GeoJSONSource | undefined;
    if (!existing) return initialized;

    existing.setData(data as Parameters<GeoJSONSource['setData']>[0]);
    return initialized;
  }, false);

  // --- Reactive non-GeoJSON spec change (removeSource + addSource) ---
  // Tracks props.spec. On re-run after initial mount: if type is NOT geojson
  // and source already exists → remove + add with new spec.
  // Uses "first run" flag to skip the initial call.
  createEffect<boolean>((initialized) => {
    const m = map();
    if (!m) return initialized;
    const spec = props.spec;
    if (spec.type === 'geojson') return true; // geojson handled above

    const id = props.id;

    if (!initialized) {
      // Initial run — addSource is handled by the mount effect
      return true;
    }

    // Subsequent runs — remove old source and add with new spec
    if (m.getSource(id)) {
      try {
        m.removeSource(id);
      } catch {
        // Layer dependencies may prevent removal; silent
      }
    }
    if (!m.getSource(id)) {
      m.addSource(id, spec);
    }
    return initialized;
  }, false);

  return null;
};
