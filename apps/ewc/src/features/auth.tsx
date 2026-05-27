/**
 * Auth feature — пока только idle state.
 * Будет расширяться: submitting / error / success после mock-endpoint integration.
 */
const Auth = Feature(() => ({
  initial: 'idle',

  states: {
    idle: {},
  },
}));

export default Auth;
