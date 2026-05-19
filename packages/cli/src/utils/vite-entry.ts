import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import type { CliMode } from '../context';

const require = createRequire(import.meta.url);

/**
 * Точка входа `@capsuletech/vite-builder` зависит от mode:
 * - dev (внутри capsule-репо): подсасываем собранный `dist/index.mjs` пакета напрямую,
 *   так jiti не нужен — там уже ESM.
 * - prod (CLI установлен из npm в пользовательский workspace): резолвим через
 *   `require.resolve` обычным путём; если node_modules-структура нестандартная,
 *   fallback на `<root>/node_modules/@capsuletech/vite-builder`.
 */
export const getViteEntry = (root: string, mode: CliMode): string => {
  if (mode === 'dev') {
    return resolve(root, 'packages/builders/vite/dist/index.mjs');
  }
  try {
    return require.resolve('@capsuletech/vite-builder');
  } catch {
    return resolve(root, 'node_modules/@capsuletech/vite-builder');
  }
};
