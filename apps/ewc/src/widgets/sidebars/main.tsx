import type { IIncidentsContext } from '../../features/incidents';

const Main = Widget((Ui) => {
  const ctx = useCtx();
  const sctx = () => ctx.store.ctx.data as IIncidentsContext;

  return (
    <Ui.Card class="h-full rounded-none border-l border-t-0 border-b-0 border-r-0">
      <Ui.Card.Header>
        <Ui.Card.Title>Карточка происшествия</Ui.Card.Title>
      </Ui.Card.Header>
      <Ui.Card.Content class="overflow-y-auto">
        <Views.SidebarInfo selectedId={sctx().selectedId} items={sctx().items} />
      </Ui.Card.Content>
    </Ui.Card>
  );
});

export default Main;
