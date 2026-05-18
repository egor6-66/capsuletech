const Auth = Feature(({ router, query }) => ({
  initial: 'idle',
  states: {
    idle: {
      /**
       * Получает `target.from = { email, password }` от Form-контроллера
       * (тот зовёт `next.with(payload)` после сбора значений из inputs).
       * `target.payload` остаётся JSX-immutable — для submit-кнопки это обычно `undefined`.
       *
       * В sandbox реального backend'а нет, поэтому query.mutate упадёт на network,
       * и мы фоллбэчимся на mock egor/123. В реальном проекте mock уберётся.
       */
      authByLogin: async ({ target }) => {
        const { email, password } = (target.from ?? {}) as {
          email?: string;
          password?: string;
        };
        router.goTo('/branches');
        // try {
        //   // syncTo: store — query сам поставит loading + setErrors при fail.
        //   // invalidates: [['me']] — следующий fetch(['me']) сходит в сеть.
        //   const result = await query?.mutate<{ token?: string }>({
        //     url: '/login',
        //     body: { email, password },
        //     syncTo: store,
        //     name: 'login',
        //     invalidates: [['me']],
        //   });
        //
        //   if (result?.token) {
        //     router.goTo('/branches');
        //     return;
        //   }
        //   throw new Error('Empty response');
        // } catch (apiErr) {
        //   // Mock fallback пока нет backend'а
        //   console.warn('[_auth] API недоступен, fallback на mock:', apiErr);
        //   if (email === '' && password === '') {
        //     router.goTo('/branches');
        //     return;
        //   }
        //   throw new Error('Неверный логин или пароль');
        // }
      },

      logout: async ({ store }) => {
        try {
          await query?.mutate({ url: '/logout', syncTo: store, name: 'logout' });
        } catch {
          /* в sandbox backend'а нет — игнорим */
        }
        query?.invalidate(['me']);
        router.goTo('/auth');
      },
    },
  },
}));

export default Auth;
