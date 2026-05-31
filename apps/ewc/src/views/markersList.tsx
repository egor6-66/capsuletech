/**
 * MarkersList — рендер маркеров на карте из переданного списка инцидентов.
 *
 * Stateless: список приходит через `props.items` (родительский Widget читает
 * его из Feature.Incidents store и подаёт сюда). View не знает про useCtx/store.
 *
 * Клик по маркеру несёт `meta.tags=['incident']` + `payload.id`; web-core
 * UiProxy навешивает событие, универсальный `Feature.onClick` роутит по тегам.
 */

import { For } from 'solid-js';
import type { IIncident } from '../features/incidents';

const MarkersList = View((Ui, props: { items?: IIncident[]; activeId?: string }) => (
  <For each={props.items ?? []}>
    {(incident: IIncident) => (
      <Ui.MapView.Marker
        lng={incident.location.lng}
        lat={incident.location.lat}
        active={incident.id === props.activeId}
        meta={{ tags: ['incident'] }}
        payload={{ id: incident.id }}
      />
    )}
  </For>
));

export default MarkersList;
