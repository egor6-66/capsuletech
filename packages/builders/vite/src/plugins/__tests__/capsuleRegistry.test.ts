/**
 * Tests for CapsuleRegistryPlugin sub-generators.
 *
 * Sub-generators are exported stateless functions, so they can be tested in
 * isolation without spinning up a Vite server or touching the filesystem.
 *
 * What is covered:
 *
 * ── Wrappers (generateWrappersRuntime / generateWrappersTypes) ───────────────
 *  - Entities flat file → eager import (not lazy), correct variable name.
 *  - Entities nested folder → nested namespace (Entities.Users.Profile).
 *  - Empty entities/ folder → empty Entities object (no crash, no lazy).
 *  - Widget flat file → lazy() import (existing layers unaffected).
 *  - Object.assign(globalThis, ...) present after all export const decls.
 *  - Types interface shape for all layer scenarios.
 *
 * ── Endpoints (generateEndpointsRuntime / generateEndpointsTypes) ────────────
 *  - Flat endpoint file → endpoints.user.
 *  - Nested endpoint file → endpoints.admin.users.
 *  - index.ts inside dir → correct segment without 'index'.
 *  - Empty endpoints/ → empty `endpoints = {}` (no crash).
 *  - Types file imports InferApi from correct package.
 *
 * ── AppConfig (generateAppConfigRuntime) ─────────────────────────────────────
 *  - Contains registerAliases, createApi, setApiClient.
 *  - Static endpoints import (not dynamic).
 *  - IAppConfig type-only import.
 *
 * ── Bootstrap (generateBootstrap) ────────────────────────────────────────────
 *  - Import order strictly matches LAYER_INIT_ORDER phases.
 *  - wrappers (globals) imported before app-config (subsystems).
 *  - routeTree named import present.
 *  - styles.css and BaseProviders are present.
 *  - No editable user content in the file.
 *
 * ── LAYER_INIT_ORDER contract ─────────────────────────────────────────────────
 *  - 'globals' phase comes before 'subsystems' which comes before 'render'.
 *  - 'wrappers' entry is phase 'globals'.
 *  - 'routes' entry is phase 'render'.
 *  - All entries have unique names.
 *
 * ── CapsuleRegistryPlugin transform ──────────────────────────────────────────
 *  - defineEndpoint injected into src/endpoints/** (enforce:'pre' transform).
 *  - defineEndpoint injection is idempotent.
 *  - defineEndpoint NOT injected outside endpoints/.
 *  - defineAppConfig replaced with identity-unwrap in capsule.app.ts.
 *  - defineAppConfig NOT replaced in unrelated files.
 */

import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Plugin } from 'vite';
import {
  generateWrappersRuntime,
  generateWrappersTypes,
  generateEndpointsRuntime,
  generateEndpointsTypes,
  generateAppConfigRuntime,
  generateBootstrap,
  LAYER_INIT_ORDER,
  CapsuleRegistryPlugin,
} from '../capsuleRegistry';

// ---------------------------------------------------------------------------
// Helpers to build leaf objects without exercising FS
// ---------------------------------------------------------------------------

interface WrapperLeaf {
  layer: string;
  importPath: string;
  segments: string[];
}

interface EndpointLeaf {
  segments: string[];
  relPath: string;
}

const wrapperLeaf = (
  layer: string,
  importPath: string,
  segments: string[],
): WrapperLeaf => ({ layer, importPath, segments });

const endpointLeaf = (segments: string[], relPath: string): EndpointLeaf => ({
  segments,
  relPath,
});

// ---------------------------------------------------------------------------
// Wrappers — runtime
// ---------------------------------------------------------------------------

describe('generateWrappersRuntime — Entities flat file', () => {
  const leaf = wrapperLeaf('entities', '@entities/users', ['Users']);

  it('emits eager import at top of file (not lazy)', () => {
    const out = generateWrappersRuntime([leaf]);
    expect(out).toContain("import _Users from '@entities/users';");
    expect(out).not.toContain("lazy(() => import('@entities/users'))");
  });

  it('emits Entities export referencing the import variable', () => {
    const out = generateWrappersRuntime([leaf]);
    expect(out).toContain('export const Entities = {');
    expect(out).toContain('Users: _Users');
  });
});

