import type { VariantProps } from 'class-variance-authority';
import type { JSX } from 'solid-js';
import type { AnimateVariant } from '../wrappers/animate';
import type { layoutCva } from './variants';

/**
 * Конфигурация слота, который участвует в Resizable-группе.
 *
 * Применяется **только** в вариантах, где Layout раскладывает несколько слотов
 * по одной оси (сейчас: `dashboard` — горизонтально по sidebar/main/rightBar).
 * В вариантах с одним содержательным слотом (`centroid`, `standard`,
 * `holy-grail`) `resizable`-флаг игнорируется, отрисуются только `children`.
 *
 * **ВАЖНО:** когда хотя бы один horizontal-слот dashboard объявлен в этой
 * форме, дефолтные wrapper-классы для соответствующего слота не применяются —
 * шириной/высотой управляет corvu Panel. Содержимое `children` отвечает за
 * собственный padding/background.
 */
export interface IResizableSlotConfig {
  children: JSX.Element;
  /**
   * **Opt-in.** По умолчанию `false` — object-форма без явного флага визуально
   * идентична JSX-форме (легаси-разметка `<aside>/<main>` с дефолтными классами).
   *
   * Чтобы слот реально стал resizable-панелью, нужно поставить `true`.
   * И помни: handle между двумя соседними слотами появляется ⇔ у **обоих**
   * `resizable: true` — иначе боковой `<aside>` остаётся фиксированным.
   */
  resizable?: boolean;
  initialSize?: number;
  minSize?: number;
  maxSize?: number;
}

/**
 * Значение одного слота. Принимается двумя формами:
 *
 *  1. `JSX.Element` — обычный компонент/JSX.
 *  2. `IResizableSlotConfig` — `{ children, resizable?, initialSize?, minSize?, maxSize? }`.
 *
 * Для **2-й формы рекомендуется** оборачивать в `Layout.slot({...})` или
 * named `slot({...})` — это identity-хелпер, который заставляет TS правильно
 * подсказывать поля внутри `{}`. Без него autocomplete внутри пустого `{}`
 * перекрывается типом `Node` из `JSX.Element` (это особенность union-завершения
 * TS, а не баг — обходим хелпером).
 *
 * @example
 * ```tsx
 * slots={{
 *   sidebar: Ui.Layout.slot({ children: <Sidebar />, resizable: true, initialSize: 0.2 }),
 *   main:    Ui.Layout.slot({ children: <Main />,    resizable: true }),
 * }}
 * ```
 */
export type SlotValue = IResizableSlotConfig | JSX.Element;

export interface LayoutSlotMap {
  standard: { header: SlotValue; main: SlotValue; footer: SlotValue };
  dashboard: {
    sidebar: SlotValue;
    main: SlotValue;
    header?: SlotValue;
    rightBar?: SlotValue;
  };
  'holy-grail': {
    header: SlotValue;
    left: SlotValue;
    main: SlotValue;
    right: SlotValue;
    footer: SlotValue;
  };
  centroid: { main: SlotValue };
}

// В Solid используем HTMLAttributes вместо Omit<HTMLDivElement...>
export interface ILayoutBaseProps extends JSX.HTMLAttributes<HTMLDivElement> {}

export type LayoutVariants = VariantProps<typeof layoutCva>;

export type ILayoutProps = {
  [K in keyof LayoutSlotMap]: ILayoutBaseProps &
    LayoutVariants & {
      variant: K;
      slots: LayoutSlotMap[K];
      /**
       * Оборачивает `main`-слот в `<Animate>` (header/footer/sidebar не трогает —
       * они обычно статичны при смене роута).
       *
       *  - `true` → дефолтный variant `'fade'`.
       *  - `'fade' | 'slide-up' | 'scale' | ...` → конкретный variant.
       *  - `false` / `undefined` → без анимации.
       *
       * Для route-transitions (анимация при смене роута) — отдельный паттерн
       * через ключ от `router.current()`, пока не реализован. Сейчас работает
       * только initial mount-анимация.
       */
      animated?: boolean | AnimateVariant;
    };
}[keyof LayoutSlotMap];
