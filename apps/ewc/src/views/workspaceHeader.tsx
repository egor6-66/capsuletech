/**
 * WorkspaceHeader — полный header workspace'а в одной View.
 * Layout.Flex (внутри View, доступно через `ViewUiRaw.Layout` subset) — own
 * arrangement title + subtitle; не требует Widget-level композиции.
 */
const WorkspaceHeader = View((Ui) => (
  <Ui.Layout.Flex
    align="center"
    justify="between"
    class="h-full px-cell border-b bg-background"
  >
    <Ui.Typography variant="h2">EWC 2.0</Ui.Typography>
    <Ui.Typography variant="muted">workspace</Ui.Typography>
  </Ui.Layout.Flex>
));

export default WorkspaceHeader;
