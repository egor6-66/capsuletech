/**
 * World map Widget — карта для footer'а workspace.
 *
 * Центр — Санкт-Петербург, slight pitch для горизонта (Sky atmosphere visible).
 * Используется только Sky из 3D-набора — он работает с любым style, не требует
 * специальных source-ов. BuildingsPreset/TerrainPreset нужны OpenMapTiles-based
 * style и raster-dem источник соответственно — это user-supplied (см. JSDoc
 * BuildingsPreset/TerrainPreset).
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
  </Ui.MapView>
));

export default World;
