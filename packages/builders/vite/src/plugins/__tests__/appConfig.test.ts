import type { Plugin } from 'vite';
import { describe, expect, it } from 'vitest';
import { AppConfigPlugin } from '../appConfig';

/**
 * Tests target ONLY the `transform` hook — это та точка, где переписываются
 * вызовы `defineAppConfig(...)` в identity-unwrap.
 *
 * Регрессии, которые тут ловятся:
 *  - Path-mismatch на Windows (configPath с `\`, Vite id с `/`).
 *  - Vite-суффиксы у id (`?import`, `?t=...` от HMR).
 *
 * Если transform не сработал — `defineAppConfig` улетит в браузер как
 * bare identifier и упадёт `ReferenceError`.
 *
 * `defineCapsuleConfig` намеренно не транспилируется — он живёт в
 * `capsule.config.ts` (Vite-config, Node-only). См. plugins/appConfig.ts
 * комментарий рядом с `FACTORY_REPLACE_RE`.
 */

const SOURCE = `export default defineAppConfig({ meta: { tags: ['a'] } });\n`;

const getTransform = (configPath: string) => {
  const plugin = AppConfigPlugin({
    configPath,
    typesOut: '/tmp/types.d.ts',
    runtimeOut: '/tmp/runtime.gen.ts',
  }) as Plugin & { transform: (code: string, id: string) => { code: string } | null };
  return plugin.transform.bind(plugin);
};

const expectTransformed = (out: { code: string } | null) => {
  expect(out, 'transform should run').not.toBeNull();
  expect(out!.code).not.toContain('defineAppConfig(');
  expect(out!.code).toContain('((__x__)=>__x__)(');
};

describe('AppConfigPlugin.transform — id ↔ configPath matching', () => {
  it('matches when id and configPath are identical POSIX paths', () => {
    const path = '/repo/apps/agent/capsule.app.ts';
    const out = getTransform(path)(SOURCE, path);
    expectTransformed(out);
  });

  it('matches Windows-backslash configPath against POSIX id (Vite normalizes to forward slash)', () => {
    const winPath = 'D:\\repo\\apps\\agent\\capsule.app.ts';
    const viteId = 'D:/repo/apps/agent/capsule.app.ts';
    const out = getTransform(winPath)(SOURCE, viteId);
    expectTransformed(out);
  });

  it('matches when Vite appends ?import suffix to id', () => {
    const path = '/repo/apps/agent/capsule.app.ts';
    const out = getTransform(path)(SOURCE, `${path}?import`);
    expectTransformed(out);
  });

  it('matches when Vite appends ?t=<ts> HMR suffix to id', () => {
    const path = '/repo/apps/agent/capsule.app.ts';
    const out = getTransform(path)(SOURCE, `${path}?t=1736012345678`);
    expectTransformed(out);
  });

  it('does not transform unrelated files', () => {
    const path = '/repo/apps/agent/capsule.app.ts';
    const out = getTransform(path)(SOURCE, '/repo/apps/agent/src/main.tsx');
    expect(out).toBeNull();
  });

  it('does not transform defineCapsuleConfig (lives in capsule.config.ts, Node-only)', () => {
    const path = '/repo/apps/agent/capsule.config.ts';
    const out = getTransform(path)(
      `export default defineCapsuleConfig({ devServerPort: 3000 });\n`,
      path,
    );
    // Even if path matches, the regex now targets only `defineAppConfig`.
    expect(out).toBeNull();
  });

  it('returns null if no factory identifiers are present (safe early exit)', () => {
    const path = '/repo/apps/agent/capsule.app.ts';
    const out = getTransform(path)(`export default { foo: 1 };\n`, path);
    expect(out).toBeNull();
  });
});
