import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { buildOverride } from './override';
import type { RunBuildOptions, RunDevOptions } from './types';

/**
 * Resolves the path to packages/desktop/native/ relative to the workspace root.
 * Throws with a clear message if the directory does not exist (Rust crate missing).
 */
function resolveNativeDir(cwd: string): string {
  const nativeDir = resolve(cwd, 'packages', 'desktop', 'native');
  if (!existsSync(nativeDir)) {
    throw new Error(
      `[desktop] packages/desktop/native/ not found at: ${nativeDir}\n` +
        'Ensure the Rust crate is present (PR 2 — native/ migration).',
    );
  }
  return nativeDir;
}

/**
 * Core orchestration logic shared by runDev and runBuild.
 * Writes the override JSON, spawns `pnpm exec tauri <action>`, and
 * cleans up the override file on any process exit path.
 */
async function runTauri(
  kind: 'dev' | 'build',
  app: string,
  cwd: string,
  overrideData: Record<string, unknown>,
): Promise<void> {
  const nativeDir = resolveNativeDir(cwd);
  const overridePath = join(nativeDir, `.tauri.${app}.json`);

  mkdirSync(nativeDir, { recursive: true });
  writeFileSync(overridePath, JSON.stringify(overrideData, null, 2));

  // ─── Idempotent cleanup (grabla #1) ─────────────────────────────────────────
  // Override file is only needed while tauri process is alive.
  // Multiple exit paths (SIGINT / SIGTERM / uncaughtException / exit) all
  // converge here — must be idempotent to avoid double-unlink throws.
  let cleanedUp = false;
  const cleanupOverride = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    if (!existsSync(overridePath)) return;
    try {
      unlinkSync(overridePath);
    } catch (err) {
      console.warn(`[desktop] failed to remove override ${overridePath}:`, err);
    }
  };

  // ─── Windows bundles (grabla #2) ────────────────────────────────────────────
  // On Windows runner, tauri 2.x --config merge with bundle.targets:"all" is
  // non-deterministic — build exits 0 but target/release/bundle/ is empty.
  // Explicit --bundles CLI flag is deterministic.
  const explicitBundles: string[] =
    kind === 'build' && process.platform === 'win32' ? ['--bundles', 'msi,nsis'] : [];

  // ─── Spawn tauri CLI (grably #3 shell:true, #4 cwd nativeDir, #5 env vars) ──
  const child = spawn(
    'pnpm',
    ['exec', 'tauri', kind === 'dev' ? 'dev' : 'build', '--config', overridePath, ...explicitBundles],
    {
      cwd: nativeDir, // grabla #4 — tauri looks for tauri.conf.json relative to cwd
      stdio: 'inherit',
      shell: true, // grabla #3 — required on Windows for pnpm via PATH
      env: {
        ...process.env,
        CAPSULE_APP: app, // grabla #5 — preserve env vars for child process
        CAPSULE_WORKSPACE_ROOT: cwd,
      },
    },
  );

  return new Promise<void>((resolve, reject) => {
    child.on('exit', (code, signal) => {
      cleanupOverride();
      if (signal) {
        // Re-forward the signal to parent process
        process.kill(process.pid, signal);
        return;
      }
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`[desktop] tauri ${kind} exited with code ${code ?? 'null'}`));
      }
    });

    // Forward SIGINT/SIGTERM to child and cleanup override
    const forward = (sig: NodeJS.Signals) => () => {
      cleanupOverride();
      if (!child.killed) child.kill(sig);
    };
    process.once('SIGINT', forward('SIGINT'));
    process.once('SIGTERM', forward('SIGTERM'));

    // Fallback cleanup on process.exit (e.g. from uncaughtException paths)
    process.once('exit', cleanupOverride);
    process.once('uncaughtException', (err) => {
      cleanupOverride();
      console.error('[desktop] uncaught exception:', err);
      process.exit(1);
    });
  });
}

/**
 * Start Tauri in dev mode against an already-running Vite dev server.
 * The caller is responsible for starting the Vite server and passing its URL.
 *
 * @param opts.app       - App name (used for per-app override filename)
 * @param opts.devUrl    - URL of the running Vite dev server
 * @param opts.desktop   - Tauri window/bundle configuration
 * @param opts.cwd       - Workspace root (defaults to process.cwd())
 */
export async function runDev(opts: RunDevOptions): Promise<void> {
  const cwd = opts.cwd ?? process.cwd();
  const overrideData = buildOverride({
    kind: 'dev',
    app: opts.app,
    devUrl: opts.devUrl,
    desktop: opts.desktop,
    version: '0.0.0', // version not meaningful for dev mode
  });
  return runTauri('dev', opts.app, cwd, overrideData);
}

/**
 * Build Tauri binary against an already-built frontend dist.
 * The caller is responsible for building the frontend and passing the dist path.
 *
 * @param opts.app       - App name (used for per-app override filename)
 * @param opts.dist      - Absolute path to the built frontend dist directory
 * @param opts.desktop   - Tauri window/bundle configuration
 * @param opts.version   - Bundle version (semver)
 * @param opts.cwd       - Workspace root (defaults to process.cwd())
 */
export async function runBuild(opts: RunBuildOptions): Promise<void> {
  const cwd = opts.cwd ?? process.cwd();
  const overrideData = buildOverride({
    kind: 'build',
    app: opts.app,
    dist: opts.dist,
    desktop: opts.desktop,
    version: opts.version,
  });
  return runTauri('build', opts.app, cwd, overrideData);
}
