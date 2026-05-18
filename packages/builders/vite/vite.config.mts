import path from 'node:path';
import { libConfig } from '../lib/src/libConfig';
// Деep-import минуя barrel — иначе esbuild потянет CompliancePlugin → compliance/dist.
import { staticCopyPlugin } from './src/plugins/staticCopy';

export default libConfig({
  entry: 'src/index.ts',
  name: 'CapsuleVite',
  runtime: 'node',

  external: [
    'vite',
    /^vite\//,
    'vite-plugin-solid',
    '@solidjs/vite-plugin',
    'solid-refresh',
    /^solid-refresh\//,
  ],
  // Бандлим `@capsuletech/compliance` внутрь dist, иначе возникает реальный цикл:
  // vite-builder -> compliance (runtime через CompliancePlugin), а
  // compliance в devDep тянет vite-builder для своей сборки через libConfig.
  bundleDependencies: [
    /^@capsuletech\/compliance/,
    // lib-builder содержит libConfig — переэкспортируется наружу как
    // часть runtime API `@capsuletech/vite-builder`, поэтому inline'им в dist.
    /^@capsuletech\/lib-builder/,
    /^@babel\//,
    /^babel-/,
    /babel-plugin/,
    /^solid-js/,
    /unplugin-auto-import/,
    /^@nx\/vite/,
    '@babel/helper-module-imports',
  ],
  override: {
    build: {
      // Принудительно включаем SSR-режим сборки для Node,
      // иначе Vite автоматически сделает весь package.json внешним
      ssr: true,
    },

    ssr: {
      // Говорим Vite НЕ делать внешними эти пакеты на этапе пре-бандлинга
      noExternal: [/^@babel\//, /^babel-/, /babel-plugin/, /unplugin-auto-import/, /^@nx\/vite/],
    },
  },
  plugins: [
    staticCopyPlugin([
      {
        src: path.resolve(__dirname, 'src/plugins/router/template'),
        dest: path.resolve(__dirname, 'dist/template'),
      },
    ]),
  ],
});
