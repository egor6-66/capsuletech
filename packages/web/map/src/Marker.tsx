import type { Marker as MaplibreMarker } from 'maplibre-gl';
import maplibregl from 'maplibre-gl';
import { createEffect, onCleanup, untrack } from 'solid-js';

import { useMap } from './context';

export interface IMarkerProps<T = unknown> {
  /** Долгота маркера. */
  lng: number;
  /** Широта маркера. */
  lat: number;
  /**
   * Якорь — какая точка маркера привязана к координатам.
   * @default 'center'
   */
  anchor?:
    | 'center'
    | 'top'
    | 'bottom'
    | 'left'
    | 'right'
    | 'top-left'
    | 'top-right'
    | 'bottom-left'
    | 'bottom-right';
  /**
   * Произвольные данные, прикреплённые к маркеру.
   * Возвращаются в `onClick` первым аргументом — типизированы через generic `T`.
   *
   * Координаты можно хранить прямо в data если нужны в click-handler:
   * ```tsx
   * <Marker lng={call.location.lng} lat={call.location.lat} data={call}
   *   onClick={(call) => openPanel(call)} />
   * ```
   */
  data?: T;
  /**
   * Click handler. Получает `data` (с полной типизацией через generic T) и нативный `MouseEvent`.
   *
   * Читает **актуальное** значение `data` на момент клика — реактивно без пересоздания маркера.
   *
   * @param data — текущее значение `props.data`
   * @param event — нативный MouseEvent
   */
  onClick?: (data: T, event: MouseEvent) => void;
}

/**
 * Declarative MapLibre marker. Создаёт `maplibregl.Marker` с дефолтным pin-визуалом
 * и добавляет его на карту через `.addTo(map)`. При unmount — `.remove()`.
 *
 * Должен быть дочерним элементом `<MapView>` — использует `useMap()`.
 *
 * ## Реактивность
 *
 * - `lng` / `lat` — reactive: при изменении вызывает `marker.setLngLat([lng, lat])`
 *   без пересоздания маркера (быстро, DOM-элемент остаётся тем же).
 * - `anchor` — изменение требует пересоздания (`anchor` только в constructor).
 *   Компонент выполняет `remove()` + `new Marker({ anchor })` + `addTo(map)` автоматически.
 * - `data` — реактивно без DOM-изменений: click handler читает актуальное значение
 *   через замыкание на момент вызова.
 *
 * ## Vs styledata
 *
 * Маркер — DOM-элемент поверх canvas, а не часть render pipeline MapLibre.
 * `map.setStyle()` его **не стирает** — `'styledata'` listener не нужен.
 * Это ключевое отличие от `<Source>`, `<Layer>`, `<Terrain>`, `<Sky>`.
 *
 * ## Custom HTML маркеры
 *
 * Поддержка custom JSX-children через `Solid render()` — Phase 2 (отдельный PR).
 * Пока используется дефолтный maplibre pin (синяя капля).
 *
 * ```tsx
 * <MapView center={[30.315, 59.939]} zoom={12}>
 *   {calls.map((call) => (
 *     <Marker
 *       lng={call.location.lng}
 *       lat={call.location.lat}
 *       data={call}
 *       onClick={(call, e) => openPanel(call)}
 *     />
 *   ))}
 * </MapView>
 * ```
 */
export const Marker = <T = unknown>(props: IMarkerProps<T>) => {
  const { map } = useMap();

  // Mutable ref shared between the two effects below.
  // Effect 1 (lifecycle) writes it; Effect 2 (position) reads it.
  let markerRef: MaplibreMarker | undefined;

  // -------------------------------------------------------------------------
  // Effect 1 — lifecycle: create / recreate marker when anchor or map changes.
  //
  // Tracks:  map(), props.anchor
  // Untracks: props.lng, props.lat (initial position only — subsequent changes
  //           are handled by Effect 2 which calls setLngLat without recreating).
  // -------------------------------------------------------------------------
  createEffect(() => {
    const m = map();
    if (!m) return;

    // anchor is a constructor-only param → tracked here → recreate on change.
    const anchor = props.anchor;

    // Read initial position without tracking — position changes are handled
    // by Effect 2 (setLngLat), not by recreating the marker.
    const initialLng = untrack(() => props.lng);
    const initialLat = untrack(() => props.lat);

    const marker = new maplibregl.Marker({ anchor });
    marker.setLngLat([initialLng, initialLat]);
    marker.addTo(m);

    // Store ref so Effect 2 can call setLngLat on the current marker instance.
    markerRef = marker;

    // Click event — reads props.data in the handler closure at call-time (latest value).
    const handleClick = (event: MouseEvent) => {
      props.onClick?.(props.data as T, event);
    };
    const el = marker.getElement();
    el.addEventListener('click', handleClick);

    onCleanup(() => {
      el.removeEventListener('click', handleClick);
      marker.remove();
      markerRef = undefined;
    });
  });

  // -------------------------------------------------------------------------
  // Effect 2 — reactive position update: setLngLat without recreating marker.
  //
  // Tracks:  map(), props.lng, props.lat
  // Skips:   initial run (marker not yet added or just created in Effect 1).
  //
  // Uses createEffect<boolean> "first run" flag pattern (same as Source.tsx)
  // to suppress the initial call — initial position is set in Effect 1.
  // -------------------------------------------------------------------------
  createEffect<boolean>((initialized) => {
    const m = map();
    if (!m) return initialized;

    const lng = props.lng;
    const lat = props.lat;

    if (!initialized) return true;

    markerRef?.setLngLat([lng, lat]);
    return initialized;
  }, false);

  return null;
};
