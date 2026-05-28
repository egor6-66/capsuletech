/**
 * Workspace shell (`/workspace`) — общий каркас для всех авторизованных
 * страниц.
 *
 *   header — `Widgets.Headers.Main`
 *   main   — `<Ui.Outlet/>` для дочерних роутов
 *              `/workspace/dashboard` — главный операционный экран
 *              `/workspace/cards`     — sandbox генерации форм
 *              `/workspace/reports`   — отчёты (placeholder)
 *
 * Оба слота `resizable: false` — shell не должен ресайзиться.
 *
 * `layoutMode="view"` локирует shell — global edit-toggle не подсветит
 * header/main edit-affordances. Внутренние страницы (Dashboard) подключают
 * `useLayoutMode` сами через Matrix internal default.
 *
 * **Page-transition анимация — TODO:** будем делать через проектный
 * `Ui.Animate` (solid-motionone). Предыдущая попытка (`<For each={[pathname]}>`
 * + локальный FadeIn на opacity-signal'е) откачена — не подходит, нужно
 * через свою либу. Подходить надо аккуратно: тест показал что
 * `<Animate keyed={pathname}>` не пере-mount'ит Motion на смену keyed
 * (тот же DOM-нод остаётся, opacity не дрожит). Корень не до конца
 * выяснен — возможно lazy-wrapping `Ui.Animate` через `createLazy()`
 * + Presence `resolveFirst` в solid-motionone не находит swap. Когда
 * вернёмся к задаче — копать оттуда.
 */
const Workspace = Page((Ui) => (
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
        children: <Ui.Outlet />,
        resizable: false,
      },
    }}
  />
));

export default Workspace;
