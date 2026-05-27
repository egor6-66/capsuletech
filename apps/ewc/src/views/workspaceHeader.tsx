/**
 * WorkspaceHeader — title block для header'а workspace (без внешнего layout).
 * Внешний Layout.Flex с border/bg переехал в Widget headers/main — он же
 * добавляет menu справа через Views.WorkspaceMenu.
 */
const WorkspaceHeader = View((Ui) => (
  <Ui.Layout.Flex align="center" gap={3}>
    <Ui.Typography variant="h2">EWC 2.0</Ui.Typography>
    <Ui.Typography variant="muted">workspace</Ui.Typography>
  </Ui.Layout.Flex>
));

export default WorkspaceHeader;
