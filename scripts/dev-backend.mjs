#!/usr/bin/env node
/* ============================================================================
 * scripts/dev-backend.mjs
 * ---------------------------------------------------------------------------
 * PURPOSE
 *   Запуск Rust-бэка capsule-server из корня workspace. Cross-platform обёртка
 *   над `cargo run -p capsule-server`, ставит env-переменные и cwd.
 *
 * USAGE
 *   pnpm dev:backend
 *
 * ENV
 *   CAPSULE_WORKSPACE_ROOT — выставляется автоматически в process.cwd()
 *   CAPSULE_WRITE_SCOPE    — куда бэку разрешено писать (default 'apps/agent')
 *
 * WHY NOT INLINE COMMAND
 *   На Windows cmd/pnpm не пробрасывают $PWD корректно в подкоманду PowerShell,
 *   а одиночные кавычки в JSON ломают подстановку. Node-обёртка снимает
 *   весь quoting-hell.
 * ==========================================================================*/

import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const workspaceRoot = resolve(process.cwd());

process.env.CAPSULE_WORKSPACE_ROOT = workspaceRoot;
process.env.CAPSULE_WRITE_SCOPE ??= 'apps/agent';

console.log(`[dev-backend] workspace: ${workspaceRoot}`);
console.log(`[dev-backend] write scope: ${process.env.CAPSULE_WRITE_SCOPE}`);

const child = spawn('cargo', ['run', '-p', 'capsule-server'], {
  cwd: resolve(workspaceRoot, 'backend'),
  stdio: 'inherit',
  shell: true,
  env: process.env,
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
