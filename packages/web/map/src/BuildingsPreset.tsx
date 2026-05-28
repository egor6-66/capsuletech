import type { FillExtrusionLayerSpecification } from 'maplibre-gl';
import type { JSX } from 'solid-js';

import { Layer } from './Layer';

/**
 * 3D-здания из CARTO vector tiles (source `"carto"`, source-layer `"building"`).
 *
 * CARTO Positron и Dark Matter — дефолтные стили `@capsuletech/web-map` — оба включают
 * source `"carto"` с данными зданий, включая высоту (`render_height`).
 * `BuildingsPreset` работает с ними **без дополнительных Source**.
 *
 * Если твой кастомный стиль использует другой source id или source-layer name —
 * используй `<Layer>` напрямую с нужными параметрами.
 *
 * Высота:
 * - `render_height` из CARTO tiles содержит высоту здания в метрах (реальная).
 * - Preset добавляет interpolate expression для плавного появления при zoom ≥ 14.
 *
 * ```tsx
 * <MapView pitch={45}>
 *   <BuildingsPreset />
 * </MapView>
 * ```
 *
 * Кастомный цвет:
 * ```tsx
 * <BuildingsPreset color="#c9a96e" opacity={0.9} />
 * ```
 */
export interface IBuildingsPresetProps {
  /**
   * Id vector source, содержащего данные зданий.
   * @default "carto"  (присутствует в POSITRON и DARK_MATTER стилях)
   */
  sourceId?: string;
  /**
   * Имя source-layer внутри тайлов.
   * @default "building"
   */
  sourceLayer?: string;
  /**
   * Цвет экструзии зданий (CSS-цвет или rgba).
   * @default "#aaa"
   */
  color?: string;
  /**
   * Прозрачность зданий (0..1).
   * @default 0.8
   */
  opacity?: number;
  /**
   * Минимальный zoom для отображения зданий. До этого уровня здания скрыты.
   * @default 14
   */
  minZoom?: number;
  /** Id слоя. Задай своё значение если нужно несколько BuildingsPreset. */
  layerId?: string;
  /** Дочерние элементы — рендерятся после монтирования слоя. */
  children?: JSX.Element;
}

export const BuildingsPreset = (props: IBuildingsPresetProps) => {
  const sourceId = () => props.sourceId ?? 'carto';
  const sourceLayer = () => props.sourceLayer ?? 'building';
  const color = () => props.color ?? '#aaaaaa';
  const opacity = () => props.opacity ?? 0.8;
  const minZoom = () => props.minZoom ?? 14;
  const layerId = () => props.layerId ?? '__buildings-preset-3d__';

  const spec = (): FillExtrusionLayerSpecification => ({
    id: layerId(),
    type: 'fill-extrusion',
    source: sourceId(),
    'source-layer': sourceLayer(),
    minzoom: minZoom(),
    paint: {
      // Высота здания из атрибута render_height (CARTO tiles) или fallback 0
      'fill-extrusion-height': [
        'interpolate',
        ['linear'],
        ['zoom'],
        14,
        0,
        16,
        ['coalesce', ['get', 'render_height'], 0],
      ],
      // Основание (подвал) для стеновой экструзии — обычно 0
      'fill-extrusion-base': [
        'interpolate',
        ['linear'],
        ['zoom'],
        14,
        0,
        16,
        ['coalesce', ['get', 'render_min_height'], 0],
      ],
      'fill-extrusion-color': color(),
      'fill-extrusion-opacity': opacity(),
    },
  });

  return (
    <>
      <Layer spec={spec()} />
      {props.children}
    </>
  );
};
