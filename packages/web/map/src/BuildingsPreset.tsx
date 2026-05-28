import type { FillExtrusionLayerSpecification } from 'maplibre-gl';
import type { JSX } from 'solid-js';

import { Layer } from './Layer';

/**
 * 3D-здания из vector tiles (source-layer `"building"` с атрибутом `render_height`).
 *
 * **Требования к стилю (opt-in):**
 * `BuildingsPreset` требует style с vector source, содержащим source-layer `"building"`
 * и атрибут `render_height`. Дефолтные стили `POSITRON` и `DARK_MATTER` (CARTO) **НЕ**
 * содержат `render_height` — здания будут отображаться плоскими (height = 0).
 *
 * Для получения настоящих 3D-зданий необходимо использовать OpenMapTiles-based стиль:
 * - **OpenFreeMap** (публичный, без ключа): `'https://tiles.openfreemap.org/styles/positron'`
 * - **MapTiler** (требует API-ключ): `'https://api.maptiler.com/maps/streets/style.json?key=KEY'`
 * - **Selfhosted OpenMapTiles** (air-gapped): укажи свой URL в `style` prop `<MapView>`.
 *
 * Для air-gapped environments: подключи selfhosted OpenMapTiles tile server и передай
 * его style URL через `<MapView style="https://your-server/style.json">`.
 *
 * Default `sourceId: 'openmaptiles'` — это standard OpenMapTiles convention. Если твой
 * style использует другое имя source — передай его явно через `sourceId` prop.
 *
 * ```tsx
 * // Требует OpenMapTiles-based style (не дефолтный CARTO POSITRON):
 * <MapView style="https://tiles.openfreemap.org/styles/positron" pitch={45}>
 *   <BuildingsPreset />
 * </MapView>
 * ```
 *
 * ```tsx
 * // Кастомный цвет:
 * <BuildingsPreset color="#c9a96e" opacity={0.9} />
 * ```
 */
export interface IBuildingsPresetProps {
  /**
   * Id vector source, содержащего данные зданий.
   * @default "openmaptiles"  (стандартный convention для OpenMapTiles-based стилей)
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
  const sourceId = () => props.sourceId ?? 'openmaptiles';
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
      // Высота здания из атрибута render_height (OpenMapTiles tiles) или fallback 0
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
