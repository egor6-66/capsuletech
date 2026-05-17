import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { builtinModules } from 'node:module';
import { resolve } from 'node:path';
import { type Plugin, type UserConfig, defineConfig, mergeConfig } from 'vite';
import dts from 'vite-plugin-dts';
import solidPlugin from 'vite-plugin-solid';
import tsconfigPaths from 'vite-tsconfig-paths';

export type LibRuntime = 'browser' | 'node' | 'isomorphic';

export interface IDefineLibConfigOptions {
  /** Точка входа: путь-строка или `{ name: path }` для multi-entry. */
  entry: string | Record<string, string>;
  /** Имя для lib-mode (используется в bundle metadata). */
  name: string;
  /**
   * `'browser'` (default) — client lib, `'node'` — серверный/build-time пакет,
   * `'isomorphic'` — пакет с обоими типами entry (например `@capsuletech/core`,
   * где `./create` для браузера, а `./builder` для node).
   */
  runtime?: LibRuntime;
  /** Куда складывать билд. По умолчанию `'dist'`. */
  outDir?: string;
  /** Доп. external'ы поверх дефолтов. */
  external?: (string | RegExp)[];
  noExternal?: (string | RegExp)[];
  /** Доп. плагины. Solid + dts + tsconfig-paths уже включены. */
  plugins?: any[];
  /** Доп. resolve.alias. */
  alias?: Record<string, string>;
  /** Выключить DTS-генерацию (по умолчанию включена). */
  dts?: boolean;
  /**
   * Эмитить очищенный `package.json` в `outDir` (для clean-publish /
   * глобального линка прямо из `dist/`). По умолчанию `true`.
   */
  emitPackageJson?: boolean;
  /**
   * Список строк или регулярных выражений, которые нужно ИСКЛЮЧИТЬ из списков external.
   * Пакеты, попавшие сюда, будут вшиты (забандлены) прямо в код библиотеки.
   */
  bundleDependencies?: (string | RegExp)[];
  /** Сырое слияние с финальным config'ом. */
  override?: UserConfig;
  ssr?: boolean;
}

/** Всё, что не должно вшиваться в bundle — резолвится у consumer'а. */
const BROWSER_EXTERNAL: (string | RegExp)[] = [
  /^@capsuletech\//,
  'solid-js',
  /^solid-js\//,
  /^@solidjs\//,
  /^@tanstack\//,
  /^@kobalte\//,
  /^@motionone\//,
  /^@xstate\//,
  'xstate',
  'lucide-solid',
  'zod',
  'class-variance-authority',
  'clsx',
  'tailwind-merge',
  'solid-motionone',
  'jiti',
  'tslib',
];

/**
 * Дополнительный набор externals для Node-target-пакетов.
 */
const NODE_EXTERNAL: (string | RegExp)[] = [
  ...builtinModules,
  ...builtinModules.map((m) => `node:${m}`),
  'vite',
  /^vite\//,
  'building.ts-plugin-solid',
  'building.ts-plugin-dts',
  'building.ts-tsconfig-paths',
  /^@nx\//,
  'nx',
  /^nx\//,
  /^@swc-node\//,
  /^@swc\//,
  /^@babel\//,
  'ts-morph',
  '@tailwindcss/building.ts',
  'tailwindcss',
  '@tailwindcss/vite',
  /^@tailwindcss\/oxide/,
  'unplugin-auto-import',
  'chalk',
  'commander',
  'ora',
  'enquirer',
  'inquirer',
  'execa',
  'conf',
  'es-toolkit',
  'fsevents',
];

const emitDistPackageJsonPlugin = (outDir: string): Plugin => {
  const stripOutDir = (p: string): string => {
    const prefix = `./${outDir}/`;
    if (p.startsWith(prefix)) return `./${p.slice(prefix.length)}`;
    if (p === `./${outDir}`) return '.';
    return p;
  };

  const rewriteExports = (value: unknown): unknown => {
    if (typeof value === 'string') return stripOutDir(value);
    if (Array.isArray(value)) return value.map(rewriteExports);
    if (value && typeof value === 'object') {
      const next: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        if (k === 'source') continue;
        next[k] = rewriteExports(v);
      }
      return next;
    }
    return value;
  };

  return {
    name: 'capsule:emit-dist-package-json',
    apply: 'build',
    closeBundle() {
      const rootPkgPath = resolve('package.json');
      const raw = readFileSync(rootPkgPath, 'utf8');
      const pkg = JSON.parse(raw) as Record<string, unknown>;
      delete pkg.scripts;
      delete pkg.devDependencies;
      delete pkg.files;
      delete pkg.publishConfig;

      for (const key of ['main', 'module', 'types', 'typings'] as const) {
        if (typeof pkg[key] === 'string') pkg[key] = stripOutDir(pkg[key] as string);
      }
      if (pkg.exports) pkg.exports = rewriteExports(pkg.exports);

      const distDirPath = resolve(outDir);
      mkdirSync(distDirPath, { recursive: true });
      const distPkgPath = resolve(distDirPath, 'package.json');
      writeFileSync(distPkgPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
    },
  };
};

