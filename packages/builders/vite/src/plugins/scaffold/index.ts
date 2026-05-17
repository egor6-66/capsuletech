import { existsSync } from 'node:fs';
import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';

const __dirname = dirname(fileURLToPath(import.meta.url));

const FILES = ['index.html', 'index.ts', 'bootstrap.tsx', 'paths.config.json'] as const;

/**
 * Гарантирует наличие entry-файлов (`index.html`, `index.ts`, `bootstrap.tsx`)
 * в `.capsule/`. Если их нет — копирует из встроенных шаблонов. Нужно для
 * клонированных/свежесозданных приложений, где CLI init ещё не запускался.
 *
 * Файлы пишутся реально на диск (а не отдаются через middleware), чтобы их
 * мог увидеть TanStackRouterVite и любой другой плагин, работающий с FS.
 */
export const EnsureScaffoldPlugin = (capsuleRoot: string): Plugin => ({
  name: 'capsule-ensure-scaffold',
  enforce: 'pre',
  async config() {
    const absRoot = resolve(capsuleRoot);
    await mkdir(absRoot, { recursive: true });
    for (const name of FILES) {
      const dest = resolve(absRoot, name);
      if (existsSync(dest)) continue;
      const src = resolve(__dirname, 'template', `${name}.template`);
      await copyFile(src, dest);
      console.log(`📄 Создан ${name} в ${absRoot}`);
    }
  },
});