describe('generateWrappersRuntime — Entities nested namespace', () => {
  const leaf = wrapperLeaf('entities', '@entities/users/profile', ['Users', 'Profile']);

  it('emits eager import with underscore-joined variable name', () => {
    const out = generateWrappersRuntime([leaf]);
    expect(out).toContain("import _Users_Profile from '@entities/users/profile';");
  });

  it('emits nested namespace Entities.Users.Profile', () => {
    const out = generateWrappersRuntime([leaf]);
    expect(out).toContain('Users: {');
    expect(out).toContain('Profile: _Users_Profile');
  });
});

describe('generateWrappersRuntime — empty entities folder', () => {
  it('emits empty Entities object (no crash, no lazy)', () => {
    const out = generateWrappersRuntime([]);
    expect(out).toContain('export const Entities = {};');
    expect(out).not.toContain("lazy(() => import('@entities");
  });
});

describe('generateWrappersRuntime — widget layer uses lazy (regression)', () => {
  const leaf = wrapperLeaf('widgets', '@widgets/forms/auth', ['Forms', 'Auth']);

  it('widget leaf uses lazy(), not eager import', () => {
    const out = generateWrappersRuntime([leaf]);
    expect(out).toContain("lazy(() => import('@widgets/forms/auth'))");
    expect(out).not.toContain('import _Forms_Auth');
  });

  it('Widgets namespace is present', () => {
    const out = generateWrappersRuntime([leaf]);
    expect(out).toContain('export const Widgets = {');
  });
});

describe('generateWrappersRuntime — multiple entities sorted', () => {
  const leaf1 = wrapperLeaf('entities', '@entities/products', ['Products']);
  const leaf2 = wrapperLeaf('entities', '@entities/users', ['Users']);

  it('emits both eager imports', () => {
    const out = generateWrappersRuntime([leaf1, leaf2]);
    expect(out).toContain("import _Products from '@entities/products';");
    expect(out).toContain("import _Users from '@entities/users';");
  });

  it('Entities object contains both keys', () => {
    const out = generateWrappersRuntime([leaf1, leaf2]);
    expect(out).toContain('Products: _Products');
    expect(out).toContain('Users: _Users');
  });
});

describe('generateWrappersRuntime — Object.assign(globalThis) ordering', () => {
  it('output contains Object.assign(globalThis, ...) at module top level', () => {
    const leaf = wrapperLeaf('entities', '@entities/users', ['Users']);
    const out = generateWrappersRuntime([leaf]);
    expect(out).toContain('Object.assign(globalThis,');
  });

  it('Object.assign includes all layer namespaces', () => {
    const out = generateWrappersRuntime([]);
    const allNs = ['Widgets', 'Views', 'Controllers', 'Features', 'Shapes', 'Entities'];
    for (const ns of allNs) {
      expect(out).toContain(ns);
    }
    expect(out).toContain(`Object.assign(globalThis, { ${allNs.join(', ')} });`);
  });

  it('Object.assign appears AFTER all export const declarations', () => {
    const leaf = wrapperLeaf('entities', '@entities/users', ['Users']);
    const out = generateWrappersRuntime([leaf]);
    const assignIdx = out.indexOf('Object.assign(globalThis,');
    const lastExportIdx = out.lastIndexOf('export const ');
    expect(assignIdx).toBeGreaterThan(lastExportIdx);
  });

  it('Object.assign is present even with no leaves (empty app)', () => {
    const out = generateWrappersRuntime([]);
    expect(out).toContain('Object.assign(globalThis,');
  });
});

// ---------------------------------------------------------------------------
// Wrappers — types
// ---------------------------------------------------------------------------

describe('generateWrappersTypes — entities interface', () => {
  it('flat entity generates correct typeof import type', () => {
    const leaf = wrapperLeaf('entities', '@entities/users', ['Users']);
    const out = generateWrappersTypes([leaf]);
    expect(out).toContain('interface Entities {');
    expect(out).toContain("Users: typeof import('@entities/users').default;");
  });

  it('nested entity generates nested interface structure', () => {
    const leaf = wrapperLeaf('entities', '@entities/users/profile', ['Users', 'Profile']);
    const out = generateWrappersTypes([leaf]);
    expect(out).toContain('interface Entities {');
    expect(out).toContain('Users:');
    expect(out).toContain("Profile: typeof import('@entities/users/profile').default;");
  });

  it('empty entities generates empty interface (not omitted)', () => {
    const out = generateWrappersTypes([]);
    expect(out).toContain('interface Entities {}');
  });

  it('output is a valid global augmentation shape', () => {
    const leaf = wrapperLeaf('entities', '@entities/users', ['Users']);
    const out = generateWrappersTypes([leaf]);
    expect(out).toContain('declare global {');
    expect(out).toContain('}');
    expect(out).toContain('export {};');
  });
});

