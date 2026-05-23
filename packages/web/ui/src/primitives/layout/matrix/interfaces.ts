import type { JSX } from 'solid-js';
import type { AnimateVariant } from '../../wrappers/animate';

/**
 * SlotValue — либо JSX-элемент напрямую, либо объект с children + overrides.
 *
 * JSX-форма: `header: <MyHeader />` — обёртывается в normalizeSlotValue.
 * Object-форма: `header: { children: <MyHeader />, initialSize: 0.2, ... }`
 *
 * Heuristic: если у объекта есть ключ `children` — считается object-формой.
 */
export type SlotValue =
  | JSX.Element
  | {
      children: JSX.Element;
      initialSize?: number;
      minSize?: number;
      maxSize?: number;
      draggable?: boolean;
    };

export interface IRow {
  id?: string;
  /**
   * Высота row.
   * - `number` (0..1) → corvu Panel initialSize (доля от родителя)
   * - `'auto'` → content-height, не resizable
   * - `'fr'` → flex-1 (grow)
   */
  height?: number | 'auto' | 'fr';
  resizable?: boolean;
  cells: ICell[];
}

export interface ICell {
  id: string;
  children: JSX.Element;
  tag?: 'div' | 'header' | 'aside' | 'main' | 'footer' | 'nav' | 'section';
  /**
   * Ширина cell.
   * - `number` (0..1) → corvu Panel initialSize
   * - `'auto'` → content-width
   * - `'fr'` → flex-1
   */
  width?: number | 'auto' | 'fr';
  resizable?: boolean;
  /**
   * @placeholder Phase 1.2 — DnD support. Типы добавлены, runtime не реализован.
   */
  draggable?: boolean;
  /**
   * @placeholder Phase 1.2 — ограничение swap-зоны. Типы добавлены, runtime не реализован.
   */
  swapGroup?: string;
}

// ---------------------------------------------------------------------------
// Preset registry — расширяется через ./presets
// ---------------------------------------------------------------------------

/**
 * Реестр встроенных пресетов. Ключ — имя пресета, значение — тип `slots`.
 * Расширяется по мере добавления новых built-in пресетов.
 */
export interface LayoutPresets {
  'app-shell': {
    header?: SlotValue;
    sidebar?: SlotValue;
    main: SlotValue;
    rightBar?: SlotValue;
    footer?: SlotValue;
  };
  // Будущие: 'split-2', 'split-3', 'dashboard-grid', ...
}

// ---------------------------------------------------------------------------
// DnD / layout mode (Phase 1.2 placeholders)
// ---------------------------------------------------------------------------

/**
 * @placeholder Phase 1.2 — DnD режимы.
 * Типы добавлены, runtime-логика не реализована.
 */
export type MatrixDndMode = 'swap' | 'insert';

/**
 * @placeholder Phase 1.2 — edit/view mode.
 * Типы добавлены, runtime-логика не реализована.
 */
export type MatrixLayoutMode = 'view' | 'edit';

/**
 * @placeholder Phase 1.2 — event-based layout change.
 * Типы добавлены, runtime-логика не реализована.
 */
export type LayoutChangeEvent =
  | { kind: 'swap'; a: string; b: string }
  | { kind: 'insert'; id: string; toRow: number; toIndex: number };

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface IMatrixCommonProps extends JSX.HTMLAttributes<HTMLDivElement> {
  /**
   * Оборачивает cell с id 'main' в `<Animate>` если задан.
   *
   * - `true` → дефолтный variant `'fade'`.
   * - `'fade' | 'slide-up' | 'scale' | ...` → конкретный variant.
   * - `false` / `undefined` → без анимации.
   */
  animated?: boolean | AnimateVariant;
  /**
   * @placeholder Phase 1.2 — DnD режим (noop в Phase 1.1).
   */
  dndMode?: MatrixDndMode;
  /**
   * @placeholder Phase 1.2 — edit/view режим (noop в Phase 1.1).
   */
  layoutMode?: MatrixLayoutMode;
  /**
   * @placeholder Phase 1.2 — callback при смене layout через DnD (noop в Phase 1.1).
   */
  onLayoutChange?: (event: LayoutChangeEvent) => void;
}

/**
 * Raw rows mode — передаёт rows напрямую, без пресета.
 */
export interface IMatrixRawProps extends IMatrixCommonProps {
  rows: IRow[];
  preset?: never;
  slots?: never;
}

/**
 * Preset mode — именованный пресет + типизированные slots.
 */
export interface IMatrixPresetProps<P extends keyof LayoutPresets = keyof LayoutPresets>
  extends IMatrixCommonProps {
  preset: P;
  slots: LayoutPresets[P];
  rows?: never;
}

/**
 * Discriminated union: либо raw rows, либо preset+slots.
 */
export type IMatrixProps = IMatrixRawProps | IMatrixPresetProps;
