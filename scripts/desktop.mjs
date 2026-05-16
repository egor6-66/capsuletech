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
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
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
  console.error('    --url=<url>     dev: url Vite-сервера (default http://localhost:5173)');
  console.error('    --dist=<path>   build: путь до собранного фронта (default apps/<app>/dist)');
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
const productName = appPkg.capsule?.productName ?? app.replace(/(^|-)(\w)/g, (_, __, c) => c.toUpperCase());
const identifier = appPkg.capsule?.identifier ?? `tech.capsule.${app.replace(/[^a-z0-9]/gi, '').toLowerCase()}`;

// ─── build override config ───────────────────────────────────────────────────

const desktopDir = resolve(workspaceRoot, 'backend', 'desktop');
const overridePath = join(desktopDir, `.tauri.${app}.json`);

const baseOverride = {
  productName,
  identifier,
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

mkdirSync(desktopDir, { recursive: true });
writeFileSync(overridePath, JSON.stringify(baseOverride, null, 2));

// ─── invoke tauri ────────────────────────────────────────────────────────────

const tauriArgs = [action === 'dev' ? 'dev' : 'build', '--config', overridePath];

console.log(`[desktop] tauri ${tauriArgs.join(' ')}`);
console.log(`[desktop] productName=${productName} identifier=${identifier}`);

const child = spawn('pnpm', ['exec', 'tauri', ...tauriArgs], {
  cwd: desktopDir,
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, CAPSULE_APP: app, CAPSULE_WORKSPACE_ROOT: workspaceRoot },
});

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});

const forward = (sig) => () => {
  if (!child.killed) child.kill(sig);
};
process.on('SIGINT', forward('SIGINT'));
process.on('SIGTERM', forward('SIGTERM'));