export const libConfig = (opts: IDefineLibConfigOptions): UserConfig => {
  const outDir = opts.outDir ?? 'dist';
  const runtime = opts.runtime ?? 'browser';
  const entry =
    typeof opts.entry === 'string'
      ? { index: resolve(opts.entry) }
      : Object.fromEntries(Object.entries(opts.entry).map(([k, v]) => [k, resolve(v)]));

  // Собираем базовый список внешних зависимостей (массив строк и регулярных выражений)
  const defaultExternals =
    runtime === 'browser' ? BROWSER_EXTERNAL : [...BROWSER_EXTERNAL, ...NODE_EXTERNAL];
  const userExternals = opts.external ?? [];
  const fullExternalList = [...defaultExternals, ...userExternals];

  // Динамическая функция валидации импортов для Rollup
  const rollupExternalSelector = (
    id: string,
    importer: string | undefined,
    isResolved: boolean,
  ) => {
    // 1. Относительные импорты файлов самого проекта всегда пакуем внутрь
    if (id.startsWith('.') || id.startsWith('/') || id.includes(':')) {
      // Но встроенные node: модули всё равно должны оставаться внешними
      if (id.startsWith('node:')) return true;
      return false;
    }

    // 2. Всегда принудительно оставляем внешними любые нативные .node файлы, чтобы сборка не падала
    if (id.endsWith('.node')) return true;

    // 3. Проверяем, передан ли белый список на упаковку (bundleDependencies)
    if (opts.bundleDependencies && opts.bundleDependencies.length > 0) {
      const isWhitelistedForBundle = opts.bundleDependencies.some((target) => {
        if (target instanceof RegExp) return target.test(id);
        if (typeof target === 'string') {
          return id === target || id.startsWith(`${target}/`);
        }
        return false;
      });

      // Если пакет явно разрешен к упаковке — возвращаем false (НЕ делать внешним)
      if (isWhitelistedForBundle) return false;
    }

    // 4. Проверяем, входит ли текущий импорт в списки базовых externals
    const shouldBeExternal = fullExternalList.some((target) => {
      if (target instanceof RegExp) return target.test(id);
      if (typeof target === 'string') {
        return id === target || id.startsWith(`${target}/`);
      }
      return false;
    });

    return shouldBeExternal;
  };

  const base: UserConfig = defineConfig({
    plugins: [
      ...(runtime !== 'node' ? [solidPlugin()] : []),
      tsconfigPaths(),
      ...(opts.dts === false
        ? []
        : [
            dts({
              entryRoot: 'src',
              outDir,
              pathsToAliases: false,
              include: ['src/**/*.ts', 'src/**/*.tsx'],
              tsconfigPath: existsSync(resolve('paths.config.json'))
                ? 'paths.config.json'
                : 'tsconfig.json',
              compilerOptions: { composite: false },
            }),
          ]),
      ...(opts.emitPackageJson === false ? [] : [emitDistPackageJsonPlugin(outDir)]),
      ...(opts.plugins ?? []),
    ],
    resolve: {
      alias: opts.alias ?? {},
      dedupe: ['solid-js', 'solid-js/web'],
      conditions:
        runtime === 'browser'
          ? ['solid', 'browser', 'import', 'development']
          : runtime === 'isomorphic'
            ? ['solid', 'browser', 'node', 'import', 'development'] // Для изоморфных пакетов
            : ['node', 'import'],
    },
    optimizeDeps: {
      exclude: ['solid-js', 'solid-js/web', 'solid-js/store'],
    },
    build: {
      outDir,
      emptyOutDir: true,
      sourcemap: true,
      ssr: runtime === 'node',
      target: runtime === 'node' ? 'node18' : 'esnext',
      lib: {
        entry,
        name: opts.name,
        formats: ['es'],
      },
      rollupOptions: {
        // Заменяем массив на умную функцию-селектор
        external: rollupExternalSelector,
        output: {
          entryFileNames: '[name].mjs',
          chunkFileNames: 'chunks/[name]-[hash].mjs',
          assetFileNames: 'assets/[name][extname]',
        },
      },
    },
  });

  return opts.override ? mergeConfig(base, opts.override) : base;
};
