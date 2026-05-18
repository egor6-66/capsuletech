import { type ICapsuleRouter, RouterContext } from '@capsuletech/web-router';
import { type JSX, Match, Switch, useContext } from 'solid-js';
import { Animate, type AnimateVariant } from '../wrappers/animate';
import { Dashboard } from './dashboard';
import { HolyGrail } from './holy-grail';
import type { ILayoutProps, LayoutSlotMap } from './interfaces';
import { Standard } from './standard';
import { normalizeSlot } from './utils';

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

/**
 * LayoutSwitch — внутренний switch по `variant`, рендерит конкретную раскладку
 * (`centroid` / `standard` / `dashboard` / `holy-grail`). **Не путать** с
 * публичным `<Grid>`-primitive в `primitives/grid/` — тот про CSS Grid как
 * standalone-компонент, этот — приватный диспетчер вариантов Layout.
 *
 * Переименован из `Grid`, чтобы освободить имя для публичного primitive.
 */
export const LayoutSwitch = (props: ILayoutProps) => {
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
        <Standard
          slots={props.slots as LayoutSlotMap['standard']}
          animated={props.animated}
          router={router}
          animateMain={animateMain}
        />
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

      {/* holy-grail */}
      <Match when={props.variant === 'holy-grail'}>
        <HolyGrail
          slots={props.slots as LayoutSlotMap['holy-grail']}
          animated={props.animated}
          router={router}
          animateMain={animateMain}
        />
      </Match>
    </Switch>
  );
};
