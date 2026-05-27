/**
 * Workspace feature — обрабатывает click'и в workspace shell'е.
 *
 * Сейчас:
 *   - tag 'logout' → clear token + redirect /login.
 *
 * Дальше расширим: nav-items, action buttons и т.п. — всё фильтруется по
 * target.meta.tags внутри одного onClick handler'а.
 */
const Workspace = Feature(({ router }) => ({
  initial: 'idle',

  states: {
    idle: {
      onClick: ({ target }) => {
        const tags = (target.meta?.tags ?? []) as readonly string[];
        if (tags.includes('logout')) {
          localStorage.removeItem('capsule-auth-token');
          router.goTo('/login');
        }
      },
    },
  },
}));

export default Workspace;
