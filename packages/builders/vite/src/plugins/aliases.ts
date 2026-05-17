import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path, { basename, join } from 'node:path';
import type { Plugin } from 'vite';

interface IProps {
  appRoot: string;
  workspaceRoot: string;
}

/**
 * Единый плагин для path-aliases.
 *
 * Источник правды — два файла:
 *   - `<workspace>/tsconfig.base.json`  — общие пути `@capsuletech/*`
 *   - `<app>/.capsule/paths.config.json` — локальные `@pages/*`, `@widgets/*`, …
 *
 * Что делает на старте Vite:
 *   1. Регистрирует Vite `resolve.alias` для всех ключей из `paths.config.json`
 *      (с поддержкой `/*` шаблонов через regex). `@capsuletech/*` уже резолвится
 *      внешним `vite-tsconfig-paths`, дублировать не нужно.
 *   2. Пишет `<app>/.capsule/tsconfig.paths.json` со слитыми paths
 *      (base'овые + локальные, последние пере-проецированы относительно
 *      workspace-root). Apps'овый `tsconfig.json` делает
 *      `extends: [base, .capsule/tsconfig.paths.json]` — TypeScript
 *      multi-extends: paths из второго файла доминируют, но поскольку там
 *      ВСЕ нужные пути, base'овые не теряются.
 *
 * Зачем именно так: TypeScript не мержит `paths` через `extends` — child paths
 * полностью замещают parent paths. Если объявить `@pages/*` в app, base'овые
 * `@capsuletech/*` исчезают. Этот плагин обходит ограничение генерируя файл со
 * всем сразу.
 */
export const AliasesPlugin = ({ appRoot, workspaceRoot }: IProps): Plugin => ({
  name: 'capsule-aliases',
  enforce: 'pre',
  async config() {
    const appName = basename(appRoot);
    const baseConfigPath = join(workspaceRoot, 'tsconfig.base.json');
    const localPathsConfigPath = join(appRoot, '.capsule', 'paths.config.json');
    const outPath = join(appRoot, '.capsule', 'tsconfig.paths.json');

    const basePaths = await readBasePaths(baseConfigPath);
    const localRaw = await readLocalRaw(localPathsConfigPath);
    const localPathsForTs = projectLocalToWorkspace(localRaw, appName);

    // (1) TypeScript: write merged paths file
    const merged = { ...basePaths, ...localPathsForTs };
    const tsPathsOutput = {
      compilerOptions: {
        baseUrl: '../../../',
        paths: merged,
      },
    };
    await mkdir(join(appRoot, '.capsule'), { recursive: true });
    await writeFile(outPath, `${JSON.stringify(tsPathsOutput, null, 2)}\n`, 'utf-8');

    // (2) Vite: build resolve.alias entries from local-only paths
    //     (@capsuletech/* are handled by vite-tsconfig-paths plugin)
    const viteAliases = buildViteAliases(localRaw, appRoot);
    return {
      resolve: {
        alias: viteAliases,
      },
    };
  },
});

async function readBasePaths(baseConfigPath: string): Promise<Record<string, string[]>> {
  if (!existsSync(baseConfigPath)) return {};
  try {
    const raw = await readFile(baseConfigPath, 'utf-8');
    const json = JSON.parse(stripJsonComments(raw));
    return (json?.compilerOptions?.paths ?? {}) as Record<string, string[]>;
  } catch (err) {
    console.warn(`[capsule-aliases] failed to read ${baseConfigPath}:`, err);
    return {};
  }
}

async function readLocalRaw(localPathsConfigPath: string): Promise<Record<string, string[]>> {
  if (!existsSync(localPathsConfigPath)) return {};
  try {
    const raw = await readFile(localPathsConfigPath, 'utf-8');
    const json = JSON.parse(stripJsonComments(raw));
    const out: Record<string, string[]> = {};
    for (const [key, value] of Object.entries(json)) {
      out[key] = Array.isArray(value) ? (value as string[]) : [value as string];
    }
    return out;
  } catch (err) {
    console.warn(`[capsule-aliases] failed to read ${localPathsConfigPath}:`, err);
    return {};
  }
}

function projectLocalToWorkspace(
  local: Record<string, string[]>,
  appName: string,
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [key, arr] of Object.entries(local)) {
    out[key] = arr.map((v) => `apps/${appName}/${v}`.replace(/\\/g, '/'));
  }
  return out;
}

interface ViteAliasEntry {
  find: string | RegExp;
  replacement: string;
}

function buildViteAliases(local: Record<string, string[]>, appRoot: string): ViteAliasEntry[] {
  const aliases: ViteAliasEntry[] = [];
  for (const [key, arr] of Object.entries(local)) {
    const target = arr[0];
    if (!target) continue;
    if (key.endsWith('/*') && target.endsWith('/*')) {
      const cleanKey = key.slice(0, -2);
      const cleanPath = target.slice(0, -2);
      aliases.push({
        find: new RegExp(`^${escapeRegex(cleanKey)}/(.*)`),
        replacement: path.resolve(appRoot, `${cleanPath}/$1`),
      });
    } else {
      aliases.push({
        find: key,
        replacement: path.resolve(appRoot, target),
      });
    }
  }
  return aliases;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// tsconfig.base.json is allowed to have // and /* */ comments; strip them
// before JSON.parse (which doesn't tolerate them).
function stripJsonComments(input: string): string {
  return input.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}
