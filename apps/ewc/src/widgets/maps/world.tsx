/**
 * World map Widget — карта для footer'а workspace.
 *
 * Центр — Санкт-Петербург, slight pitch для горизонта (Sky atmosphere visible).
 * Из 3D-набора активен только Sky (offline-safe). BuildingsPreset/TerrainPreset
 * требуют user-supplied source/DEM (см. JSDoc этих компонентов).
 *
 * Маркеры — 200 моков из CALLS_MOCK (точки в bounding-box СПб). Click на
 * маркере возвращает full объект ICallMock + MouseEvent. Это временный
 * вариант синхронизации с Tables.Calls — в следующей итерации общие данные
 * вынесем в global store (Feature/Entity) и подключим обе плоскости (карту
 * и таблицу) к одному источнику.
 */
import { CALLS_MOCK } from '../../mocks/calls';

const World = Widget((Ui) => (
  <Ui.MapView
    center={[30.3158, 59.9311]}
    zoom={13}
    pitch={45}
    bearing={-20}
    class="h-full w-full"
  >
    <Ui.MapView.Sky />
    {CALLS_MOCK.map((call) => (
      <Ui.MapView.Marker
        lng={call.location.lng}
        lat={call.location.lat}
        data={call}
        onClick={(call) => {
          // TODO(next-iteration): прокинуть в global store / Feature для
          // подсветки строки в Tables.Calls и открытия Sidebar panel.
          console.log('[Marker click]', call.id, call.description, call.location);
        }}
      />
    ))}
  </Ui.MapView>
));

export default World;
