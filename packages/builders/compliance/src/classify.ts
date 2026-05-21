/**
 * Классификация файла по слою HCA на основе пути.
 *
 * Для путей внутри `apps/<app>/src/<layer>/...` возвращает соответствующий слой.
 * Для системных пакетов (`packages/<name>/...`) — `'system'` (без ограничений).
 * Для авто-генерёных файлов в `.capsule/` — `null` (skip).
 * Для тестовых файлов — `'test'` (ослабленный режим).
 */

export type Layer =
  | 'view'
  | 'controller'
  | 'feature'
  | 'widget'
  | 'page'
  | 'system'
  | 'test'
  | null;

const TEST_PATTERN = /\.(spec|test)\.[jt]sx?$/;
const CAPSULE_GEN = /[\\/]\.capsule[\\/]/;
const NODE_MODULES = /[\\/]node_modules[\\/]/;

const LAYER_RX: Array<[Layer, RegExp]> = [
  ['view', /[\\/]apps[\\/][^\\/]+[\\/]src[\\/]views[\\/]/],
  ['controller', /[\\/]apps[\\/][^\\/]+[\\/]src[\\/]controllers[\\/]/],
  ['feature', /[\\/]apps[\\/][^\\/]+[\\/]src[\\/]features[\\/]/],
  ['widget', /[\\/]apps[\\/][^\\/]+[\\/]src[\\/]widgets[\\/]/],
  ['page', /[\\/]apps[\\/][^\\/]+[\\/]src[\\/]pages[\\/]/],
  ['system', /[\\/]packages[\\/]/],
];

export const classify = (absPath: string): Layer => {
  if (!absPath) return null;
  if (NODE_MODULES.test(absPath)) return null;
  if (CAPSULE_GEN.test(absPath)) return null;
  if (TEST_PATTERN.test(absPath)) return 'test';

  for (const [layer, rx] of LAYER_RX) {
    if (rx.test(absPath)) return layer;
  }

  return null; // не наш файл, не классифицируем
};

/**
 * Извлечь идентификатор группы внутри слоя — для проверок горизонтальных импортов.
 * `apps/sandbox/src/entities/_auth/loginForm.tsx` → `'_auth'`
 * Если группа не определена — возвращает `null`.
 */
export const extractGroup = (absPath: string, layer: Layer): string | null => {
  if (!layer || layer === 'system' || layer === 'test') return null;
  const layerNamePlural =
    layer === 'view'
      ? 'views'
      : layer === 'controller'
        ? 'controllers'
        : layer === 'feature'
          ? 'features'
          : layer === 'widget'
            ? 'widgets'
            : 'pages';
  const rx = new RegExp(`[\\\\/]${layerNamePlural}[\\\\/]([^\\\\/]+)[\\\\/]`);
  const m = absPath.match(rx);
  return m ? m[1] : null;
};
