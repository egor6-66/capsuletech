/**
 * World map Widget — карта для footer'а workspace.
 *
 * Центр — Санкт-Петербург, slight pitch для горизонта (Sky atmosphere visible).
 * Из 3D-набора активен только Sky (offline-safe). BuildingsPreset/TerrainPreset
 * требуют user-supplied source/DEM (см. JSDoc этих компонентов).
 *
 * Маркеры — читаются из Feature.Incidents store (store.ctx.items). Реактивный
 * list-rendering через Solid <For> (внутри Views.MarkersList).
 */

const World = Widget((Ui) => (
  <Ui.MapView
    center={[30.3158, 59.9311]}
    zoom={13}
    pitch={45}
    bearing={-20}
    class="h-full w-full"
  >
    <Ui.MapView.Sky />
    <Views.MarkersList />
  </Ui.MapView>
));

export default World;
