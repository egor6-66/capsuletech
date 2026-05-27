export default defineAppConfig({
  meta: { tags: ['click', 'input', 'submit', 'login', 'password'] },
  aliases: {
    '@input': ['input'],
    '@submit': ['submit'],
  },
  api: () => ({
    bases: { default: '/api' },
  }),
});
