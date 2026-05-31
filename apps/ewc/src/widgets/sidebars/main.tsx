/**
 * Main sidebar Widget — карточка выбранного происшествия + кнопка перехода.
 *
 * Виджет не знает, КАК выбрана карточка: читает готовый `selected` из store
 * (его кладёт `Features.Incidents` onClick-роутер) и отдаёт в stateless
 * `Shapes.IncidentPreview`. Кнопка «Открыть карточку» (прибита к низу, видна
 * только при выборе) несёт тег `open-card` — клик уходит в onClick-роутер фичи,
 * которая делает переход. Виджет навигацию сам не выполняет.
 */

const Main = Widget((Ui, store) => {
  const selected = () => store?.ctx.data?.selected;

  return (
    <Ui.Layout.Flex orientation={'vertical'} class="h-full justify-between pb-2">
      <Shapes.IncidentPreview data={selected()} />
      <Ui.Flow.Show when={selected()}>
        <Ui.Button variant={'ghost'} meta={{ tags: ['open-card'] }}>
          Открыть карточку
        </Ui.Button>
      </Ui.Flow.Show>
    </Ui.Layout.Flex>
  );
});

export default Main;
