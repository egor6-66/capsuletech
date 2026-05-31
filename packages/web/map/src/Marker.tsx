import type { Marker as MaplibreMarker } from 'maplibre-gl';
import maplibregl from 'maplibre-gl';
import { createEffect, onCleanup, untrack } from 'solid-js';

import { useMap } from './context';

// ---------------------------------------------------------------------------
// Stable custom element helpers
//
// The marker element is created ONCE per Marker instance (or recreated only
// when `anchor` changes). `active` toggling mutates the element's appearance
// in place — no marker reconstruction, no orphaned reactive subscriptions.
// ---------------------------------------------------------------------------

/** Inline SVG teardrop for the active (pin) state. */
const PIN_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="27" height="41" viewBox="0 0 27 41">' +
  '<path fill="#3FB1CE" d="M13.5 0C6.044 0 0 6.044 0 13.5c0 9.375 13.5 27.5 13.5 27.5' +
  'S27 22.875 27 13.5C27 6.044 20.956 0 13.5 0z"/>' +
  '<circle fill="#fff" cx="13.5" cy="13.5" r="5.5"/>' +
  '</svg>';

/**
 * Create a stable container element that can visually switch between
 * dot (inactive) and pin (active) by mutating its innerHTML/style only.
 *
 * The returned element is passed to `new maplibregl.Marker({ element })` once
 * and NEVER replaced — the same DOM node is reused across `active` toggles.
 */
const createStableElement = (active: boolean): HTMLDivElement => {
  const el = document.createElement('div');
  el.style.cssText = 'cursor:pointer;';
  applyActiveAppearance(el, active);
  return el;
};

/**
 * Mutate `el` in-place to reflect the current `active` state.
 * Called once on creation and again on every `active` toggle — no new DOM node.
 */
const applyActiveAppearance = (el: HTMLDivElement, active: boolean): void => {
  if (active) {
    el.style.width = '27px';
    el.style.height = '41px';
    el.style.borderRadius = '';
    el.style.background = '';
    el.style.border = '';
    el.style.boxShadow = '';
    el.innerHTML = PIN_SVG;
  } else {
    el.style.width = '12px';
    el.style.height = '12px';
    el.style.borderRadius = '9999px';
    el.style.background = '#3FB1CE';
    el.style.border = '2px solid rgba(255,255,255,0.85)';
    el.style.boxShadow = '0 0 0 1px rgba(0,0,0,0.25)';
    el.innerHTML = '';
  }
};

