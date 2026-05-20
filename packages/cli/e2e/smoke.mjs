#!/usr/bin/env node
/* ============================================================================
 * packages/cli/e2e/smoke.mjs
 * ---------------------------------------------------------------------------
 * Self-contained E2E smoke test for @capsuletech/cli.
 *
 * Воспроизводит **prod-сценарий** первого внешнего пользователя:
 *   1. Пустая isolated среда (fixture + verdaccio storage очищены).
 *   2. Spawn Verdaccio на порту 4873 с isolated storage (./verdaccio-tmp/storage).
 *   3. release-local --group=all --tag=latest → publish'ит все @capsuletech/*.
 *   4. CAPSULE_CI=1 capsule create workspace → init fixture workspace.
 *   5. pnpm install (workspace).
 *   6. CAPSULE_CI=1 capsule create app e2e-app.
 *   7. pnpm install (app).
 *   8. pnpm dev в apps/e2e-app, ждём "Local: http://localhost:<port>".
 *   9. fetch / → HTTP 200 + #root div.
 *  10. Cleanup (kill child tree).
 *
 * Self-contained: НЕ требует running Verdaccio, НЕ требует pre-published
 * packages. Любые external Verdaccio на :4873 — конфликт, fail с понятным
 * error.
 *
 * Все spawn'д PID-ы tracked. cleanup-on-exit (exit/SIGINT/SIGTERM/uncaught)
 * убивает всё дерево через `taskkill /F /T /PID` (Windows) / `kill -9 -PID`
 * (POSIX). НЕ трогает user'ские node-процессы.
 *
 * Exit code: 0 если все шаги green, иначе non-zero.
 *
 * Запуск:
 *   pnpm test:e2e:cli
 *   node packages/cli/e2e/smoke.mjs
 * ==========================================================================*/
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..', '..');
const FIXTURE_DIR = join(__dirname, 'fixture');
const VERDACCIO_TMP_DIR = join(__dirname, 'verdaccio-tmp');
const VERDACCIO_CONFIG = join(__dirname, 'verdaccio-config.yml');
const CLI_BIN = join(REPO_ROOT, 'packages', 'cli', 'bin', 'capsule.mjs');
const RELEASE_LOCAL = join(REPO_ROOT, 'scripts', 'release-local.mjs');
const VERDACCIO_URL = 'http://localhost:4873';
const APP_NAME = 'e2e-app';
const VERDACCIO_WAIT_MS = 15_000;
const DEV_WAIT_MS = 30_000;
const CURL_TIMEOUT_MS = 5_000;
const SHELL = process.platform === 'win32';

const log = (m) => console.log(`\x1b[36m[smoke]\x1b[0m ${m}`);
const ok = (m) => console.log(`\x1b[32m[smoke] ✓\x1b[0m ${m}`);

// ---------------------------------------------------------------------------
// Child PID tracking — cleanup-on-exit убивает только тех кого мы spawn'или
// ---------------------------------------------------------------------------
const trackedPids = new Set();
const trackChild = (proc) => {
  if (proc.pid) trackedPids.add(proc.pid);
  proc.on('exit', () => proc.pid && trackedPids.delete(proc.pid));
  return proc;
};
const killPid = (pid) => {
  try {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/F', '/T', '/PID', String(pid)], { stdio: 'ignore', shell: true });
    } else {
      process.kill(-pid, 'SIGKILL');
    }
  } catch {
    // ignore — process may already be dead
  }
};
const cleanupAllChildren = () => {
  for (const pid of trackedPids) killPid(pid);
  trackedPids.clear();
};
process.on('exit', cleanupAllChildren);
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGBREAK']) {
  process.on(sig, () => {
    cleanupAllChildren();
    process.exit(130);
  });
}
process.on('uncaughtException', (e) => {
  console.error(e);
  cleanupAllChildren();
  process.exit(1);
});

