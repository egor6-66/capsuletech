/**
 * Controller: WindowControls
 * --------------------------
 * Перехватывает onClick на кнопках min/max/close (по meta tags)
 * и делегирует в Features.Desktop через next.with(...).
 *
 * Pattern (ADR 008 + web-core overrides):
 *   - UI element: <Ui.Button meta={{ tags: ['minimize'] }} />
 *   - Controller.onClick: routes по target.has(tag) → Feature method.
 */
const WindowControls = Controller(() => ({
  initial: 'idle',
  states: {
    idle: {
      onClick: async ({ target, next }) => {
        if (target.has('minimize')) return next.with(Features.Desktop, 'minimize');
        if (target.has('maximize')) return next.with(Features.Desktop, 'toggleMaximize');
        if (target.has('close')) return next.with(Features.Desktop, 'close');
      },
    },
  },
}));

export default WindowControls;
