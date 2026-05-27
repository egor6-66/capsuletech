/**
 * SidebarInfo — текстовое наполнение для боковой панели workspace.
 * Atomic UI с Typography; компонуется внутри Widget Sidebars.Main.
 */
const SidebarInfo = View((Ui) => (
  <Ui.Typography variant="muted">
    Контент бокового бара. Перетаскивай за бейдж — поменяется местами с main.
  </Ui.Typography>
));

export default SidebarInfo;
