import type { JSX } from 'solid-js';

/**
 * Пресеты анимаций. Каждый описывает 3 кадра (initial/animate/exit).
 */
export type AnimateVariant =
  | 'fade'
  | 'slide-up'
  | 'slide-down'
  | 'slide-left'
  | 'slide-right'
  | 'scale'
  | 'collapse'
  | 'none';

export interface IAnimateProps {
  /**
   * HTML-тег рендерящегося элемента. По умолчанию `'div'`.
   * Animate сам становится этим элементом — без дополнительной обёртки.
   */
  as?: keyof JSX.IntrinsicElements;
  /**
   * Условный mount/unmount. Если передан — Animate оборачивается в `<Presence>`
   * и `<Show>`, что даёт enter+exit-анимации на toggle. Если НЕ передан —
   * только entry-animation на mount компонента.
   */
  when?: boolean;
  /**
   * Re-mount + replay анимации при смене значения. Под капотом — `<Presence>`
   * + `<Show keyed>`. Канонический use case — route-transitions:
   * `<Animate keyed={router.current()}>`. При смене URL play'ятся exit
   * предыдущего контента и enter нового.
   *
   * Если задано вместе с `when` — `keyed` имеет приоритет.
   */
  keyed?: unknown;
  /** Пресет анимации. По умолчанию `fade`. */
  variant?: AnimateVariant;
  /** Длительность в секундах. По умолчанию `0.2`. */
  duration?: number;
  /** Easing. По умолчанию `'ease-out'`. */
  easing?: string | number[];
  /** Задержка перед стартом, в секундах. */
  delay?: number;
  /** Сначала прокручивает exit предыдущего, потом enter нового. По умолчанию `true`. */
  exitBeforeEnter?: boolean;
  /** Raw motion props (escape hatch — override пресета). */
  initial?: Record<string, unknown>;
  animate?: Record<string, unknown>;
  exit?: Record<string, unknown>;
  class?: string;
  style?: JSX.CSSProperties | string;
  children?: JSX.Element;
}
