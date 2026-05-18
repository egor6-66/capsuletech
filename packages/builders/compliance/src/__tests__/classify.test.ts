import { describe, expect, it } from 'vitest';
import { classify, extractGroup } from '../classify';

/**
 * Поведение `classify(absPath)`:
 *  - apps/<app>/src/<layer>/...  → соответствующий Layer
 *  - packages/<name>/...          → 'system' (без ограничений compliance)
 *  - .capsule/...                 → null (auto-generated, skip)
 *  - node_modules/...             → null (внешние)
 *  - *.test.ts / *.spec.tsx       → 'test' (ослабленный режим)
 *  - всё остальное                → null
 *
 * RegExp в classify.ts использует `[\\/]` — должен работать и на POSIX, и на Windows.
 */

describe('classify', () => {
  describe('HCA layers (POSIX paths)', () => {
    it.each([
      ['entity', '/repo/apps/sandbox/src/entities/_auth/loginForm.tsx'],
      ['controller', '/repo/apps/sandbox/src/controllers/auth.ts'],
      ['feature', '/repo/apps/sandbox/src/features/auth.ts'],
      ['widget', '/repo/apps/sandbox/src/widgets/forms/auth.tsx'],
      ['page', '/repo/apps/sandbox/src/pages/index.tsx'],
    ])('resolves %s for %s', (expected, path) => {
      expect(classify(path)).toBe(expected);
    });
  });

  describe('HCA layers (Windows backslash paths)', () => {
    it('resolves entity on Windows path', () => {
      expect(classify('D:\\repo\\apps\\sandbox\\src\\entities\\_auth\\loginForm.tsx')).toBe(
        'entity',
      );
    });
    it('resolves widget on Windows path', () => {
      expect(classify('D:\\repo\\apps\\agent\\src\\widgets\\forms\\auth.tsx')).toBe('widget');
    });
  });

  describe('special buckets', () => {
    it('packages/* → system (no compliance constraints)', () => {
      expect(classify('/repo/packages/web/core/src/index.ts')).toBe('system');
    });

    it('packages/builders/* → system', () => {
      expect(classify('/repo/packages/builders/vite/src/plugins/appConfig.ts')).toBe('system');
    });

    it('.capsule/ auto-generated → null', () => {
      expect(classify('/repo/apps/sandbox/.capsule/routes/index.tsx')).toBeNull();
    });

    it('node_modules → null', () => {
      expect(classify('/repo/node_modules/some-pkg/index.js')).toBeNull();
    });

    it.each([
      '.test.ts',
      '.test.tsx',
      '.test.js',
      '.test.jsx',
      '.spec.ts',
      '.spec.tsx',
    ])('test pattern (%s) → "test"', (suffix) => {
      expect(classify(`/repo/apps/sandbox/src/entities/foo${suffix}`)).toBe('test');
    });
  });

  describe('non-matching paths', () => {
    it('empty path → null', () => {
      expect(classify('')).toBeNull();
    });

    it('file outside apps/ and packages/ → null', () => {
      expect(classify('/repo/scripts/release.mjs')).toBeNull();
    });

    it('apps/ but not in src/<layer>/ → null', () => {
      expect(classify('/repo/apps/sandbox/capsule.app.ts')).toBeNull();
    });
  });
});

describe('extractGroup', () => {
  it('extracts group name for entity', () => {
    expect(extractGroup('/repo/apps/sandbox/src/entities/_auth/loginForm.tsx', 'entity')).toBe(
      '_auth',
    );
  });

  it('extracts group name for widget', () => {
    expect(extractGroup('/repo/apps/sandbox/src/widgets/forms/auth.tsx', 'widget')).toBe('forms');
  });

  it('returns null when no group dir (file directly in layer root)', () => {
    expect(extractGroup('/repo/apps/sandbox/src/entities/loose.tsx', 'entity')).toBeNull();
  });

  it.each(['system', 'test', null] as const)('returns null for %s layer', (layer) => {
    expect(extractGroup('/repo/anything', layer)).toBeNull();
  });

  it('works on Windows backslash paths', () => {
    expect(
      extractGroup('D:\\repo\\apps\\sandbox\\src\\entities\\_auth\\loginForm.tsx', 'entity'),
    ).toBe('_auth');
  });

  it('extracts page group correctly (plural "pages")', () => {
    expect(extractGroup('/repo/apps/sandbox/src/pages/home/index.tsx', 'page')).toBe('home');
  });

  it('extracts controller group correctly', () => {
    expect(extractGroup('/repo/apps/sandbox/src/controllers/auth/loginForm.ts', 'controller')).toBe(
      'auth',
    );
  });

  it('extracts feature group correctly', () => {
    expect(extractGroup('/repo/apps/sandbox/src/features/auth/login.ts', 'feature')).toBe('auth');
  });
});
