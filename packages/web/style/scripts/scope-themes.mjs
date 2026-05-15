#!/usr/bin/env node
// Перепаковывает каждую тему в themes/*.css так, чтобы её :root и .dark
// были скоупом для [data-theme="<name>"]. Запускать вручную после добавления
// или обновления темы. Идемпотентен: пропускает уже обёрнутые файлы.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve, dirname, basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const themesDir = resolve(here, '..', 'src', 'themes');

const files = readdirSync(themesDir).filter(
  (f) => f.endsWith('.css') && f !== 'index.css',
);

function extractBlock(src, header) {
  const start = src.indexOf(header);
  if (start === -1) return null;
  const braceOpen = src.indexOf('{', start);
  let depth = 0;
  for (let i = braceOpen; i < src.length; i++) {
    const ch = src[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        return { start, end: i + 1, body: src.slice(braceOpen + 1, i) };
      }
    }
  }
  return null;
}

for (const file of files) {
  const path = join(themesDir, file);
  const name = basename(file, '.css');
  const original = readFileSync(path, 'utf8');

  if (original.includes(`[data-theme="${name}"]`)) {
    console.log(`skip ${file} (already scoped)`);
    continue;
  }

  const rootBlock = extractBlock(original, ':root');
  const darkBlock = extractBlock(original, '.dark');

  if (!rootBlock || !darkBlock) {
    console.warn(`skip ${file} (no :root/.dark)`);
    continue;
  }

  const out = `/* Auto-scoped by scripts/scope-themes.mjs. Edit the tokens, not the selectors. */\n\n[data-theme="${name}"] {${rootBlock.body}}\n\n[data-theme="${name}"].dark,\n[data-theme="${name}"] .dark {${darkBlock.body}}\n`;

  writeFileSync(path, out);
  console.log(`scoped ${file}`);
}
