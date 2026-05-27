/**
 * Reports stub (`/reports`) — placeholder для будущей отчётной зоны.
 *
 * Сейчас нужен только для того, чтобы `Shapes.Navigation` имел рабочую цель
 * для пункта "Reports" (Link не сломался бы на не-существующий route).
 * Реальный контент — позже отдельной итерацией.
 */
const Reports = Page((Ui) => (
  <Ui.Layout.Flex direction="col" align="center" justify="center" class="min-h-screen p-8">
    <Ui.Typography variant="h2">Reports</Ui.Typography>
    <Ui.Typography variant="muted">— placeholder —</Ui.Typography>
  </Ui.Layout.Flex>
));

export default Reports;
