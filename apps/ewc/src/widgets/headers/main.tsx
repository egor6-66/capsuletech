const Main = Widget((Ui) => (
  <Features.Workspace>
    <Ui.Layout.Flex
      align="center"
      justify="between"
      class="h-full px-cell border-b bg-background"
    >
      <Views.WorkspaceHeader />
      <Views.WorkspaceMenu />
    </Ui.Layout.Flex>
  </Features.Workspace>
));

export default Main;
