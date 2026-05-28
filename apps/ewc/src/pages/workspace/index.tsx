import { useRouterState } from '@tanstack/solid-router';
import { createSignal, For, type JSX, onMount } from 'solid-js';

/**
 * Workspace shell (`/workspace`) — общий каркас для всех авторизованных
 * страниц.
 *
 *   header — `Widgets.Headers.Main`
 *   main   — `<For each={[pathname()]}>` re-mount'ит локальный `<FadeIn>`
 *            на каждую смену URL → opacity 0→1 проигрывается чисто.
 *
 * **История подхода (для следующего dev'a):**
 * 1. `Ui.Animate keyed={pathname()}` (Presence + Show keyed от solid-motionone)
 *    не сработал — Motion не пере-mount'ился на смену keyed-значения
 *    (тот же DOM-нод оставался, exit/enter не отыгрывался). Причина не
 *    понята до конца, может в лень-импорте через `lazy()`, может в
 *    `resolveFirst` от solid-motionone при текущем JSX-обёрткой стеке.
 * 2. Прямой импорт `Animate` from `@capsuletech/web-ui` не помог.
 * 3. `useLocation()` без `select` — оказался не реактивным в контексте
 *    Animate.keyed (хотя useRouterState с select под Solid.createMemo —
 *    реактивен, можно подтвердить через createEffect).
 * 4. Просто signal opacity 0→rAF→1 не дал визуального fade — Tailwind
 *    transition прерывался setOpacity(1) до того как 0 закоммитился,
 *    итоговая видимая часть всего ~30ms.
 * 5. Текущее решение: `<For each={[pathname()]}>` использует Solid'овский
 *    by-value diffing на массиве из одной строки. Новый pathname → For
 *    видит новый item-id → unmount/mount цикл → FadeIn пересоздаётся
 *    из opacity:0, onMount запускает rAF→rAF→setOpacity(1), и CSS
 *    transition отрабатывает полные 300ms.
 *
 * `class="h-full w-full"` на FadeIn обязательно — иначе виртуализованная
 * таблица calls'ов теряет height-context и рендерит 0 рядов.
 *
 * `layoutMode="view"` локирует shell — global edit-toggle не подсветит
 * header/main edit-affordances. Внутренние страницы (Dashboard) подключают
 * `useLayoutMode` сами через Matrix internal default.
 */

const FadeIn = (props: { children: JSX.Element }) => {
  const [opacity, setOpacity] = createSignal(0);
  onMount(() => {
    // Double rAF: первый коммитит opacity:0 в DOM, второй меняет на 1 —
    // браузер видит две разные кадровые точки и проигрывает CSS-transition.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setOpacity(1));
    });
  });
  return (
    <div
      class="h-full w-full transition-opacity duration-300 ease-out"
      style={{ opacity: opacity() }}
    >
      {props.children}
    </div>
  );
};

const Workspace = Page((Ui) => {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <Ui.Layout.Matrix
      layoutMode="view"
      preset="app-shell"
      slots={{
        header: {
          children: <Widgets.Headers.Main />,
          resizable: false,
          initialSize: 0.04,
        },
        main: {
          children: (
            <For each={[pathname()]}>
              {() => (
                <FadeIn>
                  <Ui.Outlet />
                </FadeIn>
              )}
            </For>
          ),
          resizable: false,
        },
      }}
    />
  );
});

export default Workspace;
