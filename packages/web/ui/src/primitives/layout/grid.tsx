import { type ICapsuleRouter, RouterContext } from '@capsule/web-router';
import { cn } from '@capsule/web-style';
import { type JSX, Match, Show, Switch, useContext } from 'solid-js';
import { Animate, type AnimateVariant } from '../wrappers/animate';
import type { ILayoutProps, LayoutSlotMap } from './interfaces';
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
 *
 * ВАЖНО: routeKey НЕ читается на уровне этой функции (раньше принимали
 * `routeKey: string` аргументом — это создавало реактивный скоуп в
 * `{animateMain(..., routeKey())}` и при каждом изменении URL пересоздавался
 * новый компонент Animate).
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
      {/* Для centroid */}
      <Match when={props.variant === 'centroid'}>
        {animateMain((props as any).slots.main, props.animated, router)}
      </Match>

      {/* Для standard */}
      <Match when={props.variant === 'standard'}>
        {(() => {
          const s = props.slots as LayoutSlotMap['standard'];
          return (
            <>
              <header class={layoutSlots.header}>{s.header}</header>
              <main class={layoutSlots.main}>{animateMain(s.main, props.animated, router)}</main>
              <footer class={layoutSlots.footer}>{s.footer}</footer>
            </>
          );
        })()}
      </Match>

      {/* Для dashboard */}
      <Match when={props.variant === 'dashboard'}>
        {
          (() => {
            const s = props.slots as LayoutSlotMap['dashboard'];
            return (
              <>
                <aside class={layoutSlots.sidebar}>{s.sidebar}</aside>
                <div class={layoutSlots.contentWrapper}>
                  <Show when={s.header}>
                    <header class={layoutSlots.header}>{s.header}</header>
                  </Show>
                  <div class="flex flex-1 overflow-y-auto">
                    <main class={layoutSlots.main}>
                      {animateMain(s.main, props.animated, router)}
                    </main>
                    <Show when={s.rightBar}>
                      <aside class={layoutSlots.asideRight}>{s.rightBar}</aside>
                    </Show>
                  </div>
                </div>
              </>
            );
            // biome-ignore lint/suspicious/noExplicitAny: <explanation>
          })() as any
        }
      </Match>

      {/* ... и так далее для holy-grail */}
    </Switch>
  );
};
