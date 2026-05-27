/**
 * Auth feature — обрабатывает submit от form view.
 *
 * Flow:
 *   idle.submit (event с tag '@submit') → собирает inputs из store.ctx
 *   → api.auth.login(payload) → save token / log error.
 *
 * UiProxy auto-собирает inputs в `store.ctx` через `meta.name` (login/password).
 * Click button с tag '@submit' триггерит handler.
 */
const Auth = Feature(({ api }) => ({
  initial: 'idle',

  states: {
    idle: {
      submit: async ({ store }) => {
        if (!api) {
          // eslint-disable-next-line no-console
          console.error('[auth] api client not initialized — check capsule.app.ts > api');
          return;
        }

        const payload = {
          login: (store.ctx as any).login ?? '',
          password: (store.ctx as any).password ?? '',
        };

        try {
          const result = await api.auth.login(payload);
          // Token saved — next iteration добавим navigation.
          // eslint-disable-next-line no-console
          console.log('[auth] login ok:', result);
          localStorage.setItem('capsule-auth-token', result.token);
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error('[auth] login failed:', err);
        }
      },
    },
  },
}));

export default Auth;
