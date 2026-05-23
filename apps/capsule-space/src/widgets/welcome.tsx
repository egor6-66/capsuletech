const Welcome = Widget((Ui) => (
  <Ui.Animate variant="fade" duration={0.3}>
    <Ui.Card class="w-full max-w-md">
      <Ui.Card.Header>
        <Ui.Card.Title>Привет, Capsule 👋</Ui.Card.Title>
        <Ui.Card.Description>
          Стартовая заготовка. Открой src/pages/index.tsx и пиши свою историю.
        </Ui.Card.Description>
      </Ui.Card.Header>
      <Ui.Card.Content>
        <Views.Hello />
      </Ui.Card.Content>
    </Ui.Card>
  </Ui.Animate>
));

export default Welcome;
