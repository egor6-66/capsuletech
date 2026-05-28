import type { TerrainSpecification } from 'maplibre-gl';
import { createEffect, onCleanup } from 'solid-js';

import { useMap } from './context';

export interface ITerrainProps {
  /** Id источника типа `raster-dem` для рельефа (должен быть добавлен через `<Source>`). */
  source: string;
  /**
   * Коэффициент преувеличения рельефа. 1 = реальный масштаб, >1 усиливает горы.
   * @default 1
   */
  exaggeration?: number;
}

/**
 * Включает 3D-рельеф через `map.setTerrain({ source, exaggeration })`.
 * При unmount сбрасывает terrain через `map.setTerrain(null)`.
 *
 * ## Реактивность
 *
 * Реактивен по `source` и `exaggeration` — обновления применяются немедленно
 * через повторный `setTerrain({ source, exaggeration })`.
 *
 * ## Style preservation (setStyle / theme switch)
 *
 * `map.setStyle()` сбрасывает terrain. Компонент слушает `'styledata'` и
 * автоматически пере-применяет terrain после полной загрузки нового стиля
 * (`isStyleLoaded() === true`). Гарантирует, что terrain всегда активен
 * пока компонент смонтирован (при условии, что source тоже восстановлен — порядок
 * гарантируется через JSX children order в Solid).
 *
 * Требует `<Source id={source} spec={{ type: 'raster-dem', ... }}>` где-то выше по дереву.
 *
 * ```tsx
 * <MapView pitch={60}>
 *   <Source id="terrain-dem" spec={{ type: 'raster-dem', url: 'https://...', tileSize: 512 }} />
 *   <Terrain source="terrain-dem" exaggeration={1.5} />
 * </MapView>
 * ```
 */
export const Terrain = (props: ITerrainProps) => {
  const { map } = useMap();

  createEffect(() => {
    const m = map();
    if (!m) return;

    // Track both props — re-run on any change
    const spec: TerrainSpecification = {
      source: props.source,
      exaggeration: props.exaggeration ?? 1,
    };

    const applyTerrain = () => {
      m.setTerrain(spec);
    };

    if (m.isStyleLoaded()) {
      applyTerrain();
    } else {
      m.once('load', applyTerrain);
      onCleanup(() => m.off('load', applyTerrain));
    }

    // Re-apply when style swaps out (setStyle resets terrain to null)
    const onStyleData = () => {
      if (!m.isStyleLoaded()) return;
      // Always re-apply terrain after style swap; setTerrain is idempotent
      m.setTerrain(spec);
    };
    m.on('styledata', onStyleData);

    onCleanup(() => {
      m.off('styledata', onStyleData);
      // setTerrain(null) отключает рельеф без удаления источника
      try {
        m.setTerrain(null);
      } catch {
        // Map may already be disposed
      }
    });
  });

  return null;
};
