import { existsSync } from 'node:fs';
import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';

const __dirname = dirname(fileURLToPath(import.meta.url));

// NOTE: bootstrap.tsx is intentionally NOT in this list.
// It is generated (and regenerated) deterministically by CapsuleRegistryPlugin,
// which owns all .capsule/ codegen. Copying a static template once would make
// import ordering fragile — the plugin generates it from LAYER_INIT_ORDER.
const FILES = ['index.html', 'index.ts', 'paths.config.json', 'styles.css'] as const;

/**
 * Гарантирует наличие статических entry-файлов (`index.html`, `index.ts`,
 * `paths.config.json`, `styles.css`) в `.capsule/`. Если их нет — копирует
 * из встроенных шаблонов. Нужно для клонированных/свежесозданных приложений,
 * где CLI init ещё не запускался.
 *
 * `bootstrap.tsx` НЕ входит в этот список — он полностью генерируется
 * `CapsuleRegistryPlugin` по `LAYER_INIT_ORDER` и всегда актуален.
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
