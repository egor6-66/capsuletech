import { Show } from 'solid-js';
import { Motion, Presence } from 'solid-motionone';
import type { AnimateVariant, IAnimateProps } from './interfaces';

const VARIANTS: Record<AnimateVariant, { initial: any; animate: any; exit: any }> = {
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  },
  'slide-up': {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -10 },
  },
  'slide-down': {
    initial: { opacity: 0, y: -10 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 10 },
  },
  'slide-left': {
    initial: { opacity: 0, x: 10 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -10 },
  },
  'slide-right': {
    initial: { opacity: 0, x: -10 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 10 },
  },
  scale: {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.95 },
  },
  collapse: {
    initial: { opacity: 0, maxHeight: 0 },
    animate: { opacity: 1, maxHeight: 1000 },
    exit: { opacity: 0, maxHeight: 0 },
  },
  none: {
    initial: {},
    animate: {},
    exit: {},
  },
};

/**
 * Контейнер для анимаций enter/exit. Под капотом — `<Motion>` напрямую,
 * без Slot/Polymorphic (см. ниже почему).
 *
 * @example
 * // entry-only на mount
 * <Animate variant="fade"><Card /></Animate>
 *
 * @example
 * // enter+exit на toggle
 * <Animate variant="slide-up" when={isOpen()}><Modal /></Animate>
 *
 * @example
 * // route-transition: при смене значения играет exit + enter
 * <Animate variant="slide-up" keyed={router.current()}><Outlet /></Animate>
 *
 * @example
 * // кастомный тег
 * <Animate as="section" variant="fade"><Content /></Animate>
 */
export const Animate = (props: IAnimateProps) => {
  const variant = () => VARIANTS[props.variant ?? 'fade'];
  const transition = () => ({
    duration: props.duration ?? 2.2,
    easing: props.easing ?? 'ease-out',
    delay: props.delay ?? 0,
  });

  // Какой режим работы:
  //  - keyed → Presence + Show-keyed (route-transitions).
  //  - when → Presence + Show-conditional (toggle on/off).
  //  - ни того ни другого → просто Motion (initial-only mount-анимация).
  const keyed = 'keyed' in props;
  const conditional = 'when' in props;

  // ВАЖНО: `<Motion>` РЕНДЕРИТСЯ НАПРЯМУЮ — без Slot/Polymorphic-обёртки.
  // `<Presence>` использует `resolveFirst(() => props.children)` для отслеживания
  // первого DOM-элемента и созданием createSwitchTransition для exit-анимаций.
  // Любая промежуточная reactive-обёртка (Slot/Polymorphic/Solid Component wrapper)
  // ломает эту цепочку — resolveFirst не успевает отследить swap элементов при
  // смене keyed-значения, и exit-анимация не отыгрывается.
  //
  // По той же причине НЕ оборачиваем Motion в `<Inner />` компонент — рендерим
  // JSX inline в Show callback.
  const motionAttrs = () => ({
    tag: (props.as ?? 'div') as any,
    initial: props.initial ?? variant().initial,
    animate: props.animate ?? variant().animate,
    exit: props.exit ?? variant().exit,
    transition: transition(),
    class: props.class,
    style: props.style as any,
  });
  console.log('wdad');
  if (keyed) {
    return (
      <Presence exitBeforeEnter={props.exitBeforeEnter ?? true}>
        <Show when={props.keyed} keyed>
          {
            // @ts-expect-error
            () => <Motion {...motionAttrs()}>{props.children}</Motion>
          }
        </Show>
      </Presence>
    );
  }

  if (conditional) {
    return (
      <Presence exitBeforeEnter={props.exitBeforeEnter ?? true}>
        <Show when={props.when}>
          <Motion {...motionAttrs()}>{props.children}</Motion>
        </Show>
      </Presence>
    );
  }

  return <Motion {...motionAttrs()}>{props.children}</Motion>;
};
