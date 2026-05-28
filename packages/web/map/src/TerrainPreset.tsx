import type { JSX } from 'solid-js';

import { Source } from './Source';
import { Terrain } from './Terrain';

/**
 * URL публичного raster-dem источника (AWS Terrarium, без API-ключа).
 * Покрывает весь земной шар, тайлы 256px, формат Terrarium.
 */
const TERRAIN_DEM_URL = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';

export interface ITerrainPresetProps {
  /**
   * URL raster-dem источника. По умолчанию — AWS Terrarium tiles (без API-ключа).
   * Чтобы использовать MapTiler Terrain или другой источник — передай сюда свой URL.
   */
  url?: string;
  /**
   * Размер тайла источника. AWS Terrarium использует 256px.
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
 * Использует публичные AWS Terrarium tiles без API-ключа.
 *
 * Рекомендуется устанавливать `pitch` на `<MapView>` (например, 60°) для лучшей визуализации.
 *
 * ```tsx
 * <MapView pitch={60} bearing={-20}>
 *   <TerrainPreset exaggeration={1.5} />
 * </MapView>
 * ```
 *
 * Для использования MapTiler или другого DEM:
 * ```tsx
 * <TerrainPreset url="https://api.maptiler.com/tiles/terrain-rgb/{z}/{x}/{y}.png?key=YOUR_KEY"
 *                tileSize={512} />
 * ```
 */
export const TerrainPreset = (props: ITerrainPresetProps) => {
  const url = () => props.url ?? TERRAIN_DEM_URL;
  const tileSize = () => props.tileSize ?? 256;

  return (
    <>
      <Source
        id="__terrain-preset-dem__"
        spec={{
          type: 'raster-dem',
          tiles: [url()],
          tileSize: tileSize(),
          encoding: 'terrarium',
        }}
      />
      <Terrain source="__terrain-preset-dem__" exaggeration={props.exaggeration ?? 1} />
      {props.children}
    </>
  );
};
