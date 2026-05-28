/**
 * Incidents table Widget — рендер через Shape pattern.
 *
 * Читает данные из родительского `<Features.Incidents>` через `useCtx()`.
 * Shape отвечает за columns + sorting; Widget подаёт live data из
 * `store.ctx.data.items` (user-state живёт в `.data`).
 * Loading state: пока items пусто, Shape рендерится с defaults (fallback).
 */
import type { IIncidentsContext } from '../../features/incidents';

const Incidents = Widget(() => {
  const ctx = useCtx();
  const items = () => (ctx.store.ctx.data as IIncidentsContext).items;

  return <Shapes.IncidentsTable data={items()} />;
});

export default Incidents;