const fail = (msg, ctx) => {
  console.error(`\x1b[31m[smoke] ✗\x1b[0m ${msg}`);
  if (ctx) console.error(ctx);
  cleanupAllChildren();
  process.exit(1);
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const runOnce = (cmd, args, { cwd, env } = {}) =>
  new Promise((resolveP) => {
    const p = trackChild(
      spawn(cmd, args, {
        cwd,
        env: { ...process.env, ...env },
        stdio: 'inherit',
        shell: SHELL,
      }),
    );
    p.on('close', (code) => resolveP(code ?? 1));
  });

const step = async (name, fn) => {
  log(`\n=== ${name} ===`);
  try {
    await fn();
    ok(name);
  } catch (e) {
    fail(`${name} failed: ${e.message ?? e}`, e);
  }
};

const cleanDirWithRetry = async (dir) => {
  if (!existsSync(dir)) return;
  for (let i = 1; i <= 5; i++) {
    try {
      rmSync(dir, { recursive: true, force: true });
      return;
    } catch (e) {
      if (e.code !== 'EPERM' && e.code !== 'EBUSY') throw e;
      await new Promise((r) => setTimeout(r, 500 * i));
    }
  }
  throw new Error(`could not remove ${dir} after 5 retries`);
};

const probeUrl = async (url) => {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(1500) });
    return r.status;
  } catch {
    return 0;
  }
};

// ---------------------------------------------------------------------------
// 0. Pre-flight: освободить :4873. Если занят — мог остаться stale Verdaccio от
//    предыдущего failed run. Detect owner, kill (только если verdaccio-tmp/ есть
//    — наш-fixture indicator), иначе fail with explicit message.
// ---------------------------------------------------------------------------
const killPortOwner = async (port) => {
  if (process.platform !== 'win32') {
    // POSIX: fuser -k или lsof -ti :port | xargs kill
    return new Promise((r) => {
      const p = spawn('sh', ['-c', `fuser -k -9 ${port}/tcp || true`], { stdio: 'ignore' });
      p.on('close', () => r());
    });
  }
  return new Promise((r) => {
    const p = spawn(
      'powershell',
      [
        '-Command',
        `$c = Get-NetTCPConnection -LocalPort ${port} -ErrorAction SilentlyContinue; if ($c) { $c | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue } }`,
      ],
      { stdio: 'ignore', shell: true },
    );
    p.on('close', () => r());
  });
};

await step('preflight (:4873 free)', async () => {
  const status = await probeUrl(VERDACCIO_URL);
  if (status === 0) return;
  // Port занят. Если у нас есть verdaccio-tmp/ — это stale fixture Verdaccio, kill.
  if (existsSync(VERDACCIO_TMP_DIR)) {
    log(`stale fixture Verdaccio detected on :4873 — killing`);
    await killPortOwner(4873);
    await new Promise((r) => setTimeout(r, 1500));
    const after = await probeUrl(VERDACCIO_URL);
    if (after !== 0) throw new Error(`could not free :4873 after kill (still ${after})`);
    return;
  }
  throw new Error(
    `port 4873 in use by external Verdaccio (no fixture state found). ` +
      `Kill your manual Verdaccio before running this fixture.`,
  );
});

// ---------------------------------------------------------------------------
// 1. Cleanup fixture/ и verdaccio-tmp/
// ---------------------------------------------------------------------------
await step('cleanup fixture/ + verdaccio-tmp/', async () => {
  await cleanDirWithRetry(FIXTURE_DIR);
  await cleanDirWithRetry(VERDACCIO_TMP_DIR);
  mkdirSync(FIXTURE_DIR, { recursive: true });
  mkdirSync(VERDACCIO_TMP_DIR, { recursive: true });
});

