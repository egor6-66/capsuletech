/**
 * Incidents table Widget — рендер через Shape pattern.
 *
 * Данные приходят из родительского `<Features.Incidents>` store (2-й арг
 * Widget-фабрики). Shape отвечает за columns + sorting; Widget подаёт live
 * data из `store.ctx.data.items`.
 *
 * События: per-row `itemMeta`/`itemPayload` навешивают tags+payload на строки.
 * Клик по строке → web-core биндит событие, универсальный `Feature.onClick`
 * роутит по `target.meta.tags` (incident → select). Никаких прямых колбэков.
 *
 * Подсветка активной строки: `isRowActive` сравнивает row.id с выбранным
 * incident'ом из store. Реактивность highlight'а — ответственность DataTable.
 */
import type { IIncident, IIncidentsContext } from '../../features/incidents';

const Incidents = Widget((Ui, store) => (
  <Shapes.IncidentsTable
    data={(store?.ctx.data as IIncidentsContext | undefined)?.items ?? []}
    itemMeta={() => ({ tags: ['incident'] })}
    itemPayload={(row: IIncident) => ({ id: row.id })}
    isRowActive={(row: IIncident) =>
      row.id === (store?.ctx.data as IIncidentsContext | undefined)?.selected?.id
    }
  />
));

export default Incidents;
