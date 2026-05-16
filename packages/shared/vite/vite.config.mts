import { libConfig } from './src/defines/libConfig';
import { staticCopyPlugin } from './src/plugins';
import path from 'node:path';

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
  // Бандлим `shared-compliance` внутрь dist, иначе возникает реальный цикл:
  // shared-vite -> shared-compliance (runtime через CompliancePlugin), а
  // compliance в devDep тянет shared-vite для своей сборки через libConfig.
  // (file-manager заинлайнен в utils/generateFromTemplates — убран из deps.)
  bundleDependencies: [
    /^@capsuletech\/shared-compliance/,
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