export interface IMarkerProps {
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
   * Active variant. When false (default) the marker renders as a small dot
   * (low visual footprint so dense markers don't cover the map). When true it
   * renders the full pin (teardrop) — used to spotlight the selected item.
   *
   * Toggling this prop at runtime updates the marker's appearance in-place
   * (DOM mutation only — no marker recreation). The maplibregl.Marker instance
   * and its element stay stable across every `active` change, so the reactive
   * subscription is never orphaned.
   *
   * `anchor` is the only prop that still triggers recreation (constructor-only
   * option in MapLibre).
   *
   * @default false
   */
  active?: boolean;
  /**
   * Standard DOM-style click handler.
   *
   * When used inside a HCA Controller/Feature via UiProxy, this prop is injected
   * automatically — Marker just forwards the native click Event.
   *
   * @param event — native click Event
   */
  onClick?: (event: Event) => void;
  /**
   * Standard DOM-style double-click handler.
   *
   * When used inside a HCA Controller/Feature via UiProxy, this prop is injected
   * automatically — Marker just forwards the native dblclick Event.
   *
   * @param event — native dblclick Event
   */
  onDblClick?: (event: Event) => void;
  /**
   * HCA meta pass-through — consumed by web-core's UiProxy for target registration.
   * Marker does not act on this prop; it is present so TS accepts
   * `<Marker meta={{ tags: ['incident'] }} />` without a cast.
   */
  meta?: { tags: string[]; [k: string]: unknown };
  /**
   * HCA payload pass-through — consumed by web-core's UiProxy to build the
   * event target. Marker does not act on this prop directly.
   */
  payload?: Record<string, unknown>;
}

/**
 * Declarative MapLibre marker. Создаёт `maplibregl.Marker` с дефолтным pin-визуалом
 * и добавляет его на карту через `.addTo(map)`. При unmount — `.remove()`.
 *
 * Должен быть дочерним элементом `<MapView>` — использует `useMap()`.
 *
 * ## HCA / UiProxy integration
 *
 * Marker accepts `meta` and `payload` as transparent pass-throughs.
 * web-core's UiProxy reads them to register the target and build the event object;
 * the injected `onClick(event)` is forwarded to the native DOM click listener.
 *
 * ```tsx
 * // Inside a View, within a Controller context:
 * <Ui.MapView.Marker lng={x} lat={y} meta={{ tags: ['incident'] }} payload={{ id }} />
 * ```
 *
 * ## Реактивность
 *
 * - `lng` / `lat` — reactive: при изменении вызывает `marker.setLngLat([lng, lat])`
 *   без пересоздания маркера (быстро, DOM-элемент остаётся тем же).
 * - `anchor` — изменение требует пересоздания (`anchor` только в constructor).
 *   Компонент выполняет `remove()` + `new Marker({ anchor })` + `addTo(map)` автоматически.
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
 *       onClick={(e) => openPanel(e)}
 *     />
 *   ))}
 * </MapView>
 * ```
 */
export const Marker = (props: IMarkerProps) => {
  const { map } = useMap();

  // Mutable refs shared between effects.
  // Effect 1 (lifecycle) writes both; Effects 2 + 3 read markerRef/elementRef.
  let markerRef: MaplibreMarker | undefined;
  let elementRef: HTMLDivElement | undefined;

  // -------------------------------------------------------------------------
  // Effect 1 — lifecycle: create / recreate marker when anchor or map changes.
  //
  // Tracks:  map(), props.anchor
  // Untracks: props.lng, props.lat  — handled by Effect 2 (setLngLat).
  // Untracks: props.active          — handled by Effect 3 (appearance mutation).
  //
  // A stable custom element is created here and NEVER replaced on active
  // toggle. This keeps the maplibregl.Marker instance stable across every
  // active change, so Effect 3's subscription to props.active is never
  // orphaned (fixes the "first-ever-active marker stays a pin" bug).
  // -------------------------------------------------------------------------
  createEffect(() => {
    const m = map();
    if (!m) return;

    // anchor is a constructor-only param → tracked here → recreate on change.
    const anchor = props.anchor;

    // Read initial position and active without tracking — position changes are
    // handled by Effect 2; active appearance is handled by Effect 3.
    const initialLng = untrack(() => props.lng);
    const initialLat = untrack(() => props.lat);
    const initialActive = untrack(() => props.active ?? false);

    // Build the stable custom element with the current active appearance.
    const el = createStableElement(initialActive);
    elementRef = el;

    const marker = new maplibregl.Marker({ anchor, element: el });
    marker.setLngLat([initialLng, initialLat]);
    marker.addTo(m);

    // Store ref so Effects 2 and 3 can operate on the current instance.
    markerRef = marker;

    // Click / double-click — forward native Events to props.onClick /
    // props.onDblClick (HCA-style single-arg). Attached once per marker
    // lifetime (i.e. per anchor change), not per active toggle.
    const handleClick = (event: Event) => {
      props.onClick?.(event);
    };
    const handleDblClick = (event: Event) => {
      props.onDblClick?.(event);
    };
    el.addEventListener('click', handleClick);
    el.addEventListener('dblclick', handleDblClick);

    onCleanup(() => {
      el.removeEventListener('click', handleClick);
      el.removeEventListener('dblclick', handleDblClick);
      marker.remove();
      markerRef = undefined;
      elementRef = undefined;
    });
  });

  // -------------------------------------------------------------------------
  // Effect 2 — reactive position update: setLngLat without recreating marker.
  //
  // Tracks:  map(), props.lng, props.lat
  // Skips:   initial run (initial position is set in Effect 1).
  //
  // Uses createEffect<boolean> "first run" flag pattern (same as Source.tsx).
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

  // -------------------------------------------------------------------------
  // Effect 3 — reactive appearance update: mutate the stable element in-place.
  //
  // Tracks:  props.active
  // Skips:   initial run (initial appearance is set in Effect 1 via
  //          createStableElement).
  //
  // Because elementRef is a stable DOM node (never replaced on active toggle),
  // this effect's subscription to props.active survives every toggle — the
  // "orphaned subscription" bug is impossible here.
  // -------------------------------------------------------------------------
  createEffect<boolean>((initialized) => {
    const active = props.active ?? false;

    if (!initialized) return true;

    if (elementRef) applyActiveAppearance(elementRef, active);
    return initialized;
  }, false);

  return null;
};
