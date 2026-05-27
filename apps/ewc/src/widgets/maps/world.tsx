/**
 * World map Widget — карта для footer'а workspace.
 * MapView из @capsuletech/web-map (через Ui-namespace). Дефолтный стиль
 * MapLibre demotiles. Центрирована на Европе, zoom 3.
 */
const World = Widget((Ui) => (
  <Ui.MapView center={[10, 50]} zoom={3} class="h-full w-full" />
));

export default World;
