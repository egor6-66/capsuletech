import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import AutoImport from 'unplugin-auto-import/vite';
import {
  AliasesPlugin,
  AppConfigPlugin,
  CompliancePlugin,
  EndpointsRegistryPlugin,
  EnsureScaffoldPlugin,
  ExportGeneratorPlugin,
  HMRWrappingPlugin,
  RouterPlugin,
  solidPlugin,
  tsconfigPaths,
} from '../plugins';
import { DEFINE_FACTORIES, WRAPPER_NAMES } from '../plugins/constants';
import { appConfig } from './appConfig';

export interface ICapsuleConfig {
  devServerPort?: number;
}

interface IProps {
  config: any;
  root: string;
  workspaceRoot: string;
  isDev: boolean;
}

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

export const capsuleConfig = ({ config, root, workspaceRoot, isDev }: IProps) => {
  const capsuleRoot = join(root, '.capsule');
  const watchDir = join(root, 'src');
  const appConfigState = { aliasKeys: new Set<string>() };

  const dedupe = [
    'solid-js',
    'solid-js/web',
    'solid-js/store',
    '@capsuletech/web-ui',
    '@capsuletech/web-state',
    '@capsuletech/shared-file-manager',
  ];

  const capsuleConfig = {
    ...config,
    root: capsuleRoot,
    define: {
      __CAPSULE_CONFIG__: JSON.stringify(config),
      // NB: identity-unwrap для `defineAppConfig` / `defineCapsuleConfig` живёт
      // в `AppConfigPlugin.transform` (см. plugins/appConfig.ts). Через esbuild
      // `define:` это сделать нельзя — он валидирует value как identifier|literal
      // и отбивает arrow-expression со стороны `[vite:define]`.
    },
    build: {
      // watch: {} только в dev — production-сборка должна быть one-shot
      // (иначе CI-step `capsule build` зависает после первого цикла и не
      // освобождает workflow).
      ...(isDev ? { watch: {} } : {}),
      rollupOptions: {
        input: join(capsuleRoot, 'index.html'),
      },
      // outDir — `apps/<app>/dist/` (не `.capsule/dist/`). Vite-root указан в
      // `.capsule/`, но артефакт должен лежать рядом с `src/`, как ожидает
      // и пользователь `capsule build`, и `scripts/desktop.mjs` (default
      // `--dist=apps/<app>/dist`). Vite предупредит «outDir is outside of
      // root» — это намеренно.
      outDir: join(root, 'dist'),
      emptyOutDir: true,
    },
    optimizeDeps: {
      // Принудительно подготавливаем Solid + CJS-зависимости (xstate отдаёт
      // CJS-сборку, и без явного include esbuild не вытащит named exports —
      // в дев-сервере падает `does not provide an export named 'Actor'`).
      include: ['solid-js', 'solid-js/web', 'solid-js/store', 'xstate', '@xstate/solid'],
      // Исключаем внутренние пакеты монорепозитория из пре-бандлинга esbuild.
      // Благодаря этому Vite будет обрабатывать их на лету через плагины
      // (включая JSX транспиляцию).
      exclude: [
        '@capsuletech/web-core',
        '@capsuletech/web-dnd',
        '@capsuletech/web-editor',
        '@capsuletech/web-map',
        '@capsuletech/web-profiler',
        '@capsuletech/web-query',
        '@capsuletech/web-remote',
        '@capsuletech/web-renderer',
        '@capsuletech/web-router',
        '@capsuletech/web-state',
        '@capsuletech/web-style',
        '@capsuletech/web-ui',
      ],
    },
    plugins: [
      AutoImport({
        // NB: список wrapper'ов и define-фабрик — из единого источника
        // (plugins/constants). Когда добавляешь новый wrapper/factory —
        // правишь только constants.ts.
        imports: [
          { '@capsuletech/web-core': [...WRAPPER_NAMES] },
          ...Object.entries(DEFINE_FACTORIES).map(([mod, names]) => ({
            [mod]: [...names],
          })),
        ],
        dirs: [join(capsuleRoot, 'registry')],
        dts: './@types/capsule-imports.d.ts',
      }),
      HMRWrappingPlugin(),
      AppConfigPlugin({
        configPath: join(root, 'capsule.app.ts'),
        typesOut: join(capsuleRoot, '@types', 'app-tags.d.ts'),
        runtimeOut: join(capsuleRoot, 'app-config.gen.ts'),
        onLoad: (cfg) => {
          appConfigState.aliasKeys = new Set(Object.keys(cfg.aliases ?? {}));
        },
      }),
      tsconfigPaths({
        projects: [join(root, 'tsconfig.json'), join(workspaceRoot, 'tsconfig.base.json')],
      }),
      EnsureScaffoldPlugin(capsuleRoot),
      ExportGeneratorPlugin({
        out: join(capsuleRoot, 'registry', 'wrappers.ts'),
        typesOut: join(capsuleRoot, '@types', 'slots.d.ts'),
        watchDir,
      }),
      EndpointsRegistryPlugin({
        out: join(capsuleRoot, 'registry', 'endpoints.ts'),
        typesOut: join(capsuleRoot, '@types', 'api.d.ts'),
        watchDir,
      }),
      tailwindcss(),
      AliasesPlugin({ appRoot: root, workspaceRoot }),
      CompliancePlugin({ mode: 'warn', appConfigState }),

      RouterPlugin({
        watchDir,
        outDir: join(capsuleRoot, 'routes'),
      }),
      solidPlugin({ ssr: false }),
    ],
    resolve: {
      dedupe,
      // Без `'development'` условия: оно бы перенаправило `@capsuletech/*` на
      // `./src/...`, который не публикуется в npm/Verdaccio (`files: ["dist"]`).
      // Для внешних воркспейсов это ломает резолв `@capsuletech/web-core/providers`
      // и т.п. App-сервер всегда читает собранный `dist/*.mjs` через `import`.
      conditions: ['solid', 'browser', 'import'],
    },
    server: {
      port: config.devServerPort || 3000,
    },
    esbuild: {
      tsconfigRaw: readFileSync(join(root, 'tsconfig.json'), 'utf-8'),
    },
  };

  return appConfig(capsuleConfig, isDev);
};
