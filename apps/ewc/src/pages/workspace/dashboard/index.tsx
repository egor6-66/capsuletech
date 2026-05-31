/**
 * Dashboard (`/workspace/dashboard`) — основной операционный экран EWC.
 *
 * **Shared state hub:** все слоты Matrix обёрнуты в `<Features.Incidents>` —
 * Tables / Maps / Sidebar читают **один и тот же** store (items / selected).
 * Выбор карточки — стандартный клик → универсальный `onClick`-роутер фичи
 * (tag `incident` + payload), а не именованные методы. Single source of truth.
 *
 * Matrix preset='app-shell' БЕЗ header-слота (header идёт от родительского
 * workspace layout). Внутренний matrix:
 *   main     — incidents table (draggable, swapGroup 'widgets')
 *   rightBar — sidebar с card выбранного incident'а (draggable, swapGroup 'widgets')
 *   footer   — карта с markers (draggable, swapGroup 'widgets')
 *
 * `layoutMode` НЕ передаём — Matrix сам подцепит глобальный store от
 * `@capsuletech/web-style`.
 */
const Dashboard = Page((Ui) => (
  <Features.Incidents>
    <Ui.Layout.Matrix
      preset="app-shell"
      slots={{
        main: {
          children: <Widgets.Tables.Incidents />,
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
  </Features.Incidents>
));

export default Dashboard;
