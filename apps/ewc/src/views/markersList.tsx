/**
 * MarkersList — рендер маркеров на карте из Feature.Incidents store.
 *
 * Читает items через useCtx() (ControllerContext из Feature-обёртки).
 * User-state живёт в `ctx.store.ctx.data` (по контракту IMachineContext).
 * Использует Solid <For> для реактивного list-rendering.
 */

import { For } from 'solid-js';
import type { IIncident, IIncidentsContext } from '../features/incidents';

const MarkersList = View((Ui) => {
  const ctx = useCtx();
  const items = () => (ctx.store.ctx.data as IIncidentsContext).items;

  return (
    <For each={items()}>
      {(incident: IIncident) => (
        <Ui.MapView.Marker
          lng={incident.location.lng}
          lat={incident.location.lat}
          onClick={() => {
            // TODO(Phase 2b): wire to Features.Incidents.selectOne
            console.log('[Marker click]', incident.id, incident.description, incident.location);
          }}
        />
      )}
    </For>
  );
});

export default MarkersList;
