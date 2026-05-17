import { existsSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Рекурсивный обход директории — возвращает абсолютные пути всех файлов.
 *
 * Используется плагинами для initial-scan: Vite-чокидар стартует с `ignoreInitial: true`,
 * поэтому существующие при старте файлы не получают `add`-ивент. Мы эмулируем его сами.
 */
export const walkFiles = async (dir: string): Promise<string[]> => {
  if (!existsSync(dir)) return [];
  const entries = await readdir(dir, { withFileTypes: true });
  const out: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await walkFiles(full)));
    } else if (entry.isFile()) {
      out.push(full);
    }
  }
  return out;
};