// ---------------------------------------------------------------------------
// Endpoints — runtime
// ---------------------------------------------------------------------------

describe('generateEndpointsRuntime — flat file', () => {
  const leaf = endpointLeaf(['user'], 'user');

  it('emits namespace import for user endpoint', () => {
    const out = generateEndpointsRuntime([leaf], '../src');
    expect(out).toContain("import * as user from '../src/endpoints/user';");
  });

  it('emits endpoints object with user key', () => {
    const out = generateEndpointsRuntime([leaf], '../src');
    expect(out).toContain('export const endpoints = {');
    expect(out).toContain('user: user');
  });

  it('emits Endpoints type alias', () => {
    const out = generateEndpointsRuntime([leaf], '../src');
    expect(out).toContain('export type Endpoints = typeof endpoints;');
  });
});

describe('generateEndpointsRuntime — nested endpoint', () => {
  const leaf = endpointLeaf(['admin', 'users'], 'admin/users');

  it('emits double-underscore alias for nested endpoint', () => {
    const out = generateEndpointsRuntime([leaf], '../src');
    expect(out).toContain("import * as admin__users from '../src/endpoints/admin/users';");
  });

  it('emits nested object structure', () => {
    const out = generateEndpointsRuntime([leaf], '../src');
    expect(out).toContain('admin: {');
    expect(out).toContain('users: admin__users');
  });
});

describe('generateEndpointsRuntime — empty endpoints', () => {
  it('emits empty endpoints object (no crash)', () => {
    const out = generateEndpointsRuntime([], '../src');
    expect(out).toContain('export const endpoints = {} as const;');
    expect(out).toContain('export type Endpoints = typeof endpoints;');
  });
});

// ---------------------------------------------------------------------------
// Endpoints — types
// ---------------------------------------------------------------------------

describe('generateEndpointsTypes', () => {
  it('imports InferApi from @capsuletech/web-query', () => {
    const out = generateEndpointsTypes();
    expect(out).toContain("import type { InferApi } from '@capsuletech/web-query';");
  });

  it('imports Endpoints from registry/endpoints', () => {
    const out = generateEndpointsTypes();
    expect(out).toContain("import type { Endpoints } from '../registry/endpoints';");
  });

  it('declares CapsuleApi global interface extending InferApi', () => {
    const out = generateEndpointsTypes();
    expect(out).toContain('interface CapsuleApi extends InferApi<Endpoints> {}');
  });

  it('has export {} for module augmentation', () => {
    const out = generateEndpointsTypes();
    expect(out).toContain('export {};');
  });
});

// ---------------------------------------------------------------------------
// AppConfig — runtime
// ---------------------------------------------------------------------------

describe('generateAppConfigRuntime', () => {
  it('contains registerAliases call', () => {
    const out = generateAppConfigRuntime({});
    expect(out).toContain("import { registerAliases } from '@capsuletech/web-state';");
    expect(out).toContain('registerAliases(');
  });

  it('contains createApi and setApiClient guarded by api check', () => {
    const out = generateAppConfigRuntime({});
    expect(out).toContain("import { createApi, setApiClient } from '@capsuletech/web-query';");
    expect(out).toContain('if (appConfig.api) {');
    expect(out).toContain('setApiClient(createApi(appConfig.api, endpoints));');
  });

  it('contains type-only IAppConfig import', () => {
    const out = generateAppConfigRuntime({});
    expect(out).toContain("import { type IAppConfig } from '@capsuletech/web-core/app-config';");
  });

  it('uses static endpoints import (not dynamic)', () => {
    const out = generateAppConfigRuntime({});
    expect(out).toContain("import { endpoints } from './registry/endpoints';");
    expect(out).not.toContain("import('./registry/endpoints')");
  });

  it('serializes aliases JSON into registerAliases call', () => {
    const out = generateAppConfigRuntime({ '@input': ['login', 'input'] });
    expect(out).toContain('"@input"');
  });

  it('handles undefined aliases (defaults to empty object)', () => {
    const out = generateAppConfigRuntime(undefined);
    expect(out).toContain('registerAliases({});');
  });
});

// ---------------------------------------------------------------------------
// Bootstrap — generated content
// ---------------------------------------------------------------------------

