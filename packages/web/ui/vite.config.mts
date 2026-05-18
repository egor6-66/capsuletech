import {
  cpSync,
  existsSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { libConfig } from '@capsuletech/lib-builder';
import type { Plugin } from 'vite';

const __dirname = dirname(fileURLToPath(import.meta.url));

// vite-plugin-dts кладёт .d.ts по структуре src (entryRoot: 'src'),
// а .mjs идут по entry-ключам Vite — поэтому для атомов получается
// dist/primitives/<comp>/index.d.ts и dist/components/<comp>/index.mjs.
// Subpath-exports (@capsuletech/web-ui/button) ищут .d.ts рядом с .mjs — мерджим:
// переносим dist/primitives/* в dist/components/* и патчим barrel index.d.ts.
const remapPrimitivesDtsPlugin = (outDir: string): Plugin => ({
  name: 'capsule-web-ui:remap-primitives-dts',
  apply: 'build',
  closeBundle() {
    const distDir = resolve(__dirname, outDir);
    const primitivesDir = resolve(distDir, 'primitives');
    const componentsDir = resolve(distDir, 'components');
    if (!existsSync(primitivesDir)) return;

    // Мерджим содержимое primitives/ в components/ — и поддиректории
    // (per-component .d.ts), И top-level файлы (вроде primitives/index.d.ts
    // = barrel `src/primitives/index.ts`). Без второго dist/index.d.ts ссылается
    // на ./components, но `components/index.d.ts` не появляется — bundler
    // и node резолверы падают на InternalResolutionError (attw bundler ❌).
    for (const entry of readdirSync(primitivesDir)) {
      const from = resolve(primitivesDir, entry);
      let isDir = false;
      try {
        isDir = statSync(from).isDirectory();
      } catch {
        continue;
      }
      if (isDir) {
        cpSync(from, resolve(componentsDir, entry), { recursive: true });
      } else if (entry === 'index.d.ts') {
        // primitives/index.d.ts → components/index.d.ts (барель — пути
        // `./button` etc указывают на siblings и остаются валидными).
        cpSync(from, resolve(componentsDir, 'index.d.ts'));
      }
    }
    rmSync(primitivesDir, { recursive: true, force: true });

    // dist/index.d.ts ссылается на ./primitives — перенацеливаем на ./components.
    const rootDts = resolve(distDir, 'index.d.ts');
    if (existsSync(rootDts)) {
      const src = readFileSync(rootDts, 'utf8');
      const patched = src.replace(/(['"])\.\/primitives\1/g, '$1./components$1');
      if (patched !== src) writeFileSync(rootDts, patched, 'utf8');
    }
  },
});

// Multi-entry: на каждый файл внутри src/primitives/*/ и src/components/*/.
// Примитивы (atoms) и композиции (molecules) собираются в один плоский dist:
//   src/primitives/button/index.tsx   → dist/components/button/index.mjs
//   src/components/text-field/index.tsx → dist/components/text-field/index.mjs
// Это нужно, чтобы exports вида `@capsuletech/web-ui/card/parts` резолвились в
// реальный dist-файл, а имя «components» в dist оставалось стабильным для
// внешних потребителей (см. package.json#exports).
const SRC_DIRS = ['primitives', 'components'] as const;
const componentEntries: Record<string, string> = {};
for (const srcName of SRC_DIRS) {
  const srcDir = resolve(__dirname, 'src', srcName);
  try {
    if (!statSync(srcDir).isDirectory()) continue;
  } catch {
    continue;
  }
  for (const compName of readdirSync(srcDir)) {
    const compDir = resolve(srcDir, compName);
    try {
      if (!statSync(compDir).isDirectory()) continue;
    } catch {
      continue;
    }
    for (const file of readdirSync(compDir)) {
      if (!/\.(ts|tsx)$/.test(file)) continue;
      if (/\.(d\.ts|test\.ts|spec\.ts)$/.test(file)) continue;
      const stem = file.replace(/\.(ts|tsx)$/, '');
      componentEntries[`components/${compName}/${stem}`] = `src/${srcName}/${compName}/${file}`;
    }
  }
}

export default libConfig({
  entry: {
    index: 'src/index.ts',
    ...componentEntries,
  },
  name: 'CapsuleUi',
  plugins: [remapPrimitivesDtsPlugin('dist')],
});
