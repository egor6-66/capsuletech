/**
 * Auth feature — обрабатывает click на submit-кнопке.
 *
 * Flow:
 *   onClick → фильтр по tag 'submit' (raw, не alias — alias только на query-стороне)
 *   → store.values(['@input']) собирает inputs через alias-зонтик в Record<name, value>
 *   → api.auth.login → token в localStorage / error в console.
 *
 * Почему onClick, а не submit:
 *   UiProxy маршрутизирует события по DOM event name (onClick/onInput/…),
 *   не по тегам. Tag 'submit' — маркер для фильтра ВНУТРИ handler'а.
 *   См. packages/web/core/src/engine/ui-proxy.tsx (вызов `ctx.controller[name]`).
 */
const Auth = Feature(({ api }) => ({
  initial: 'idle',

  states: {
    idle: {
      onClick: async ({ target, store }) => {
        const tags = (target.meta?.tags ?? []) as readonly string[];
        if (!tags.includes('submit')) return;

        if (!api) {
          // eslint-disable-next-line no-console
          console.error('[auth] api client not initialized — check capsule.app.ts > api');
          return;
        }

        const values = store.values(['@input']) as { login?: string; password?: string };

        try {
          const result = await api.auth.login({
            login: values.login ?? '',
            password: values.password ?? '',
          });
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
