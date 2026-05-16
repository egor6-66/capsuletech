import type { VariantProps } from 'class-variance-authority';
import type { JSX } from 'solid-js';
import type { AnimateVariant } from '../wrappers/animate';
import type { layoutCva } from './variants';

export interface LayoutSlotMap {
  standard: { header: JSX.Element; main: JSX.Element; footer: JSX.Element };
  dashboard: {
    sidebar: JSX.Element;
    main: JSX.Element;
    header?: JSX.Element;
    rightBar?: JSX.Element;
  };
  'holy-grail': {
    header: JSX.Element;
    left: JSX.Element;
    main: JSX.Element;
    right: JSX.Element;
    footer: JSX.Element;
  };
  centroid: { main: JSX.Element };
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
