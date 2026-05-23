import { EventEmitter } from 'node:events';
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Mock node:child_process ─────────────────────────────────────────────────
// Must be hoisted before any import that uses child_process.
vi.mock('node:child_process', () => {
  return {
    spawn: vi.fn(),
  };
});

// ─── Mock node:fs ─────────────────────────────────────────────────────────────
// We intercept writeFileSync/unlinkSync/existsSync/mkdirSync to avoid real I/O.
// We track calls rather than stubbing with no-ops so assertions remain precise.
vi.mock('node:fs', () => {
  return {
    existsSync: vi.fn(),
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
    unlinkSync: vi.fn(),
  };
});

import { spawn } from 'node:child_process';
import { runBuild, runDev } from '../runner';
import type { IDesktopConfig } from '../types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Creates a mock ChildProcess EventEmitter with a kill spy. */
function mockChild() {
  const child = new EventEmitter() as ReturnType<typeof spawn>;
  (child as unknown as { killed: boolean }).killed = false;
  child.kill = vi.fn(() => {
    (child as unknown as { killed: boolean }).killed = true;
    return true;
  }) as unknown as typeof child.kill;
  return child;
}

const baseDesktop: IDesktopConfig = {
  productName: 'TestApp',
  identifier: 'tech.capsule.testapp',
};

/** A fake workspace root whose native/ we fake-exist. */
const fakeWorkspaceRoot = '/fake/workspace';
const fakeNativeDir = resolve(fakeWorkspaceRoot, 'packages', 'desktop', 'native');

// ─── Setup / teardown ────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();

  // existsSync: native dir exists by default; override file does not yet
  (existsSync as ReturnType<typeof vi.fn>).mockImplementation((p: unknown) => {
    if (typeof p === 'string' && p === fakeNativeDir) return true;
    return false;
  });
});

afterEach(() => {
  // Remove any stray process listeners added by runner
  process.removeAllListeners('SIGINT');
  process.removeAllListeners('SIGTERM');
  process.removeAllListeners('exit');
  process.removeAllListeners('uncaughtException');
});

// ─── runDev ───────────────────────────────────────────────────────────────────

