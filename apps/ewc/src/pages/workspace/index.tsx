import { useLayoutMode } from '@capsuletech/web-style';

/**
 * Workspace layout — рабочая область после логина (URL `/workspace`).
 *
 * Matrix app-shell preset:
 *   header   — fixed (resizable: false)
 *   main     — resize + DnD swap (swapGroup 'widgets') — табличка
 *   rightBar — resize + DnD swap (swapGroup 'widgets') — sidebar контент
 *   footer   — resize + DnD swap (swapGroup 'widgets') — карта
 *
 * `layoutMode` подключён к глобальному store из @capsuletech/web-style:
 *   - View — статичный layout, ресайз/DnD выключены.
 *   - Edit — handles + drag badges + dashed outlines.
 * Переключается через `<Ui.LayoutModeToggle />` в header-menu.
 *
 * `<Ui.Outlet/>` пока не задействован: вложенных страниц нет. Будут — переедет
 * в main или развернётся в отдельный routing.
 */
const Workspace = Page((Ui) => {
  const layoutMode = useLayoutMode();
  return (
    <Ui.Layout.Matrix
      layoutMode={layoutMode()}
      preset="app-shell"
      slots={{
        header: {
          children: <Widgets.Headers.Main />,
          resizable: false,
          initialSize: 0.04,
        },
        main: {
          children: <Widgets.Tables.Calls />,
          draggable: true,
          swapGroup: 'widgets',
        },
        rightBar: {
          children: <Widgets.Sidebars.Main />,
          draggable: true,
          swapGroup: 'widgets',
          initialSize: 0.25,
        },
        footer: {
          children: <Widgets.Maps.World />,
          draggable: true,
          swapGroup: 'widgets',
          initialSize: 0.35,
        },
      }}
    />
  );
});

export default Workspace;