describe('generateBootstrap — structure', () => {
  it('contains styles.css import', () => {
    const out = generateBootstrap();
    expect(out).toContain("import './styles.css';");
  });

  it('contains BaseProviders import', () => {
    const out = generateBootstrap();
    expect(out).toContain("import { BaseProviders } from '@capsuletech/web-core/providers';");
  });

  it('contains Bootstrap component export', () => {
    const out = generateBootstrap();
    expect(out).toContain('export const Bootstrap = () => {');
    expect(out).toContain('<BaseProviders routeTree={routeTree} />');
  });

  it('starts with generated comment (not user-editable)', () => {
    const out = generateBootstrap();
    expect(out.startsWith('// generated by CapsuleRegistryPlugin')).toBe(true);
  });
});

describe('generateBootstrap — import order matches LAYER_INIT_ORDER', () => {
  it('wrappers (globals) imported before app-config (subsystems)', () => {
    const out = generateBootstrap();
    const wrappersIdx = out.indexOf("import './registry/wrappers'");
    const appConfigIdx = out.indexOf("import './app-config.gen'");
    expect(wrappersIdx).toBeGreaterThanOrEqual(0);
    expect(appConfigIdx).toBeGreaterThanOrEqual(0);
    expect(wrappersIdx).toBeLessThan(appConfigIdx);
  });

  it('app-config (subsystems) imported before routeTree (render)', () => {
    const out = generateBootstrap();
    const appConfigIdx = out.indexOf("import './app-config.gen'");
    const routeTreeIdx = out.indexOf("import { routeTree } from './routes/routeTree.gen'");
    expect(appConfigIdx).toBeGreaterThanOrEqual(0);
    expect(routeTreeIdx).toBeGreaterThanOrEqual(0);
    expect(appConfigIdx).toBeLessThan(routeTreeIdx);
  });

  it('wrappers uses bare side-effect import (no named binding)', () => {
    const out = generateBootstrap();
    // bare side-effect: `import './registry/wrappers'` without `{ ... }` or `* as`
    expect(out).toMatch(/import '\.\/registry\/wrappers'/);
    expect(out).not.toMatch(/import \{[^}]*\} from '\.\/registry\/wrappers'/);
  });

  it('routeTree uses named import', () => {
    const out = generateBootstrap();
    expect(out).toContain("import { routeTree } from './routes/routeTree.gen';");
  });

  it('all LAYER_INIT_ORDER entries appear in the bootstrap output', () => {
    const out = generateBootstrap();
    for (const layer of LAYER_INIT_ORDER) {
      expect(out).toContain(layer.importPath);
    }
  });

  it('bootstrap import order is exactly the same as LAYER_INIT_ORDER', () => {
    const out = generateBootstrap();
    const positions = LAYER_INIT_ORDER.map((layer) => out.indexOf(layer.importPath));
    // Positions must be strictly increasing.
    for (let i = 1; i < positions.length; i++) {
      expect(positions[i]).toBeGreaterThan(positions[i - 1]);
    }
  });
});

// ---------------------------------------------------------------------------
// LAYER_INIT_ORDER contract
// ---------------------------------------------------------------------------

