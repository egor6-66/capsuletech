import { existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import type { CliContext, CliMode } from './types';

const detectMode = (workspaceRoot: string | null): CliMode => {
  if (process.env.CAPSULE_MODE === 'development') return 'dev';
  if (process.env.CAPSULE_MODE === 'production') return 'prod';
  // Авто-детект: внутри capsule-репозитория есть исходники shared-vite.
  if (workspaceRoot && existsSync(join(workspaceRoot, 'packages/builders/vite/package.json'))) {
    return 'dev';
  }
  return 'prod';
};

export const detect = (cwd: string = process.cwd()): CliContext => {
  let dir = cwd;
  let workspaceRoot: string | null = null;

  while (true) {
    if (existsSync(join(dir, 'nx.json'))) {
      workspaceRoot = dir;
      break;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  const mode = detectMode(workspaceRoot);

  if (!workspaceRoot) {
    return { type: 'no-workspace', cwd, mode };
  }
  if (workspaceRoot === cwd) {
    return { type: 'workspace-root', root: workspaceRoot, cwd, mode };
  }

  const rel = relative(workspaceRoot, cwd).split(/[/\\]/).filter(Boolean);
  if (rel[0] === 'apps' && rel.length >= 2) {
    return { type: 'app', name: rel[1], root: workspaceRoot, cwd, mode };
  }
  if (rel[0] === 'packages' && rel.length >= 2) {
    return { type: 'lib', name: rel[1], root: workspaceRoot, cwd, mode };
  }
  return { type: 'workspace-inner', root: workspaceRoot, cwd, mode };
};

/**
 * Возвращает список проектов в apps/ или packages/. Поддерживает один уровень
 * вложенности (packages/web/ui → "web/ui"), чтобы работать и с плоскими
 * консьюмер-воркспейсами, и с capsule-репо где packages сгруппированы.
 */
export const listWorkspaceChildren = (root: string, dir: 'apps' | 'packages'): string[] => {
  const base = join(root, dir);
  if (!existsSync(base)) return [];
  const out: string[] = [];
  for (const name of readdirSync(base)) {
    const child = join(base, name);
    try {
      if (!statSync(child).isDirectory()) continue;
      if (existsSync(join(child, 'package.json'))) {
        out.push(name);
        continue;
      }
      for (const sub of readdirSync(child)) {
        const subPath = join(child, sub);
        try {
          if (statSync(subPath).isDirectory() && existsSync(join(subPath, 'package.json'))) {
            out.push(`${name}/${sub}`);
          }
        } catch {
          /* skip */
        }
      }
    } catch {
      /* skip */
    }
  }
  return out.sort();
};
