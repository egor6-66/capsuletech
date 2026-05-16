const Index = Page((Ui, _Widgets) => (
  <Ui.Layout
    variant={'dashboard'}
    slots={{
      header: <div>HEADER</div>,
      sidebar: Ui.Layout.slot({
        children: <div>sidebar</div>,
        resizable: true, // ← TS подсказывает
        initialSize: 0.2, // ← все поля видны
        minSize: 0.1,
        maxSize: 0.4,
      }),
      main: Ui.Layout.slot({
        children: <div>main</div>,
        resizable: true, // ← TS подсказывает
      }),
      rightBar: Ui.Layout.slot({
        children: <div>rightBar</div>,
        resizable: true, // ← TS подсказывает
        initialSize: 0.2, // ← все поля видны
        minSize: 0.1,
        maxSize: 0.4,
      }),
    }}
  />
));

export default Index;
