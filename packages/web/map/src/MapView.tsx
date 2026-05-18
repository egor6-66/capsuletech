import maplibregl, {
  type LngLatBoundsLike,
  type LngLatLike,
  type StyleSpecification,
} from 'maplibre-gl';
import { createEffect, createSignal, type JSX, onCleanup, onMount } from 'solid-js';

import { MapContext } from './context';

export interface IMapViewProps {
  /** Style URL или inline StyleSpecification. По умолчанию — demotiles MapLibre (для smoke). */
  style?: string | StyleSpecification;
  center?: LngLatLike;
  zoom?: number;
  minZoom?: number;
  maxZoom?: number;
  maxBounds?: LngLatBoundsLike;
  bearing?: number;
  pitch?: number;
  /** Класс/стиль контейнера. По умолчанию — 100%/100%. */
  class?: string;
  classList?: Record<string, boolean | undefined>;
  /** Колбэк после `load` — удобно для императивных слоёв. */
  onLoad?: (map: maplibregl.Map) => void;
  children?: JSX.Element;
}

const DEFAULT_STYLE = 'https://demotiles.maplibre.org/style.json';

/**
 * Корневой компонент карты. Маунтит maplibregl.Map на собственный div,
 * прокидывает instance через <MapContext> для дочерних слоёв, реактивно
 * синхронизирует center/zoom/bearing/pitch, dispose при unmount.
 *
 * Реактивность:
 *   - style → setStyle (тяжёлая операция, дёргается только при смене ссылки)
 *   - center/zoom/bearing/pitch → set*() без анимации (jumpTo по сути)
 *
 * Сложные сценарии (flyTo/easeTo с кастомным duration) — через useMap() в
 * дочернем компоненте.
 */
export const MapView = (props: IMapViewProps) => {
  let container!: HTMLDivElement;
  const [map, setMap] = createSignal<maplibregl.Map | undefined>(undefined);

  onMount(() => {
    const instance = new maplibregl.Map({
      container,
      style: props.style ?? DEFAULT_STYLE,
      center: props.center,
      zoom: props.zoom,
      minZoom: props.minZoom,
      maxZoom: props.maxZoom,
      maxBounds: props.maxBounds,
      bearing: props.bearing,
      pitch: props.pitch,
    });

    instance.once('load', () => {
      props.onLoad?.(instance);
    });

    setMap(instance);

    onCleanup(() => {
      instance.remove();
      setMap(undefined);
    });
  });

  // Реактивные апдейты — после монтирования.
  createEffect(() => {
    const m = map();
    if (!m) return;
    const s = props.style;
    if (s !== undefined) m.setStyle(s);
  });

  createEffect(() => {
    const m = map();
    if (!m || props.center === undefined) return;
    m.setCenter(props.center);
  });

  createEffect(() => {
    const m = map();
    if (!m || props.zoom === undefined) return;
    m.setZoom(props.zoom);
  });

  createEffect(() => {
    const m = map();
    if (!m || props.bearing === undefined) return;
    m.setBearing(props.bearing);
  });

  createEffect(() => {
    const m = map();
    if (!m || props.pitch === undefined) return;
    m.setPitch(props.pitch);
  });

  return (
    <MapContext.Provider value={{ map }}>
      <div
        ref={container}
        class={props.class}
        classList={props.classList}
        style={props.class ? undefined : { width: '100%', height: '100%' }}
      />
      {props.children}
    </MapContext.Provider>
  );
};
