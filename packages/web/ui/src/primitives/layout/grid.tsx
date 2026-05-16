import { type ICapsuleRouter, RouterContext } from '@capsuletech/web-router';
import { type JSX, Match, Switch, useContext } from 'solid-js';
import { Animate, type AnimateVariant } from '../wrappers/animate';
import { Dashboard } from './dashboard';
import type { ILayoutProps, LayoutSlotMap } from './interfaces';
import { normalizeSlot } from './utils';
import { layoutSlots } from './variants';

/**
 * Оборачивает контент main-слота в `<Animate>` если `animated` задан.
 *
 *  - Если RouterContext доступен — пробрасываем `keyed={router.current()}`
 *    **прямо в JSX-атрибут**: Solid обернёт это в геттер, и реактивная
 *    зависимость от routeKey локализуется внутри `<Animate>` (Show keyed
 *    перерендерит детей). Сам инстанс `<Animate>` остаётся стабильным —
 *    его функция компонента вызывается один раз.
 *  - Если router не подключён — initial mount-анимация only.
 */
const animateMain = (
  content: JSX.Element,
  animated: boolean | AnimateVariant | undefined,
  router: ICapsuleRouter | null,
): JSX.Element => {
  if (!animated) return content;
  const variant: AnimateVariant = typeof animated === 'string' ? animated : 'fade';
  if (router) {
    return (
      <Animate variant={variant} keyed={router.current()}>
        {content}
      </Animate>
    );
  }
  return <Animate variant={variant}>{content}</Animate>;
};

export const Grid = (props: ILayoutProps) => {
  // Soft-dep на роутер: useContext напрямую (без useRouter, чтобы не бросало
  // если Layout рендерится вне RouterContext, например в Storybook).
  const router = useContext(RouterContext);

  return (
    <Switch fallback={null}>
      {/* centroid */}
      <Match when={props.variant === 'centroid'}>
        {animateMain(
          normalizeSlot((props.slots as LayoutSlotMap['centroid']).main)!.children,
          props.animated,
          router,
        )}
      </Match>

      {/* standard */}
      <Match when={props.variant === 'standard'}>
        {(() => {
          const s = props.slots as LayoutSlotMap['standard'];
          const header = normalizeSlot(s.header)!;
          const main = normalizeSlot(s.main)!;
          const footer = normalizeSlot(s.footer)!;
          return (
            <>
              <header class={layoutSlots.header}>{header.children}</header>
              <main class={layoutSlots.main}>
                {animateMain(main.children, props.animated, router)}
              </main>
              <footer class={layoutSlots.footer}>{footer.children}</footer>
            </>
          );
        })()}
      </Match>

      {/* dashboard */}
      <Match when={props.variant === 'dashboard'}>
        <Dashboard
          slots={props.slots as LayoutSlotMap['dashboard']}
          animated={props.animated}
          router={router}
          animateMain={animateMain}
        />
      </Match>

      {/* TODO: holy-grail */}
    </Switch>
  );
};
