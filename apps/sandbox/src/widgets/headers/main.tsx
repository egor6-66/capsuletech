const Main = Widget((_Ui, Features, Controllers, Entities) => (
  <Features.Viewer.Auth>
    <Controllers.Universal.Navigation overrides={{ onClick: 'logout' }}>
      <Entities.Header.Main meta={{ tags: ['@header'] }} />
    </Controllers.Universal.Navigation>
  </Features.Viewer.Auth>
));

export default Main;
