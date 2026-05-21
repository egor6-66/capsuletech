import type { VariantProps } from 'class-variance-authority';
import type { JSX } from 'solid-js';
import type { AnimateVariant } from '../../wrappers/animate';
import type { matrixCva } from './variants';

/**
 * Конфигурация одного слота Matrix.
 *
 * Применяется в горизонтальных (sidebar/main/rightBar) и вертикальных
 * (header/footer) resize-группах. Если `resizable: true` — слот становится
 * corvu Panel'ью. Иначе рендерится статическим блоком.
 *
 * @example
 * ```tsx
 * slots={{
 *   sidebar: { children: <Sidebar />, resizable: true, initialSize: 0.2 },
 *   main:    { children: <Main /> },
 * }}
 * ```
 */
export interface IResizableSlotConfig {
  children: JSX.Element;
  /**
   * **Opt-in.** По умолчанию `false` — слот рендерится статическим блоком.
   *
   * Чтобы слот стал resizable-панелью (corvu), нужно поставить `true`.
   */
  resizable?: boolean;
  initialSize?: number;
  minSize?: number;
  maxSize?: number;
}

/**
 * Значение одного слота — только object form `{ children, resizable?, initialSize?, minSize?, maxSize? }`.
 *
 * **BREAKING (v0.3.0):** JSX-shorthand `header: <Header />` больше НЕ работает —
 * единый object-формат даёт IDE-autocomplete на поля без factory-обёртки.
 * Для слота без resize: `header: { children: <Header /> }`.
 */
export type SlotValue = IResizableSlotConfig;

/**
 * Набор слотов для Matrix.
 *
 * - `main` — ОБЯЗАТЕЛЬНЫЙ. Центральная область контента.
 * - `header`, `sidebar`, `rightBar`, `footer` — опциональные.
 *
 * Если задан только `main` — Matrix переключается в auto-centroid режим
 * (flex items-center justify-center). Иначе — grid layout с CSS-areas.
 */
export interface IMatrixSlots {
  main: SlotValue;
  header?: SlotValue;
  sidebar?: SlotValue;
  rightBar?: SlotValue;
  footer?: SlotValue;
}

// В Solid используем HTMLAttributes вместо Omit<HTMLDivElement...>
export interface IMatrixBaseProps extends JSX.HTMLAttributes<HTMLDivElement> {}

export type MatrixVariants = VariantProps<typeof matrixCva>;

export interface IMatrixProps extends IMatrixBaseProps {
  slots: IMatrixSlots;
  /**
   * Оборачивает `main`-слот в `<Animate>` если `animated` задан.
   *
   *  - `true` → дефолтный variant `'fade'`.
   *  - `'fade' | 'slide-up' | 'scale' | ...` → конкретный variant.
   *  - `false` / `undefined` → без анимации.
   */
  animated?: boolean | AnimateVariant;
}