describe('LAYER_INIT_ORDER contract', () => {
  it("'globals' phase comes before 'subsystems' which comes before 'render'", () => {
    const phases = LAYER_INIT_ORDER.map((e) => e.phase);
    const firstSubsystems = phases.indexOf('subsystems');
    const firstRender = phases.indexOf('render');
    const lastGlobals = phases.lastIndexOf('globals');

    expect(lastGlobals).toBeLessThan(firstSubsystems);
    expect(firstSubsystems).toBeLessThan(firstRender);
  });

  it("'wrappers' entry is phase 'globals'", () => {
    const entry = LAYER_INIT_ORDER.find((e) => e.name === 'wrappers');
    expect(entry).toBeDefined();
    expect(entry!.phase).toBe('globals');
  });

  it("'routes' entry is phase 'render'", () => {
    const entry = LAYER_INIT_ORDER.find((e) => e.name === 'routes');
    expect(entry).toBeDefined();
    expect(entry!.phase).toBe('render');
  });

  it('all entries have unique names', () => {
    const names = LAYER_INIT_ORDER.map((e) => e.name);
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });

  it('all entries have non-empty importPath', () => {
    for (const entry of LAYER_INIT_ORDER) {
      expect(entry.importPath.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// CapsuleRegistryPlugin transform hooks
// ---------------------------------------------------------------------------

const WATCH_DIR = resolve('/project/apps/myapp/src');
const CAPSULE_ROOT = resolve('/project/apps/myapp/.capsule');
const APP_CONFIG_PATH = resolve('/project/apps/myapp/capsule.app.ts');
const ENDPOINTS_DIR_ABS = resolve(WATCH_DIR, 'endpoints');

function makePlugin() {
  return CapsuleRegistryPlugin({
    capsuleRoot: CAPSULE_ROOT,
    watchDir: WATCH_DIR,
    appConfigPath: APP_CONFIG_PATH,
  }) as Plugin & {
    transform: (code: string, id: string) => { code: string } | null;
  };
}

function callTransform(plugin: ReturnType<typeof makePlugin>, code: string, id: string) {
  return plugin.transform(code, id);
}

describe('CapsuleRegistryPlugin.transform — defineEndpoint injection', () => {
  it('injects defineEndpoint import into endpoint files', () => {
    const plugin = makePlugin();
    const id = join(ENDPOINTS_DIR_ABS, 'auth.ts');
    const code = `export const login = defineEndpoint((z) => ({ method: 'POST', path: '/login' }));`;
    const result = callTransform(plugin, code, id);

    expect(result).not.toBeNull();
    expect(result!.code).toContain("import { defineEndpoint } from '@capsuletech/web-query'");
    expect(result!.code).toContain('export const login = defineEndpoint');
  });

  it('does NOT inject if defineEndpoint already explicitly imported (idempotent)', () => {
    const plugin = makePlugin();
    const id = join(ENDPOINTS_DIR_ABS, 'auth.ts');
    const code = [
      "import { defineEndpoint } from '@capsuletech/web-query';",
      `export const login = defineEndpoint((z) => ({ method: 'POST', path: '/login' }));`,
    ].join('\n');
    const result = callTransform(plugin, code, id);
    expect(result).toBeNull();
  });

  it('does NOT touch files outside src/endpoints/', () => {
    const plugin = makePlugin();
    const id = resolve(WATCH_DIR, 'features', 'auth.ts');
    const code = `export const useAuth = () => {};`;
    const result = callTransform(plugin, code, id);
    expect(result).toBeNull();
  });

  it('does NOT touch non-ts files inside endpoints/', () => {
    const plugin = makePlugin();
    const id = join(ENDPOINTS_DIR_ABS, 'README.md');
    const code = '# Auth endpoints';
    const result = callTransform(plugin, code, id);
    expect(result).toBeNull();
  });

  it('injection is placed BEFORE original code (no TDZ)', () => {
    const plugin = makePlugin();
    const id = join(ENDPOINTS_DIR_ABS, 'user.ts');
    const code = `export const getUser = defineEndpoint((z) => ({ method: 'GET', path: '/user' }));`;
    const result = callTransform(plugin, code, id);

    expect(result).not.toBeNull();
    const importIdx = result!.code.indexOf('import { defineEndpoint }');
    const codeIdx = result!.code.indexOf('export const getUser');
    expect(importIdx).toBeLessThan(codeIdx);
  });

  it('strips Vite query suffix from id before path matching', () => {
    const plugin = makePlugin();
    const id = join(ENDPOINTS_DIR_ABS, 'auth.ts') + '?t=12345';
    const code = `export const login = defineEndpoint((z) => ({ method: 'POST', path: '/login' }));`;
    const result = callTransform(plugin, code, id);
    expect(result).not.toBeNull();
    expect(result!.code).toContain('import { defineEndpoint }');
  });

  it('works for nested endpoint files', () => {
    const plugin = makePlugin();
    const id = join(ENDPOINTS_DIR_ABS, 'admin', 'users.ts');
    const code = `export const listUsers = defineEndpoint((z) => ({ method: 'GET', path: '/admin/users' }));`;
    const result = callTransform(plugin, code, id);
    expect(result).not.toBeNull();
    expect(result!.code).toContain('import { defineEndpoint }');
  });
});

describe('CapsuleRegistryPlugin.transform — defineAppConfig identity-unwrap', () => {
  const SOURCE = `export default defineAppConfig({ meta: { tags: ['a'] } });\n`;

  it('replaces defineAppConfig call-site with identity-unwrap in capsule.app.ts', () => {
    const plugin = makePlugin();
    const result = callTransform(plugin, SOURCE, APP_CONFIG_PATH);
    expect(result).not.toBeNull();
    expect(result!.code).not.toContain('defineAppConfig(');
    expect(result!.code).toContain('((__x__)=>__x__)(');
  });

  it('matches Windows-backslash configPath against POSIX id', () => {
    const winPath = 'D:\\repo\\apps\\myapp\\capsule.app.ts';
    const viteId = 'D:/repo/apps/myapp/capsule.app.ts';
    const plugin = CapsuleRegistryPlugin({
      capsuleRoot: CAPSULE_ROOT,
      watchDir: WATCH_DIR,
      appConfigPath: winPath,
    }) as Plugin & { transform: (code: string, id: string) => { code: string } | null };
    const result = plugin.transform(SOURCE, viteId);
    expect(result).not.toBeNull();
    expect(result!.code).toContain('((__x__)=>__x__)');
  });

  it('matches when Vite appends ?import suffix to id', () => {
    const plugin = makePlugin();
    const result = callTransform(plugin, SOURCE, APP_CONFIG_PATH + '?import');
    expect(result).not.toBeNull();
    expect(result!.code).toContain('((__x__)=>__x__)');
  });

  it('matches when Vite appends ?t=<ts> HMR suffix to id', () => {
    const plugin = makePlugin();
    const result = callTransform(plugin, SOURCE, APP_CONFIG_PATH + '?t=1736012345678');
    expect(result).not.toBeNull();
    expect(result!.code).toContain('((__x__)=>__x__)');
  });

  it('does NOT transform unrelated files', () => {
    const plugin = makePlugin();
    const result = callTransform(plugin, SOURCE, resolve(WATCH_DIR, 'main.tsx'));
    expect(result).toBeNull();
  });

  it('returns null if no defineAppConfig present (safe early exit)', () => {
    const plugin = makePlugin();
    const result = callTransform(plugin, `export default { foo: 1 };\n`, APP_CONFIG_PATH);
    expect(result).toBeNull();
  });

  it('preserves explicit import binding, replaces only call-site', () => {
    const plugin = makePlugin();
    const code = [
      `import { defineAppConfig } from '@capsuletech/web-core/app-config';`,
      `export default defineAppConfig({ meta: { tags: ['click'] }, aliases: {} });`,
      '',
    ].join('\n');
    const result = callTransform(plugin, code, APP_CONFIG_PATH);
    expect(result).not.toBeNull();
    expect(result!.code).toContain(`import { defineAppConfig } from '@capsuletech/web-core/app-config'`);
    expect(result!.code).toContain('((__x__)=>__x__)({ meta:');
  });
});

// ---------------------------------------------------------------------------
// Cross-concern ordering regression
//
// Root cause (pre-fix): ESM import declarations evaluate before module body.
// bootstrap.tsx `import { routeTree }` caused transitive eval of the page
// tree before Object.assign(globalThis, _registry) fired → TDZ.
//
// The fix: wrappers.ts runs Object.assign as a top-level side-effect.
// bootstrap.tsx imports it as a bare side-effect before anything else.
// generateBootstrap() encodes this in LAYER_INIT_ORDER.
// ---------------------------------------------------------------------------

describe('Cross-concern ordering regression — ESM TDZ fix', () => {
  it('wrappers Object.assign fires before endpoints are evaluated', () => {
    // Verify the bootstrap output has wrappers before app-config (which imports endpoints).
    const bootstrap = generateBootstrap();
    const wrappersIdx = bootstrap.indexOf("'./registry/wrappers'");
    const appConfigIdx = bootstrap.indexOf("'./app-config.gen'");
    expect(wrappersIdx).toBeLessThan(appConfigIdx);
  });

  it('wrappers.ts Object.assign fires on module eval (not inside a function)', () => {
    // Object.assign must be a top-level statement, not inside export/function scope.
    const wrappers = generateWrappersRuntime([]);
    // The assign call must appear at column 0 (no leading indentation).
    const lines = wrappers.split('\n');
    const assignLine = lines.find((l) => l.startsWith('Object.assign(globalThis,'));
    expect(assignLine).toBeDefined();
  });

  it('adding new entry to LAYER_INIT_ORDER automatically appears in bootstrap', () => {
    // This test documents the invariant: generateBootstrap() reads from LAYER_INIT_ORDER
    // so any new entry will automatically propagate.
    // We cannot mutate the const here, but we verify the mapping is exhaustive:
    const bootstrap = generateBootstrap();
    const missingEntries = LAYER_INIT_ORDER.filter(
      (e) => !bootstrap.includes(e.importPath),
    );
    expect(missingEntries).toHaveLength(0);
  });
});
