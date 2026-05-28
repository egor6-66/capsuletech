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
 * **Три режима:**
 *
 * 1. **CSS-flex mode** (default) — передай `children` как обычно. Никаких `items`.
 *
 * 2. **Static items mode** — передай `items`, все без `resizable: true`.
 *    Каждый item рендерится в `<div>` обёртку. Corvu не подключается.
 *
 * 3. **Resizable mode** — передай `items`, хотя бы один с `resizable: true`.
 *    Рендерится через corvu (ResizableRoot + Panel + Handle).
 *    Corvu-mode включается **только** по явному `resizable: true`; факт наличия
 *    массива `items` сам по себе corvu не активирует.
 *
 * **Edge case:** если `items` передан, но ни один объект не содержит поля
 * `children` или `resizable` — считается случайным prop-collision с доменными
 * данными. Flex выдаёт `console.warn` (dev) и падает обратно в children-mode.
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
   * **Items-режим.** Массив `IFlexItem` вместо свободных `children`.
   *
   * - Без `resizable: true` на любом item → статический CSS flex (div-обёртки).
   * - С хотя бы одним `resizable: true` → corvu ResizableRoot + Panel + Handle.
   *
   * Corvu-режим активируется **только** по явному флагу `resizable: true`, а не
   * по факту наличия массива.
   *
   * Если массив передан, но ни один объект не имеет `children` или `resizable`,
   * Flex выдаёт предупреждение (dev) и рендерит `children` prop как fallback.
   *
   * Взаимоисключает с `children` (если оба заданы и `items` валиден — `items` имеет приоритет).
   */
  items?: IFlexItem[];
  /**
   * Показывать визуальный grip на handle (только в resizable-mode).
   */
  withHandle?: boolean;
  /**
   * Отключить интерактивность всех resize-handles (только в resizable-mode).
   * Layout остаётся живым (panels рендерятся, размеры применены), но pointer-drag
   * по разделителю не сработает — handle получает `disabled` от corvu +
   * `pointer-events: none` дополнительно, чтобы блокировать hover-cursor.
   *
   * Use case: Matrix `layoutMode='view'` — статичный layout без resize-affordance.
   */
  handleDisabled?: boolean;
  /**
   * Callback, fired whenever corvu panel sizes change (только в resizable-mode).
   * Forwarded to corvu ResizableRoot as `onSizesChange`.
   */
  onSizesChange?: (sizes: number[]) => void;
}

export type IFlexProps<T extends ValidComponent = 'div'> = ISlotProps<T> & IFlexOwnProps;
