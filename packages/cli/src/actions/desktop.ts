import { join } from 'node:path';
import { runDev, runBuild } from '@capsuletech/desktop';
import type { ICapsuleConfig } from '@capsuletech/vite-builder';
import type { CommandAction } from '../commands/types';
import { kit } from '../kit';
import { importModule } from '../utils/cvd';

interface IAppPackageJson {
  version?: string;
  [key: string]: unknown;
}

/**
 * Reads apps/<name>/capsule.config.ts and validates that the desktop section
 * is present. Returns null and logs a clear error if the section is absent —
 * caller must early-return on null.
 *
 * NOTE: importModule uses a jiti-cache per-cwd (grabla #3 in docs/_meta/cli.md).
 */
const loadDesktopConfig = async (
  workspaceRoot: string,
  appName: string,
): Promise<ICapsuleConfig | null> => {
  const configPath = join(workspaceRoot, 'apps', appName, 'capsule.config.ts');
  let mod: { default?: ICapsuleConfig } | ICapsuleConfig;
  try {
    mod = await importModule<{ default?: ICapsuleConfig } | ICapsuleConfig>(
      configPath,
      workspaceRoot,
    );
  } catch (err) {
    kit.log.error(`Не удалось загрузить ${configPath}: ${(err as Error).message}`);
    return null;
  }
  const config = (
    mod != null && typeof mod === 'object' && 'default' in mod && mod.default
      ? mod.default
      : mod
  ) as ICapsuleConfig;
  if (!config.desktop) {
    kit.log.error(
      `apps/${appName}/capsule.config.ts — отсутствует секция 'desktop'. См. ADR 017 (docs/01-architecture/adr/017-desktop-package.md).`,
    );
    return null;
  }
  return config;
};

/**
 * Narrows ctx to the shape required by desktop actions: type 'app' with name
 * and root (workspace root) defined. Logs an error and returns false otherwise.
 *
 * Note: for ctx.type === 'app', ctx.root is the workspace root (not the app
 * dir). See context/detect.ts — { type: 'app', name, root: workspaceRoot }.
 */
const requireAppCtx = (
  ctx: Parameters<CommandAction>[0],
): ctx is Parameters<CommandAction>[0] & { name: string; root: string } => {
  if (ctx.type !== 'app' || !ctx.name || !ctx.root) {
    kit.log.error('Desktop-команды запускаются только внутри apps/<name>/');
    return false;
  }
  return true;
};

/**
 * `capsule desktop dev` — запускает Tauri в dev-режиме поверх уже запущенного
 * Vite dev-сервера. Команда блокирует до завершения tauri-процесса.
 *
 * Параметры (опциональные, есть дефолты):
 *   --url  URL dev-сервера (дефолт: http://localhost:<devServerPort ?? 3000>)
 */
export const desktopDev: CommandAction = async (ctx, params) => {
  if (!requireAppCtx(ctx)) return;
  const config = await loadDesktopConfig(ctx.root, ctx.name);
  if (!config) return;

  const devUrl =
    (typeof params.url === 'string' && params.url) ||
    `http://localhost:${config.devServerPort ?? 3000}`;

  await runDev({
    app: ctx.name,
    devUrl,
    desktop: config.desktop!,
    cwd: ctx.root,
  });
};

/**
 * `capsule desktop build` — собирает Tauri-бандл (MSI/NSIS) поверх уже
 * собранного frontend dist. Команда блокирует до завершения tauri-процесса.
 *
 * Параметры (опциональные, есть дефолты):
 *   --version  Версия бандла (дефолт: apps/<name>/package.json:version ?? '0.0.0')
 *   --dist     Путь к dist относительно workspace root (дефолт: apps/<name>/dist)
 */
export const desktopBuild: CommandAction = async (ctx, params) => {
  if (!requireAppCtx(ctx)) return;
  const config = await loadDesktopConfig(ctx.root, ctx.name);
  if (!config) return;

  // version: --version param → apps/<name>/package.json:version → '0.0.0'
  let version: string;
  if (typeof params.version === 'string' && params.version) {
    version = params.version;
  } else {
    try {
      const pkg = await importModule<IAppPackageJson | { default?: IAppPackageJson }>(
        join(ctx.root, 'apps', ctx.name, 'package.json'),
        ctx.root,
      );
      const pkgData = (
        pkg != null && typeof pkg === 'object' && 'default' in pkg && pkg.default
          ? pkg.default
          : pkg
      ) as IAppPackageJson;
      version = pkgData.version ?? '0.0.0';
    } catch {
      version = '0.0.0';
    }
  }

  // dist: --dist param (relative to workspaceRoot) → apps/<name>/dist (default)
  const dist =
    typeof params.dist === 'string' && params.dist
      ? join(ctx.root, params.dist)
      : join(ctx.root, 'apps', ctx.name, 'dist');

  await runBuild({
    app: ctx.name,
    dist,
    desktop: config.desktop!,
    version,
    cwd: ctx.root,
  });
};
