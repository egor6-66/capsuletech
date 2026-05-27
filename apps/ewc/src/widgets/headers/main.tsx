const Main = Widget((Ui) => (
  <Features.Workspace>
    <Ui.Layout.Flex align="center" justify="between" class="h-full px-cell border-b bg-background">
      {/*<Ui.Typography variant="muted">EWC 2.0</Ui.Typography>*/}
      <Views.WorkspaceMenu />
    </Ui.Layout.Flex>
  </Features.Workspace>
));

export default Main;
