import type {
  LngLatBoundsLike,
  LngLatLike,
  Map as MaplibreMap,
  StyleSpecification,
} from 'maplibre-gl';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { createEffect, createSignal, type JSX, onCleanup, onMount } from 'solid-js';

import { MapContext } from './context';
import { DARK_MATTER, POSITRON } from './styles';

/**
 * Snapshot viewport — передаётся в `onViewportChange`.
 * Собственный тип, не зависящий от solid-map-gl.
 */
export interface IViewport {
  center?: LngLatLike;
  zoom?: number;
  bearing?: number;
  pitch?: number;
}

export interface IMapViewProps {
  /** URL стиля или inline StyleSpecification. По умолчанию — POSITRON (CARTO). */
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
  /** Наклон карты в градусах (3D). */
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
  onViewportChange?: (viewport: IViewport) => void;
  /** Дочерние компоненты (`<Source/>`, `<Layer/>`, `<Marker/>`, …). */
  children?: JSX.Element;
}

const DEFAULT_STYLE = POSITRON;
const DEFAULT_DARK_STYLE = DARK_MATTER;

/** Читает текущее состояние тёмной темы БЕЗ подписки (для init). */
function readDarkMode(): boolean {
  if (typeof document !== 'undefined' && document.body.classList.contains('dark')) return true;
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches)
    return true;
  return false;
}

/**
 * Корневой компонент карты. Монтирует `maplibre-gl.Map` на div,
 * управляет lifecycle (init, cleanup), реактивно синхронизирует props.
 *
 * **Архитектурные решения:**
 *   - Прямая интеграция с `maplibre-gl` без промежуточных обёрток.
 *   - Инициализация за ResizeObserver-gate: `new Map()` не вызывается
 *     пока container имеет нулевой размер (защита от NaN crash в `jumpTo`).
 *   - `center`/`maxBounds` передаются ТОЛЬКО через `setCenter`/`setMaxBounds`
 *     после `'load'`, НИКОГДА в конструктор — иначе `_calcMatrices` NaN при
 *     transient-0-size контейнере.
 *   - Тёмная тема: единый `isDark` signal обновляется из matchMedia + MutationObserver.
 *     Один `createEffect` tracks `isDark()` + `props.style` + `props.darkStyle` → setStyle.
 *     Нет race conditions, нет conflict с конструкторным стилем.
 *   - `MapContext.Provider` — дочерним компонентам доступен instance через `useMap()`.
 */
