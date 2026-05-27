/**
 * Auth feature — FSM idle → submitting → idle.
 *
 * Flow:
 *   idle.onClick (tag 'submit') → state.set('submitting')
 *   submitting.onInit → store.patch для loader/disable → api.auth.login → cleanup → state.set('idle')
 *
 * Демонстрирует возможности фреймворка:
 *  - per-state lifecycle (onInit/onExit)
 *  - tag-based runtime patches (store.patch)
 *  - store.values для сбора form-payload по alias-зонтику
 *  - UiProxy сам инжектит kind-tags ('input'/'button') — в View их в meta нет.
 */
const Auth = Feature(({ api, router }) => ({
  initial: 'idle',

  states: {
    idle: {
      onClick: ({ target, state }) => {
        const tags = (target.meta?.tags ?? []) as readonly string[];
        if (tags.includes('submit')) state.set('submitting');
      },
    },

    submitting: {
      onInit: async ({ store, state }) => {
        if (!api) {
          // eslint-disable-next-line no-console
          console.error('[auth] api client not initialized — check capsule.app.ts > api');
          state.set('idle');
          return;
        }

        store.patch(['@submit'], { loading: true });
        store.patch(['@input'], { disabled: true });

        const values = store.values(['@input']) as { login?: string; password?: string };

        try {
          const result = await api.auth.login({
            login: values.login ?? '',
            password: values.password ?? '',
          });
          // eslint-disable-next-line no-console
          console.log('[auth] login ok:', result);
          localStorage.setItem('capsule-auth-token', result.token);
          router.goTo('/workspace');
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error('[auth] login failed:', err);
        } finally {
          store.patch(['@submit'], { loading: false });
          store.patch(['@input'], { disabled: false });
          state.set('idle');
        }
      },
    },
  },
}));

export default Auth;