describe('runDev — spawn args', () => {
  it('spawns pnpm exec tauri dev with --config <overridePath>', async () => {
    const child = mockChild();
    (spawn as ReturnType<typeof vi.fn>).mockReturnValue(child);

    const promise = runDev({
      app: 'sandbox',
      devUrl: 'http://localhost:3000',
      desktop: baseDesktop,
      cwd: fakeWorkspaceRoot,
    });

    // Emit exit(0) to resolve the promise
    child.emit('exit', 0, null);
    await promise;

    expect(spawn).toHaveBeenCalledOnce();
    const [cmd, args, opts] = (spawn as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      string[],
      Record<string, unknown>,
    ];

    expect(cmd).toBe('pnpm');
    expect(args[0]).toBe('exec');
    expect(args[1]).toBe('tauri');
    expect(args[2]).toBe('dev');
    expect(args[3]).toBe('--config');
    // args[4] is the override path — ends with .tauri.sandbox.json
    expect(args[4]).toMatch(/\.tauri\.sandbox\.json$/);
    // No explicit bundles for dev
    expect(args).toHaveLength(5);

    expect(opts.shell).toBe(true);
    expect(opts.stdio).toBe('inherit');
  });

  it('sets cwd to packages/desktop/native/', async () => {
    const child = mockChild();
    (spawn as ReturnType<typeof vi.fn>).mockReturnValue(child);

    const promise = runDev({
      app: 'sandbox',
      devUrl: 'http://localhost:3000',
      desktop: baseDesktop,
      cwd: fakeWorkspaceRoot,
    });
    child.emit('exit', 0, null);
    await promise;

    const [, , opts] = (spawn as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      string[],
      Record<string, unknown>,
    ];
    expect(opts.cwd).toBe(fakeNativeDir);
  });

  it('passes CAPSULE_APP and CAPSULE_WORKSPACE_ROOT in env', async () => {
    const child = mockChild();
    (spawn as ReturnType<typeof vi.fn>).mockReturnValue(child);

    const promise = runDev({
      app: 'sandbox',
      devUrl: 'http://localhost:3000',
      desktop: baseDesktop,
      cwd: fakeWorkspaceRoot,
    });
    child.emit('exit', 0, null);
    await promise;

    const [, , opts] = (spawn as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      string[],
      Record<string, unknown>,
    ];
    const env = opts.env as Record<string, string>;
    expect(env.CAPSULE_APP).toBe('sandbox');
    expect(env.CAPSULE_WORKSPACE_ROOT).toBe(fakeWorkspaceRoot);
  });

  it('writes override file before spawn', async () => {
    const child = mockChild();
    (spawn as ReturnType<typeof vi.fn>).mockReturnValue(child);

    const promise = runDev({
      app: 'sandbox',
      devUrl: 'http://localhost:3000',
      desktop: baseDesktop,
      cwd: fakeWorkspaceRoot,
    });
    child.emit('exit', 0, null);
    await promise;

    // writeFileSync must have been called before spawn
    const writeOrder = (writeFileSync as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0];
    const spawnOrder = (spawn as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0];
    expect(writeOrder).toBeLessThan(spawnOrder);
  });

  it('deletes override file after child exits with code 0', async () => {
    const child = mockChild();
    (spawn as ReturnType<typeof vi.fn>).mockReturnValue(child);

    // Simulate override file exists for cleanup check
    (existsSync as ReturnType<typeof vi.fn>).mockImplementation((p: unknown) => {
      if (typeof p === 'string' && p === fakeNativeDir) return true;
      if (typeof p === 'string' && p.endsWith('.tauri.sandbox.json')) return true;
      return false;
    });

    const promise = runDev({
      app: 'sandbox',
      devUrl: 'http://localhost:3000',
      desktop: baseDesktop,
      cwd: fakeWorkspaceRoot,
    });
    child.emit('exit', 0, null);
    await promise;

    expect(unlinkSync).toHaveBeenCalledOnce();
    const unlinkedPath = (unlinkSync as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(unlinkedPath).toMatch(/\.tauri\.sandbox\.json$/);
  });

  it('rejects on non-zero exit code', async () => {
    const child = mockChild();
    (spawn as ReturnType<typeof vi.fn>).mockReturnValue(child);

    const promise = runDev({
      app: 'sandbox',
      devUrl: 'http://localhost:3000',
      desktop: baseDesktop,
      cwd: fakeWorkspaceRoot,
    });
    child.emit('exit', 1, null);

    await expect(promise).rejects.toThrow('tauri dev exited with code 1');
  });
});

describe('runDev — cleanup idempotency', () => {
  it('calls unlinkSync only once even if exit fires twice (idempotency)', async () => {
    const child = mockChild();
    (spawn as ReturnType<typeof vi.fn>).mockReturnValue(child);

    (existsSync as ReturnType<typeof vi.fn>).mockImplementation((p: unknown) => {
      if (typeof p === 'string' && p === fakeNativeDir) return true;
      if (typeof p === 'string' && p.endsWith('.tauri.sandbox.json')) return true;
      return false;
    });

    const promise = runDev({
      app: 'sandbox',
      devUrl: 'http://localhost:3000',
      desktop: baseDesktop,
      cwd: fakeWorkspaceRoot,
    });

    // Fire exit twice (simulates process.exit hook also firing)
    child.emit('exit', 0, null);
    child.emit('exit', 0, null);

    await promise;

    // Cleanup must have been called exactly once despite double exit
    expect(unlinkSync).toHaveBeenCalledOnce();
  });
});

describe('runDev — missing native dir', () => {
  it('throws if packages/desktop/native/ does not exist', async () => {
    (existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);

    await expect(
      runDev({
        app: 'sandbox',
        devUrl: 'http://localhost:3000',
        desktop: baseDesktop,
        cwd: fakeWorkspaceRoot,
      }),
    ).rejects.toThrow('packages/desktop/native/ not found');
  });
});

// ─── runBuild ─────────────────────────────────────────────────────────────────

describe('runBuild — spawn args', () => {
  it('spawns pnpm exec tauri build with --config <overridePath>', async () => {
    const child = mockChild();
    (spawn as ReturnType<typeof vi.fn>).mockReturnValue(child);

    const savedPlatform = Object.getOwnPropertyDescriptor(process, 'platform');

    // Temporarily set platform to non-win32 to avoid --bundles flag
    Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });

    const promise = runBuild({
      app: 'sandbox',
      dist: '/abs/path/dist',
      desktop: baseDesktop,
      version: '1.0.0',
      cwd: fakeWorkspaceRoot,
    });
    child.emit('exit', 0, null);
    await promise;

    // Restore platform
    if (savedPlatform) Object.defineProperty(process, 'platform', savedPlatform);

    const [cmd, args] = (spawn as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      string[],
    ];
    expect(cmd).toBe('pnpm');
    expect(args[2]).toBe('build');
    expect(args[3]).toBe('--config');
    expect(args[4]).toMatch(/\.tauri\.sandbox\.json$/);
    expect(args).toHaveLength(5); // no --bundles on linux
  });

  it('adds --bundles msi,nsis on Windows in build mode', async () => {
    const child = mockChild();
    (spawn as ReturnType<typeof vi.fn>).mockReturnValue(child);

    const savedPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
    Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });

    const promise = runBuild({
      app: 'sandbox',
      dist: 'C:\\dist',
      desktop: baseDesktop,
      version: '1.0.0',
      cwd: fakeWorkspaceRoot,
    });
    child.emit('exit', 0, null);
    await promise;

    if (savedPlatform) Object.defineProperty(process, 'platform', savedPlatform);

    const [, args] = (spawn as ReturnType<typeof vi.fn>).mock.calls[0] as [string, string[]];
    expect(args).toContain('--bundles');
    expect(args).toContain('msi,nsis');
  });

  it('does NOT add --bundles in dev mode on Windows', async () => {
    const child = mockChild();
    (spawn as ReturnType<typeof vi.fn>).mockReturnValue(child);

    const savedPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
    Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });

    const promise = runDev({
      app: 'sandbox',
      devUrl: 'http://localhost:3000',
      desktop: baseDesktop,
      cwd: fakeWorkspaceRoot,
    });
    child.emit('exit', 0, null);
    await promise;

    if (savedPlatform) Object.defineProperty(process, 'platform', savedPlatform);

    const [, args] = (spawn as ReturnType<typeof vi.fn>).mock.calls[0] as [string, string[]];
    expect(args).not.toContain('--bundles');
  });
});
