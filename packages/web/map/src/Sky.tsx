import type { SkySpecification } from 'maplibre-gl';
import { createEffect, onCleanup } from 'solid-js';

import { useMap } from './context';

export interface ISkyProps {
  /**
   * Спецификация неба MapLibre. Если не задана — используется разумный дефолт
   * (градиентное небо от синего к белому горизонту).
   *
   * Все поля соответствуют `SkySpecification` из maplibre-gl:
   * - `sky-color` — цвет зенита (верхняя часть неба)
   * - `horizon-color` — цвет горизонта
   * - `sky-horizon-blend` — размытие перехода небо→горизонт (0..1)
   * - `atmosphere-blend` — сила атмосферного эффекта при наклоне камеры (0..1)
   * - и другие поля SkySpecification
   */
  spec?: SkySpecification;
}

/** Дефолтное небо: синий зенит, светло-голубой горизонт, мягкий переход. */
const DEFAULT_SKY: SkySpecification = {
  'sky-color': '#199EF3',
  'horizon-color': '#bcd8f4',
  'sky-horizon-blend': 0.5,
  'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 12, 0],
};

/**
 * Добавляет атмосферный эффект неба через `map.setSky(spec)`.
 * Особенно заметен при `pitch > 45°`. При unmount сбрасывает через `map.setSky({})`.
 *
 * ## Реактивность
 *
 * Реактивен по `spec` — обновления применяются немедленно через `setSky(newSpec)`.
 * Передавай новый объект (новая ссылка) для триггера обновления.
 *
 * ## Style preservation (setStyle / theme switch)
 *
 * `map.setStyle()` сбрасывает sky. Компонент слушает `'styledata'` и автоматически
 * пере-применяет sky после полной загрузки нового стиля.
 *
 * ```tsx
 * <MapView pitch={60}>
 *   <Sky />   {/* дефолтное небо *\/}
 *   {/* или с кастомной палитрой: *\/}
 *   <Sky spec={{ 'sky-color': '#0a1a2e', 'horizon-color': '#1a3a5c', 'sky-horizon-blend': 0.4 }} />
 * </MapView>
 * ```
 */
export const Sky = (props: ISkyProps) => {
  const { map } = useMap();

  createEffect(() => {
    const m = map();
    if (!m) return;

    // Track spec — re-run when spec reference changes
    const spec = props.spec ?? DEFAULT_SKY;

    const applySky = () => {
      m.setSky(spec);
    };

    if (m.isStyleLoaded()) {
      applySky();
    } else {
      m.once('load', applySky);
      onCleanup(() => m.off('load', applySky));
    }

    // Re-apply when style swaps out (setStyle resets sky)
    const onStyleData = () => {
      if (!m.isStyleLoaded()) return;
      m.setSky(spec);
    };
    m.on('styledata', onStyleData);

    onCleanup(() => {
      m.off('styledata', onStyleData);
      try {
        // Сброс неба к состоянию "нет sky" через пустой объект
        m.setSky({});
      } catch {
        // Map may already be disposed
      }
    });
  });

  return null;
};
