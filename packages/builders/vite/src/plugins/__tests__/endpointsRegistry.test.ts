import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { EndpointsRegistryPlugin } from '../endpointsRegistry';
import type { Plugin } from 'vite';

/**
 * Tests for EndpointsRegistryPlugin's enforce:'pre' transform.
 *
 * Key invariants:
 *  - Files inside src/endpoints/ get `defineEndpoint` import injected automatically.
 *  - Files outside src/endpoints/ are not touched.
 *  - Injection is idempotent: if import already present, no double-inject.
 *  - Extends to future DEFINE_FACTORIES entries automatically.
 *
 * NOTE: paths use path.resolve() to produce platform-correct absolute paths
 * (D:\ on Windows, /... on POSIX). The plugin's transform normalizes to
 * forward-slash internally for cross-platform startsWith comparison.
 */

// Use resolve() so paths are proper absolute paths on any platform.
const WATCH_DIR = resolve('/project/apps/myapp/src');
const ENDPOINTS_DIR = resolve(WATCH_DIR, 'endpoints');

function makePlugin() {
  return EndpointsRegistryPlugin({
    out: resolve('/project/apps/myapp/.capsule/registry/endpoints.ts'),
    typesOut: resolve('/project/apps/myapp/.capsule/@types/api.d.ts'),
    watchDir: WATCH_DIR,
  }) as Plugin & {
    transform: (code: string, id: string) => { code: string } | null;
  };
}

function callTransform(plugin: ReturnType<typeof makePlugin>, code: string, id: string) {
  return plugin.transform(code, id);
}

describe('EndpointsRegistryPlugin — enforce:pre transform', () => {
  it('injects defineEndpoint import into endpoint files', () => {
    const plugin = makePlugin();
    const id = join(ENDPOINTS_DIR, 'auth.ts');
    const code = `export const login = defineEndpoint((z) => ({ method: 'POST', path: '/login' }));`;
    const result = callTransform(plugin, code, id);

    expect(result).not.toBeNull();
    expect(result!.code).toContain("import { defineEndpoint } from '@capsuletech/web-query'");
    expect(result!.code).toContain('export const login = defineEndpoint');
  });

  it('does NOT inject if defineEndpoint is already explicitly imported', () => {
    const plugin = makePlugin();
    const id = join(ENDPOINTS_DIR, 'auth.ts');
    const code = [
      "import { defineEndpoint } from '@capsuletech/web-query';",
      `export const login = defineEndpoint((z) => ({ method: 'POST', path: '/login' }));`,
    ].join('\n');
    const result = callTransform(plugin, code, id);

    // Idempotent: nothing to inject → null (pass-through)
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
    const id = join(ENDPOINTS_DIR, 'README.md');
    const code = '# Auth endpoints';
    const result = callTransform(plugin, code, id);
    expect(result).toBeNull();
  });

  it('injection is placed BEFORE original code (no TDZ)', () => {
    const plugin = makePlugin();
    const id = join(ENDPOINTS_DIR, 'user.ts');
    const code = `export const getUser = defineEndpoint((z) => ({ method: 'GET', path: '/user' }));`;
    const result = callTransform(plugin, code, id);

    expect(result).not.toBeNull();
    const importLineIdx = result!.code.indexOf("import { defineEndpoint }");
    const codeLineIdx = result!.code.indexOf('export const getUser');
    expect(importLineIdx).toBeLessThan(codeLineIdx);
  });

  it('strips Vite query suffix from id before path matching', () => {
    const plugin = makePlugin();
    // Vite can append ?t=<timestamp> or ?import to module ids
    const id = join(ENDPOINTS_DIR, 'auth.ts') + '?t=12345';
    const code = `export const login = defineEndpoint((z) => ({ method: 'POST', path: '/login' }));`;
    const result = callTransform(plugin, code, id);
    expect(result).not.toBeNull();
    expect(result!.code).toContain("import { defineEndpoint }");
  });

  it('works for nested endpoint files (e.g. src/endpoints/admin/users.ts)', () => {
    const plugin = makePlugin();
    const id = join(ENDPOINTS_DIR, 'admin', 'users.ts');
    const code = `export const listUsers = defineEndpoint((z) => ({ method: 'GET', path: '/admin/users' }));`;
    const result = callTransform(plugin, code, id);
    expect(result).not.toBeNull();
    expect(result!.code).toContain("import { defineEndpoint }");
  });
});
