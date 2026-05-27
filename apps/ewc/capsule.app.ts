import { defineAppConfig } from '@capsuletech/web-query/app-config';

export default defineAppConfig({
  meta: { tags: ['click', 'input', 'submit', 'login', 'password'] },
  aliases: {
    '@input': ['input'],
    '@submit': ['submit'],
  },
});
