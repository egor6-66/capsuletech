import { createRequire } from 'node:module';
import { extname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const require = (cwd: string) =>
  createRequire(pathToFileURL(join(cwd, 'package.json')).href);

const TS_EXT = new Set(['.ts', '.tsx', '.mts', '.cts']);

// Кэш jiti-инстанса: одна loader-цепочка на cwd, чтобы TS-импорты разруливались
// без повторной инициализации esbuild/sucrase при каждом вызове.
const jitiCache = new Map<string, unknown>();

const getJiti = async (cwd: string): Promise<(specifier: string) => Promise<unknown>> => {
  let inst = jitiCache.get(cwd) as { import: (s: string) => Promise<unknown> } | undefined;
  if (!inst) {
    const { createJiti } = await import('jiti');
    inst = await createJiti(pathToFileURL(join(cwd, 'package.json')).href, {
      interopDefault: true,
    });
    jitiCache.set(cwd, inst);
  }
  return (specifier: string) => inst!.import(specifier);
};

export const importModule = async <T = unknown>(specifier: string, cwd: string): Promise<T> => {
  const resolved = require(cwd).resolve(specifier);
  if (TS_EXT.has(extname(resolved))) {
    const jitiImport = await getJiti(cwd);
    return (await jitiImport(pathToFileURL(resolved).href)) as T;
  }
  return import(pathToFileURL(resolved).href) as Promise<T>;
};

export const isResolvable = (specifier: string, cwd: string): boolean => {
  try {
    require(cwd).resolve(specifier);
    return true;
  } catch {
    return false;
  }
};
