#!/usr/bin/env node
/* ============================================================================
 * scripts/desktop.mjs
 * ---------------------------------------------------------------------------
 * PURPOSE
 *   Запуск любой apps/<app> внутри Tauri-shell (backend/desktop/) без правки
 *   самой апп. Делает override `tauri.conf.json` на лету и зовёт tauri CLI.
 *
 * USAGE
 *   node scripts/desktop.mjs dev   <app>   [--url=http://localhost:5173]
 *   node scripts/desktop.mjs build <app>   [--dist=apps/<app>/dist]
 *
 *   pnpm desktop       <app>   # alias on `dev`
 *   pnpm desktop:build <app>
 *
 * CONTRACT (намеренно простой — один процесс = одна ответственность)
 *   dev:   юзер уже запустил `cd apps/<app> && pnpm dev` (Vite на --url).
 *          Скрипт цепляет Tauri к этому URL.
 *   build: юзер уже собрал апп (`pnpm build`) и dist лежит в apps/<app>/dist.
 *          Скрипт скармливает dist в `tauri build`.
 *
 *   В будущем CLI получит `capsule desktop dev <app>` с оркестрацией Vite+Tauri.
 * ==========================================================================*/

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const workspaceRoot = resolve(__dirname, '..');

// ─── args ────────────────────────────────────────────────────────────────────

const [, , rawAction, rawApp, ...rest] = process.argv;
const action = rawAction;
const app = rawApp;

if (!['dev', 'build'].includes(action) || !app) {
  console.error('Usage: node scripts/desktop.mjs <dev|build> <app> [flags]');
  console.error('  flags:');
  console.error('    --url=<url>      dev: url Vite-сервера (default http://localhost:5173)');
  console.error('    --dist=<path>    build: путь до собранного фронта (default apps/<app>/dist)');
  console.error('    --version=<sem>  build: версия (default apps/<app>/package.json:version)');
  process.exit(1);
}

const flags = Object.fromEntries(
  rest
    .filter((f) => f.startsWith('--'))
    .map((f) => {
      const [k, ...v] = f.slice(2).split('=');
      return [k, v.join('=') || true];
    }),
);

// ─── resolve app ─────────────────────────────────────────────────────────────

const appDir = resolve(workspaceRoot, 'apps', app);
const appPkgPath = join(appDir, 'package.json');

if (!existsSync(appPkgPath)) {
  console.error(`[desktop] apps/${app}/package.json не найден`);
  process.exit(1);
}

const appPkg = JSON.parse(readFileSync(appPkgPath, 'utf8'));
const pkgName = appPkg.name ?? `@capsuletech/${app}`;
const productName =
  appPkg.capsule?.productName ?? app.replace(/(^|-)(\w)/g, (_, __, c) => c.toUpperCase());
const identifier =
  appPkg.capsule?.identifier ?? `tech.capsule.${app.replace(/[^a-z0-9]/gi, '').toLowerCase()}`;

// ─── build override config ───────────────────────────────────────────────────

const desktopDir = resolve(workspaceRoot, 'backend', 'desktop');
const overridePath = join(desktopDir, `.tauri.${app}.json`);

const version = flags.version ?? process.env.CAPSULE_VERSION ?? appPkg.version ?? '0.0.0';

const baseOverride = {
  productName,
  identifier,
  version,
  app: {
    windows: [{ label: 'main', title: productName }],
  },
};

if (action === 'dev') {
  const devUrl = flags.url ?? 'http://localhost:5173';
  baseOverride.build = { devUrl, beforeDevCommand: '', beforeBuildCommand: '' };
  console.log(`[desktop] dev: app=${app} url=${devUrl}`);
  console.log(`[desktop] tip: убедись что Vite поднят (cd apps/${app} && pnpm dev)`);
} else {
  const distRel = flags.dist ?? `apps/${app}/dist`;
  const distAbs = resolve(workspaceRoot, distRel);
  if (!existsSync(distAbs)) {
    console.error(`[desktop] dist не найден: ${distAbs}`);
    console.error(`[desktop] сначала собери: cd apps/${app} && pnpm build`);
    process.exit(1);
  }
  baseOverride.build = {
    frontendDist: distAbs.replace(/\\/g, '/'),
    beforeBuildCommand: '',
    beforeDevCommand: '',
  };
  baseOverride.bundle = { active: true };
  console.log(`[desktop] build: app=${app} dist=${distAbs}`);
}

// ─── bundle targets ──────────────────────────────────────────────────────────
// На Windows-runner'е форсим msi+nsis явно через CLI-флаг, не полагаясь
// только на merge с `bundle.targets: "all"` в base config'е — у tauri 2.x
// `--config <file>` иногда лотерея с merge'ом и тогда `bundle.active` из
// override не подхватывается, build выходит 0, но `target/release/bundle/`
// пустой. CLI-флаг — детерминирован.
const explicitBundles =
  action === 'build' && process.platform === 'win32' ? ['--bundles', 'msi,nsis'] : [];

mkdirSync(desktopDir, { recursive: true });
writeFileSync(overridePath, JSON.stringify(baseOverride, null, 2));

// ─── cleanup handler ─────────────────────────────────────────────────────────
// Override-файл нужен только пока tauri-процесс жив — после exit он бесполезен,
// а оставаясь на диске мешает (мусор в git status, путаница если кто-то правит
// его руками не подозревая что он temp). Снимаем на любом пути выхода:
//   - нормальный exit child'а;
//   - наш SIGINT/SIGTERM (Ctrl-C);
//   - uncaughtException;
//   - `process.exit` от других путей (fallback через 'exit' hook).
// Идемпотентно: existsSync-проверка + try/catch если файл уже снят.

let cleanedUp = false;
const cleanupOverride = () => {
  if (cleanedUp) return;
  cleanedUp = true;
  if (!existsSync(overridePath)) return;
  try {
    unlinkSync(overridePath);
  } catch (err) {
    console.warn(`[desktop] failed to remove ${overridePath}:`, err);
  }
};

// ─── invoke tauri ────────────────────────────────────────────────────────────

const tauriArgs = [
  action === 'dev' ? 'dev' : 'build',
  '--config',
  overridePath,
  ...explicitBundles,
];

console.log(`[desktop] tauri ${tauriArgs.join(' ')}`);
console.log(`[desktop] productName=${productName} identifier=${identifier}`);

const child = spawn('pnpm', ['exec', 'tauri', ...tauriArgs], {
  cwd: desktopDir,
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, CAPSULE_APP: app, CAPSULE_WORKSPACE_ROOT: workspaceRoot },
});

child.on('exit', (code, signal) => {
  cleanupOverride();
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});

const forward = (sig) => () => {
  cleanupOverride();
  if (!child.killed) child.kill(sig);
};
process.on('SIGINT', forward('SIGINT'));
process.on('SIGTERM', forward('SIGTERM'));
process.on('exit', cleanupOverride);
process.on('uncaughtException', (err) => {
  cleanupOverride();
  console.error('[desktop] uncaught:', err);
  process.exit(1);
});
