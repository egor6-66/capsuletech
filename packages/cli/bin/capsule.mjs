#!/usr/bin/env node

import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

process.env.FORCE_COLOR = '3';
process.env.TERM = 'xterm-256color';

if (!process.stdin.isTTY && process.env.JETBRAINS_IDE) {
  process.stdin.isTTY = true;
}

const __dirname = dirname(fileURLToPath(import.meta.url));

// 1. Определяем, где мы находимся (dev или dist)
const tsPath = join(__dirname, '../src/cli/index.ts');
const jsPath = join(__dirname, '../dist/index.mjs');
const isDev = existsSync(tsPath);
const entryPath = isDev ? tsPath : jsPath;

(async function main() {
  let cli;
  if (isDev) {
    const { createJiti } = await import('jiti');

    const jiti = await createJiti(import.meta.url);
    const devMode = await jiti.import('./dev.mjs');

    cli = await devMode.RunCli?.(tsPath);
  } else {
    const jsUrl = pathToFileURL(entryPath).href;
    cli = await import(jsUrl);
  }
  const program = cli.program || cli.default?.program;
  const runFn = cli.RunCli || cli.default?.RunCli;

  const rawArgs = process.argv.slice(2);
  const hasPositional = rawArgs.some((a) => !a.startsWith('-'));
  const hasFlag = rawArgs.some(
    (a) => a === '-h' || a === '--help' || a === '-V' || a === '--version',
  );

  if ((hasPositional || hasFlag) && program) {
    await program.parseAsync(process.argv);
  } else if (runFn) {
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
    await runFn();
  } else {
    console.error('Ошибка: Точка входа CLI не экспортирует RunCli или program.');
    process.exit(1);
  }
})();
