import type {
  LngLatBoundsLike,
  LngLatLike,
  Map as MaplibreMap,
  StyleSpecification,
} from 'maplibre-gl';
import * as maplibre from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { createEffect, createSignal, type JSX } from 'solid-js';
import MapGL, { type Viewport } from 'solid-map-gl';

import { MapContext } from './context';
import { DARK_MATTER, POSITRON } from './styles';

export interface IMapViewProps {
  /** URL стиля или inline StyleSpecification. По умолчанию — demotiles MapLibre. */
  style?: string | StyleSpecification;
  /**
   * Стиль для тёмной темы. Если задан, переключается автоматически:
   *   - при `prefers-color-scheme: dark`,
   *   - при наличии класса `.dark` на `<body>` (capsule DarkModeToggle дублирует туда).
   * При отсутствии — `style` используется в обоих режимах.
   */
  darkStyle?: string | StyleSpecification;
  /**
   * Показывать ли блок attribution (правый-нижний угол). По умолчанию `false`
   * (рекомендация: верстай attribution отдельно в footer'е, если этого требует
   * лицензия источника тайлов).
   */
  attributionControl?: boolean;
  /** Координаты центра (`[lng, lat]` или объект `{lng, lat}`). */
  center?: LngLatLike;
  /** Уровень зума (число). */
  zoom?: number;
  /** Минимальный допустимый zoom (zoom-out clamp). */
  minZoom?: number;
  /** Максимальный допустимый zoom (zoom-in clamp). */
  maxZoom?: number;
  /** Ограничивающая рамка камеры — panning не выйдет за эти координаты. */
  maxBounds?: LngLatBoundsLike;
  /** Поворот карты в градусах. */
  bearing?: number;
  /** Наклон карты в градусах. */
  pitch?: number;
  /** CSS-класс контейнера карты. */
  class?: string;
  /** Solid-овский `classList` для контейнера. */
  classList?: Record<string, boolean | undefined>;
  /** Inline CSS-стили контейнера (overrides default 100% width/height). */
  style_container?: JSX.CSSProperties;
  /** Дёргается один раз после `'load'` — удобно для императивных слоёв. */
  onLoad?: (map: MaplibreMap) => void;
  /**
   * Срабатывает на любое движение камеры (drag, zoom, pitch, bearing).
   * Для controlled-mode: поднимите viewport во внешний state и передавайте
   * через `center`/`zoom`/`pitch`/`bearing`.
   */
  onViewportChange?: (viewport: Viewport) => void;
  /** Дочерние компоненты (`<Source/>`, `<Layer/>`, `<Marker/>`, …). */
  children?: JSX.Element;
}

const DEFAULT_STYLE = POSITRON;
const DEFAULT_DARK_STYLE = DARK_MATTER;

/**
 * Обёртка над `solid-map-gl` (`<MapGL/>` от GIShub4) с подменой rendering
 * engine на MapLibre GL через `mapLib`.
 *
 * **Архитектурные решения:**
 *   - `viewport` хранится во внутреннем сигнале (как требует official docs
 *     solid-map-gl) — иначе reactive props ломают первичную инициализацию
 *     `_calcMatrices` и приводят к `Invalid LngLat (NaN, NaN)`.
 *   - Внешние изменения `center/zoom/pitch/bearing` синхронизируются через
 *     `createEffect`. Изнутри (drag/zoom user'ом) — наружу через
 *     `onViewportChange`.
 *   - `mapLib={maplibre}` — namespace-импорт (важно: не default). С default
 *     solid-map-gl не находит `mapLib.Map`.
 *   - Подмешан `MapContext.Provider` — дочерним компонентам доступен
 *     инстанс через `useMap()`.
 *
 * Контракт `IMapViewProps` — наш домен, расширяемый. Под капотом мапим
 * на solid-map-gl shape (`options` + `viewport`).
 */
export const MapView = (props: IMapViewProps) => {
  const [map, setMap] = createSignal<MaplibreMap | undefined>(undefined);

  // Сборка viewport-объекта: ВКЛЮЧАЕМ только определённые поля. undefined
  // в `center`/`zoom`/`pitch`/`bearing` ломает _calcMatrices внутри maplibre
  // при инициализации.
  const buildViewport = (): Viewport => {
    const v: Viewport = {};
    if (props.center !== undefined) v.center = props.center;
    if (props.zoom !== undefined) v.zoom = props.zoom;
    if (props.pitch !== undefined) v.pitch = props.pitch;
    if (props.bearing !== undefined) v.bearing = props.bearing;
    return v;
  };

  // Внутренний viewport-сигнал: solid-map-gl мутирует его на user-interactions,
  // мы переписываем его снаружи через `createEffect` при изменении props.
  const [viewport, setViewport] = createSignal<Viewport>(buildViewport());

  // Sync prop → viewport (controlled-mode): если родитель меняет center/zoom,
  // карта подвигается. НЕ создаёт цикл с `onViewportChange`, т.к. setter
  // вызывается только когда snapshot изменился по содержанию.
  createEffect(() => {
    const next = buildViewport();
    const cur = viewport();
    if (
      JSON.stringify(cur.center) === JSON.stringify(next.center) &&
      cur.zoom === next.zoom &&
      cur.pitch === next.pitch &&
      cur.bearing === next.bearing
    ) {
      return;
    }
    setViewport(next);
  });

  // solid-map-gl types target mapbox-gl; maplibre namespace import is compatible at runtime.
  const MapGLAny = MapGL as any;

  return (
    <MapContext.Provider value={{ map }}>
      <MapGLAny
        mapLib={maplibre}
        darkStyle={(props.darkStyle ?? DEFAULT_DARK_STYLE) as any}
        options={(() => {
          const o: any = {
            style: props.style ?? DEFAULT_STYLE,
            // По умолчанию — без attribution-блока; user может вернуть `attributionControl={true}`.
            attributionControl: props.attributionControl ?? false,
          };
          if (props.minZoom !== undefined) o.minZoom = props.minZoom;
          if (props.maxZoom !== undefined) o.maxZoom = props.maxZoom;
          if (props.maxBounds !== undefined) o.maxBounds = props.maxBounds;
          return o;
        })()}
        viewport={viewport()}
        onViewportChange={(v: Viewport) => {
          setViewport(v);
          props.onViewportChange?.(v);
        }}
        class={props.class}
        classList={props.classList}
        style={
          props.style_container ??
          (props.class || props.classList
            ? undefined
            : { width: '100%', height: '100%' })
        }
        onMapLoaded={((m: any) => {
          setMap(m);
          props.onLoad?.(m);
        }) as any}
      >
        {props.children}
      </MapGLAny>
    </MapContext.Provider>
  );
};