export const MapView = (props: IMapViewProps) => {
  let containerRef!: HTMLDivElement;
  const [map, setMap] = createSignal<MaplibreMap | undefined>(undefined);

  // --- Единый reactive dark-mode signal ---
  // Инициализируется синхронно с текущим состоянием темы (readDarkMode()),
  // поэтому конструктор и init-style уже получают правильный стиль.
  const [isDark, setIsDark] = createSignal(readDarkMode());

  const lightStyle = () => props.style ?? DEFAULT_STYLE;
  const darkStyle = () => props.darkStyle ?? DEFAULT_DARK_STYLE;
  const resolveStyle = () => (isDark() ? darkStyle() : lightStyle());

  onMount(() => {
    let instance: MaplibreMap | undefined;
    let initialized = false;

    // --- ResizeObserver-gated init ---
    // Защищает от `jumpTo({center})` NaN crash: maplibre 4+ вызывает jumpTo
    // в конструкторе при передаче center. Если container 0×0 — projection
    // matrix ещё не готова → NaN.
    // DO NOT pass center/maxBounds to constructor. Set after 'load' event.

    const init = (w: number, h: number) => {
      if (initialized) return;
      if (w === 0 || h === 0) return;
      initialized = true;
      observer.disconnect();

      const m = new maplibregl.Map({
        container: containerRef,
        // resolveStyle() читает isDark() — уже правильное значение на момент mount,
        // т.к. isDark signal инициализирован синхронно через readDarkMode().
        style: resolveStyle(),
        // maplibre-gl 4: attributionControl accepts `false | AttributionControlOptions`.
        // `true` is not in the type — map boolean prop to `{}` (default options) or `false`.
        attributionControl: props.attributionControl ? {} : false,
        ...(props.minZoom !== undefined ? { minZoom: props.minZoom } : {}),
        ...(props.maxZoom !== undefined ? { maxZoom: props.maxZoom } : {}),
        // center/zoom/pitch/bearing — НЕ в конструктор (NaN guard).
        // Они выставляются после 'load' через setters.
      });

      m.once('load', () => {
        // Set initial camera after load (safe: container has valid dimensions by now)
        if (props.center !== undefined) m.setCenter(props.center);
        if (props.zoom !== undefined) m.setZoom(props.zoom);
        if (props.bearing !== undefined) m.setBearing(props.bearing);
        if (props.pitch !== undefined) m.setPitch(props.pitch);
        if (props.maxBounds !== undefined) m.setMaxBounds(props.maxBounds);

        instance = m;
        setMap(m);
        props.onLoad?.(m);
      });

      // Emit viewport changes on user interaction
      const onMoveEnd = () => {
        if (!props.onViewportChange) return;
        const c = m.getCenter();
        props.onViewportChange({
          center: [c.lng, c.lat],
          zoom: m.getZoom(),
          bearing: m.getBearing(),
          pitch: m.getPitch(),
        });
      };
      m.on('moveend', onMoveEnd);
    };

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          init(width, height);
          break;
        }
      }
    });
    observer.observe(containerRef);

    // Attempt immediate init if container already has size at mount time
    init(containerRef.clientWidth, containerRef.clientHeight);

    // --- Theme switching: обновляем СИГНАЛ, не дёргаем setStyle напрямую ---
    // Один createEffect ниже (вне onMount) наблюдает за isDark() + props.style/darkStyle
    // и вызывает setStyle ровно один раз при изменении любого из них.

    const onColorSchemeChange = () => {
      setIsDark(
        document.body.classList.contains('dark') ||
          window.matchMedia('(prefers-color-scheme: dark)').matches,
      );
    };

    const mq =
      typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null;
    mq?.addEventListener('change', onColorSchemeChange);

    // MutationObserver on body.classList for `.dark` class toggling
    let mutationObserver: MutationObserver | null = null;
    if (typeof document !== 'undefined') {
      mutationObserver = new MutationObserver(() => {
        setIsDark(
          document.body.classList.contains('dark') ||
            (typeof window !== 'undefined' &&
              window.matchMedia('(prefers-color-scheme: dark)').matches),
        );
      });
      mutationObserver.observe(document.body, {
        attributes: true,
        attributeFilter: ['class'],
      });
    }

    onCleanup(() => {
      observer.disconnect();
      mq?.removeEventListener('change', onColorSchemeChange);
      mutationObserver?.disconnect();
      instance?.remove();
      instance = undefined;
      setMap(undefined);
    });
  });

  // --- Reactive prop sync (after map is initialized) ---

  // ЕДИНЫЙ effect для style + тёмной темы.
  // Tracks: isDark(), props.style, props.darkStyle → вычисляет finalStyle → setStyle.
  // Заменяет и конфликтующий отдельный effect на props.style (был lines 217-222),
  // и прямые вызовы setStyle из listeners (были race conditions при async setStyle).
  createEffect(() => {
    const m = map();
    if (!m) return;
    // Все три tracked: isDark(), lightStyle() (→props.style), darkStyle() (→props.darkStyle)
    const finalStyle = resolveStyle();
    m.setStyle(finalStyle);
  });

  // center — jump without animation; for flyTo use useMap() imperatively
  createEffect(() => {
    const c = props.center;
    const m = map();
    if (!m || c === undefined) return;
    m.setCenter(c);
  });

  createEffect(() => {
    const z = props.zoom;
    const m = map();
    if (!m || z === undefined) return;
    m.setZoom(z);
  });

  createEffect(() => {
    const b = props.bearing;
    const m = map();
    if (!m || b === undefined) return;
    m.setBearing(b);
  });

  createEffect(() => {
    const p = props.pitch;
    const m = map();
    if (!m || p === undefined) return;
    m.setPitch(p);
  });

  return (
    <MapContext.Provider value={{ map }}>
      <div
        ref={containerRef}
        class={props.class}
        classList={props.classList}
        style={
          props.style_container ??
          (props.class || props.classList ? undefined : { width: '100%', height: '100%' })
        }
      />
      {props.children}
    </MapContext.Provider>
  );
};
