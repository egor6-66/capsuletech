import solid from 'vite-plugin-solid';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // hot:false — отключаем solid-refresh для тестов (иначе jsdom получает
  // file:///@solid-refresh URL и ругается на 'filename must be ...').
  plugins: [solid({ hot: false })],
  test: {
    include: ['src/**/__tests__/**/*.test.ts', 'src/**/__tests__/**/*.test.tsx'],
    // jsdom нужен для UiProxy render-тестов (создание элементов, dispatchEvent).
    // Pure-helper тесты (derivation/controller-proxy/getTargetData) от этого
    // не страдают — jsdom-globals им просто не мешают.
    environment: 'jsdom',
    globals: false,
    // @tanstack/solid-router отдаёт .jsx файлы в dev-conditions: без inline
    // node natively не понимает .jsx и падает на резолве `Link` через
    // ui-kit/imports.tsx → @tanstack/solid-router/dist/source/index.dev.jsx.
    server: {
      deps: {
        inline: [/@tanstack\/solid-router/],
      },
    },
  },
});
