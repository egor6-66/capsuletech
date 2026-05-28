/**
 * Workspace shell (`/workspace`) — общий каркас для всех авторизованных
 * страниц. Раньше тут лежал dashboard-контент; теперь это thin layout:
 *
 *   header — `Widgets.Headers.Main` (с навигацией Dashboard/Cards/Reports
 *            + WorkspaceMenu справа)
 *   main   — `<Ui.Outlet/>` для дочерних роутов:
 *              `/workspace/dashboard` — главный операционный экран
 *              `/workspace/cards`     — sandbox генерации форм
 *              `/workspace/reports`   — отчёты (placeholder)
 *
 * Оба слота `resizable: false` — shell не должен ресайзиться. layoutMode
 * для shell неактуален (нет drag/swap); внутренние страницы (например
 * Dashboard) подключают `useLayoutMode` сами.
 *
 * Заходящий на `/workspace` напрямую видит пустую main-зону — router
 * матчит passthrough index с `() => null`. Для default-страницы нужен
 * либо явный `Navigate to=/workspace/dashboard`, либо клик по nav-кнопке.
 */
const Workspace = Page((Ui) => (
  <Ui.Layout.Matrix
    layoutMode="view"
    preset="app-shell"
    animated="fade"
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
