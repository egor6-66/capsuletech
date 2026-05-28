import type { JSX } from 'solid-js';

import { Source } from './Source';
import { Terrain } from './Terrain';

export interface ITerrainPresetProps {
  /**
   * URL raster-dem источника (обязательный).
   *
   * `TerrainPreset` не задаёт URL по умолчанию — внешние tile-серверы нарушают
   * air-gapped requirement. Пользователь обязан явно указать источник DEM.
   *
   * Публичные варианты (требуют интернет):
   * - AWS Terrarium (без ключа, 256px):
   *   `'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'`
   * - MapTiler Terrain (требует API-ключ, 512px):
   *   `'https://api.maptiler.com/tiles/terrain-rgb/{z}/{x}/{y}.png?key=YOUR_KEY'`
   *
   * Для air-gapped environments: разверни selfhosted raster-dem tile server и передай
   * его URL сюда.
   */
  url: string;
  /**
   * Размер тайла источника.
   * AWS Terrarium использует 256px; MapTiler Terrain — 512px.
   * @default 256
   */
  tileSize?: number;
  /**
   * Коэффициент преувеличения рельефа. 1 = реальный масштаб.
   * @default 1
   */
  exaggeration?: number;
  /** Дочерние элементы — рендерятся после монтирования Source + Terrain. */
  children?: JSX.Element;
}

/**
 * Preset для 3D-рельефа: добавляет raster-dem Source + Terrain в одном компоненте.
 *
 * **Opt-in feature**: требует внешний raster-dem tile server. Без `url` компонент
 * не смонтируется (TypeScript выдаст ошибку — prop обязательный).
 *
 * Рекомендуется устанавливать `pitch` на `<MapView>` (например, 60°) для лучшей визуализации.
 *
 * ```tsx
 * // AWS Terrarium (публичный, без ключа):
 * <MapView pitch={60} bearing={-20}>
 *   <TerrainPreset
 *     url="https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"
 *     exaggeration={1.5}
 *   />
 * </MapView>
 * ```
 *
 * ```tsx
 * // MapTiler Terrain (требует API-ключ):
 * <TerrainPreset
 *   url="https://api.maptiler.com/tiles/terrain-rgb/{z}/{x}/{y}.png?key=YOUR_KEY"
 *   tileSize={512}
 * />
 * ```
 *
 * ```tsx
 * // Selfhosted (air-gapped):
 * <TerrainPreset url="https://tiles.internal/terrain/{z}/{x}/{y}.png" tileSize={256} />
 * ```
 */
export const TerrainPreset = (props: ITerrainPresetProps) => {
  const tileSize = () => props.tileSize ?? 256;

  return (
    <>
      <Source
        id="__terrain-preset-dem__"
        spec={{
          type: 'raster-dem',
          tiles: [props.url],
          tileSize: tileSize(),
          encoding: 'terrarium',
        }}
      />
      <Terrain source="__terrain-preset-dem__" exaggeration={props.exaggeration ?? 1} />
      {props.children}
    </>
  );
};