// ---------------------------------------------------------------------------
// 2. Spawn Verdaccio child с isolated storage
// ---------------------------------------------------------------------------
let verdaccioProc;
await step('spawn Verdaccio', async () => {
  // npx разрешает workspace, видит package conflicts (root vs dist/package.json
   // для каждого @capsuletech/*). Запускаем Verdaccio binary напрямую.
  const verdaccioBin = join(REPO_ROOT, 'node_modules', '.bin',
    process.platform === 'win32' ? 'verdaccio.cmd' : 'verdaccio');
  verdaccioProc = trackChild(
    spawn(verdaccioBin, ['--config', VERDACCIO_CONFIG, '--listen', '4873'], {
      cwd: __dirname,
      stdio: 'pipe',
      shell: SHELL,
    }),
  );
  verdaccioProc.stdout.on('data', (d) =>
    process.stdout.write(`\x1b[35m[verdaccio]\x1b[0m ${d.toString()}`),
  );
  verdaccioProc.stderr.on('data', (d) =>
    process.stderr.write(`\x1b[35m[verdaccio]\x1b[0m ${d.toString()}`),
  );
  const start = Date.now();
  while (Date.now() - start < VERDACCIO_WAIT_MS) {
    const status = await probeUrl(VERDACCIO_URL);
    if (status === 200) return;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Verdaccio not responding within ${VERDACCIO_WAIT_MS}ms`);
});

// ---------------------------------------------------------------------------
// 3. release-local --group=all --tag=latest
// ---------------------------------------------------------------------------
await step('release-local --group=all', async () => {
  const code = await runOnce('node', [RELEASE_LOCAL, '--group=all', '--tag=latest'], {
    cwd: REPO_ROOT,
    env: { NPM_REGISTRY_VERDACCIO: VERDACCIO_URL },
  });
  if (code !== 0) throw new Error(`release-local exited ${code}`);
});

// ---------------------------------------------------------------------------
// 4. capsule create workspace
// ---------------------------------------------------------------------------
await step('capsule create workspace', async () => {
  const code = await runOnce('node', [CLI_BIN, 'create', 'workspace'], {
    cwd: FIXTURE_DIR,
    env: { CAPSULE_CI: '1' },
  });
  if (code !== 0) throw new Error(`exit ${code}`);
  if (!existsSync(join(FIXTURE_DIR, 'package.json'))) throw new Error('workspace package.json missing');
});

// ---------------------------------------------------------------------------
// 5. capsule create app
// ---------------------------------------------------------------------------
await step(`capsule create app ${APP_NAME}`, async () => {
  const code = await runOnce('node', [CLI_BIN, 'create', 'app', APP_NAME], {
    cwd: FIXTURE_DIR,
    env: { CAPSULE_CI: '1' },
  });
  if (code !== 0) throw new Error(`exit ${code}`);
  if (!existsSync(join(FIXTURE_DIR, 'apps', APP_NAME))) throw new Error(`app dir missing`);
});

// ---------------------------------------------------------------------------
// 6. pnpm dev + curl
// ---------------------------------------------------------------------------
await step('pnpm dev + curl /', async () => {
  const appDir = join(FIXTURE_DIR, 'apps', APP_NAME);
  let port = null;
  let stdoutBuf = '';
  // biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI escape (\x1b) intentional
  const stripAnsi = (s) => s.replace(/\x1b\[[0-9;]*m/g, '');
  const devProc = trackChild(
    spawn('pnpm', ['dev'], {
      cwd: appDir,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: SHELL,
    }),
  );
  devProc.stdout.on('data', (d) => {
    const s = d.toString();
    stdoutBuf += s;
    process.stdout.write(`\x1b[90m[dev]\x1b[0m ${s}`);
    const m = stripAnsi(stdoutBuf).match(/Local:\s+http:\/\/localhost:(\d+)/);
    if (m && !port) port = m[1];
  });
  devProc.stderr.on('data', (d) =>
    process.stderr.write(`\x1b[33m[dev-err]\x1b[0m ${d.toString()}`),
  );

  const start = Date.now();
  while (!port && Date.now() - start < DEV_WAIT_MS) {
    await new Promise((r) => setTimeout(r, 500));
  }
  if (!port) throw new Error(`dev server didn't log "Local: http://localhost:" within ${DEV_WAIT_MS}ms`);

  await new Promise((r) => setTimeout(r, 2000));
  const res = await fetch(`http://localhost:${port}/`, {
    signal: AbortSignal.timeout(CURL_TIMEOUT_MS),
  }).catch((e) => ({ error: e.message }));

  if (devProc.pid) killPid(devProc.pid);
  await new Promise((r) => setTimeout(r, 1000));

  if (res.error) throw new Error(`fetch failed: ${res.error}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = await res.text();
  if (!body.includes('id="root"')) throw new Error('response missing #root div');
});

// ---------------------------------------------------------------------------
// All green
// ---------------------------------------------------------------------------
log('\nAll smoke steps passed.');
cleanupAllChildren();
// Wait for kill commands to actually terminate before exit
await new Promise((r) => setTimeout(r, 1500));
process.exit(0);
