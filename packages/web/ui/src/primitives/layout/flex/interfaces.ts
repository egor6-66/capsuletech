import type { JSX, ValidComponent } from 'solid-js';
import type { ISlotProps } from '../../slot';

export type FlexDirection = 'row' | 'row-reverse' | 'col' | 'col-reverse';
export type FlexWrap = 'wrap' | 'nowrap' | 'wrap-reverse';
export type FlexAlign = 'start' | 'center' | 'end' | 'stretch' | 'baseline';
export type FlexJustify = 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly';
export type FlexGap = number | string;

/**
 * Ориентация Flex/Resizable группы. `'horizontal'` = row direction.
 * Используется как в CSS-flex-mode, так и в resizable-mode (передаётся в corvu).
 */
export type FlexOrientation = 'horizontal' | 'vertical';

/**
 * Один item в массиве `items` для resizable-режима Flex.
 *
 * Если `resizable: true` — item становится corvu Panel. Handle ставится между
 * двумя соседними items с `resizable !== false`.
 *
 * Если `resizable: false` или не задан — item рендерится статическим блоком,
 * но участвует в layout (handle к нему не примыкает).
 */
export interface IFlexItem {
  /** Содержимое панели. */
  children: JSX.Element;
  /** По умолчанию `true`. Если `false` — handle к этой панели не ставится. */
  resizable?: boolean;
  /** Начальный размер панели в долях `(0..1)`. */
  initialSize?: number;
  /** Минимальный размер `(0..1)`. */
  minSize?: number;
  /** Максимальный размер `(0..1)`. */
  maxSize?: number;
  /** Может ли панель схлопнуться в 0. corvu-flag. */
  collapsible?: boolean;
}

/**
 * Собственные пропсы `<Flex>` — низкоуровневая Flexbox-обёртка. Числовые
 * варианты (`direction`/`wrap`/`align`/`justify`) маппятся в Tailwind-классы
 * (списки фиксированные → purge видит), а `gap` идёт inline-стилем, потому что
 * значение может быть произвольным числом или CSS-строкой.
 *
 * **Resizable-режим** (opt-in): передай `items` вместо `children`.
 * Если хотя бы один item имеет `resizable: true` — Flex рендерится через corvu.
 * Иначе — обычный CSS `display:flex`.
 */
export interface IFlexOwnProps {
  /**
   * Ориентация: `'horizontal'` (default) = flex-row, `'vertical'` = flex-col.
   * В resizable-mode передаётся в corvu Root как `orientation`.
   * В CSS-mode: `'horizontal'` → `flex-row`, `'vertical'` → `flex-col`.
   */
  orientation?: FlexOrientation;
  /** `flex-direction`. `col` = `column` (короткая Tailwind-форма). */
  direction?: FlexDirection;
  wrap?: FlexWrap;
  /** `align-items`. */
  align?: FlexAlign;
  /** `justify-content`. */
  justify?: FlexJustify;
  /** `gap`. `number` × 0.25rem (как Tailwind), `string` — сырое значение. */
  gap?: FlexGap;
  /** Column gap. Override для `gap` по горизонтали. */
  gapX?: FlexGap;
  /** Row gap. Override для `gap` по вертикали. */
  gapY?: FlexGap;
  /** `display: inline-flex` вместо `flex`. */
  inline?: boolean;
  class?: string;
  style?: JSX.CSSProperties | string;
  /**
   * **Resizable-режим.** Массив item'ов вместо свободных `children`.
   * Если хотя бы один item имеет `resizable: true` — рендерится через corvu
   * (Resizable Root + Panel + Handle). Иначе — обычный CSS flex с div-обёртками.
   *
   * Взаимоисключает с `children` (если оба заданы — `items` имеет приоритет).
   */
  items?: IFlexItem[];
  /**
   * Показывать визуальный grip на handle (только в resizable-mode).
   */
  withHandle?: boolean;
  /**
   * Callback, fired whenever corvu panel sizes change (только в resizable-mode).
   * Forwarded to corvu ResizableRoot as `onSizesChange`.
   */
  onSizesChange?: (sizes: number[]) => void;
}

export type IFlexProps<T extends ValidComponent = 'div'> = ISlotProps<T> & IFlexOwnProps;
