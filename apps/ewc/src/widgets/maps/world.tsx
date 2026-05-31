/**
 * World map Widget — карта для footer'а workspace.
 *
 * Центр — Санкт-Петербург, slight pitch для горизонта (Sky atmosphere visible).
 * Из 3D-набора активен только Sky (offline-safe). BuildingsPreset/TerrainPreset
 * требуют user-supplied source/DEM (см. JSDoc этих компонентов).
 *
 * Маркеры: items читаются из Feature.Incidents store (2-й арг фабрики) и
 * подаются в stateless Views.MarkersList через props. Реактивный list-rendering
 * через Solid <For> живёт внутри Views.MarkersList.
 */
import type { IIncidentsContext } from '../../features/incidents';

const World = Widget((Ui, store) => (
  <Ui.MapView
    center={[30.3158, 59.9311]}
    zoom={13}
    // pitch={45}
    // bearing={-20}
    // class="h-full w-full"
  >
    {/*<Ui.MapView.Sky />*/}
    <Views.MarkersList
      items={(store?.ctx.data as IIncidentsContext | undefined)?.items ?? []}
      activeId={(store?.ctx.data as IIncidentsContext | undefined)?.selected?.id}
    />
  </Ui.MapView>
));

export default World;
