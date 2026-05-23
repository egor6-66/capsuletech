import { describe, expect, it } from 'vitest';
import { buildOverride } from '../override';
import type { IDesktopConfig } from '../types';

const baseDesktop: IDesktopConfig = {
  productName: 'Sandbox',
  identifier: 'tech.capsule.sandbox',
};

describe('buildOverride — dev kind', () => {
  it('sets productName, identifier, version', () => {
    const result = buildOverride({
      kind: 'dev',
      app: 'sandbox',
      devUrl: 'http://localhost:3000',
      desktop: baseDesktop,
      version: '1.0.0',
    });
    expect(result.productName).toBe('Sandbox');
    expect(result.identifier).toBe('tech.capsule.sandbox');
    expect(result.version).toBe('1.0.0');
  });

  it('sets build.devUrl', () => {
    const result = buildOverride({
      kind: 'dev',
      app: 'sandbox',
      devUrl: 'http://localhost:3000',
      desktop: baseDesktop,
      version: '1.0.0',
    });
    const build = result.build as Record<string, unknown>;
    expect(build.devUrl).toBe('http://localhost:3000');
  });

  it('sets build.beforeDevCommand and beforeBuildCommand to empty string', () => {
    const result = buildOverride({
      kind: 'dev',
      app: 'sandbox',
      devUrl: 'http://localhost:3000',
      desktop: baseDesktop,
      version: '1.0.0',
    });
    const build = result.build as Record<string, unknown>;
    expect(build.beforeDevCommand).toBe('');
    expect(build.beforeBuildCommand).toBe('');
  });

  it('sets app.windows[0].title to productName when window.title not specified', () => {
    const result = buildOverride({
      kind: 'dev',
      app: 'sandbox',
      devUrl: 'http://localhost:3000',
      desktop: baseDesktop,
      version: '1.0.0',
    });
    const app = result.app as { windows: Array<Record<string, unknown>> };
    expect(app.windows[0].title).toBe('Sandbox');
    expect(app.windows[0].label).toBe('main');
  });

  it('uses default window dimensions when window not specified', () => {
    const result = buildOverride({
      kind: 'dev',
      app: 'sandbox',
      devUrl: 'http://localhost:3000',
      desktop: baseDesktop,
      version: '1.0.0',
    });
    const app = result.app as { windows: Array<Record<string, unknown>> };
    expect(app.windows[0].width).toBe(1280);
    expect(app.windows[0].height).toBe(800);
    expect(app.windows[0].minWidth).toBe(800);
    expect(app.windows[0].minHeight).toBe(600);
  });

  it('does not set bundle.icon when desktop.icon is not specified', () => {
    const result = buildOverride({
      kind: 'dev',
      app: 'sandbox',
      devUrl: 'http://localhost:3000',
      desktop: baseDesktop,
      version: '1.0.0',
    });
    expect(result.bundle).toBeUndefined();
  });

  it('does not add frontendDist or bundle.active in dev mode', () => {
    const result = buildOverride({
      kind: 'dev',
      app: 'sandbox',
      devUrl: 'http://localhost:3000',
      desktop: baseDesktop,
      version: '1.0.0',
    });
    const build = result.build as Record<string, unknown>;
    expect(build.frontendDist).toBeUndefined();
    expect(result.bundle).toBeUndefined();
  });
});

describe('buildOverride — build kind', () => {
  it('sets build.frontendDist with forward slashes', () => {
    const result = buildOverride({
      kind: 'build',
      app: 'sandbox',
      dist: 'C:\\Users\\dev\\apps\\sandbox\\dist',
      desktop: baseDesktop,
      version: '1.2.3',
    });
    const build = result.build as Record<string, unknown>;
    expect(build.frontendDist).toBe('C:/Users/dev/apps/sandbox/dist');
  });

  it('preserves forward slashes in dist path unchanged', () => {
    const result = buildOverride({
      kind: 'build',
      app: 'sandbox',
      dist: '/home/dev/apps/sandbox/dist',
      desktop: baseDesktop,
      version: '2.0.0',
    });
    const build = result.build as Record<string, unknown>;
    expect(build.frontendDist).toBe('/home/dev/apps/sandbox/dist');
  });

  it('sets bundle.active = true', () => {
    const result = buildOverride({
      kind: 'build',
      app: 'sandbox',
      dist: '/dist',
      desktop: baseDesktop,
      version: '1.0.0',
    });
    const bundle = result.bundle as Record<string, unknown>;
    expect(bundle.active).toBe(true);
  });

  it('sets build.beforeBuildCommand and beforeDevCommand to empty string', () => {
    const result = buildOverride({
      kind: 'build',
      app: 'sandbox',
      dist: '/dist',
      desktop: baseDesktop,
      version: '1.0.0',
    });
    const build = result.build as Record<string, unknown>;
    expect(build.beforeBuildCommand).toBe('');
    expect(build.beforeDevCommand).toBe('');
  });

  it('does not include devUrl in build mode', () => {
    const result = buildOverride({
      kind: 'build',
      app: 'sandbox',
      dist: '/dist',
      desktop: baseDesktop,
      version: '1.0.0',
    });
    const build = result.build as Record<string, unknown>;
    expect(build.devUrl).toBeUndefined();
  });
});

describe('buildOverride — IDesktopConfig.window overrides', () => {
  it('uses custom width and height', () => {
    const result = buildOverride({
      kind: 'dev',
      app: 'sandbox',
      devUrl: 'http://localhost:3000',
      desktop: { ...baseDesktop, window: { width: 1920, height: 1080 } },
      version: '1.0.0',
    });
    const app = result.app as { windows: Array<Record<string, unknown>> };
    expect(app.windows[0].width).toBe(1920);
    expect(app.windows[0].height).toBe(1080);
  });

  it('uses custom minWidth and minHeight', () => {
    const result = buildOverride({
      kind: 'dev',
      app: 'sandbox',
      devUrl: 'http://localhost:3000',
      desktop: { ...baseDesktop, window: { minWidth: 400, minHeight: 300 } },
      version: '1.0.0',
    });
    const app = result.app as { windows: Array<Record<string, unknown>> };
    expect(app.windows[0].minWidth).toBe(400);
    expect(app.windows[0].minHeight).toBe(300);
  });

  it('uses custom title when window.title is set', () => {
    const result = buildOverride({
      kind: 'dev',
      app: 'sandbox',
      devUrl: 'http://localhost:3000',
      desktop: { ...baseDesktop, window: { title: 'My Custom Title' } },
      version: '1.0.0',
    });
    const app = result.app as { windows: Array<Record<string, unknown>> };
    expect(app.windows[0].title).toBe('My Custom Title');
  });

  it('falls back to productName for title when window.title is not set', () => {
    const result = buildOverride({
      kind: 'dev',
      app: 'sandbox',
      devUrl: 'http://localhost:3000',
      desktop: { ...baseDesktop, window: { width: 800 } },
      version: '1.0.0',
    });
    const app = result.app as { windows: Array<Record<string, unknown>> };
    expect(app.windows[0].title).toBe('Sandbox');
  });

  it('partially overrides dimensions — unspecified fields use defaults', () => {
    const result = buildOverride({
      kind: 'dev',
      app: 'sandbox',
      devUrl: 'http://localhost:3000',
      desktop: { ...baseDesktop, window: { width: 1600 } },
      version: '1.0.0',
    });
    const app = result.app as { windows: Array<Record<string, unknown>> };
    expect(app.windows[0].width).toBe(1600);
    expect(app.windows[0].height).toBe(800); // default
    expect(app.windows[0].minWidth).toBe(800); // default
    expect(app.windows[0].minHeight).toBe(600); // default
  });
});

describe('buildOverride — IDesktopConfig.icon', () => {
  it('sets bundle.icon when desktop.icon is provided (dev mode)', () => {
    const result = buildOverride({
      kind: 'dev',
      app: 'sandbox',
      devUrl: 'http://localhost:3000',
      desktop: { ...baseDesktop, icon: 'src/assets/icon.ico' },
      version: '1.0.0',
    });
    const bundle = result.bundle as Record<string, unknown>;
    expect(bundle.icon).toEqual(['src/assets/icon.ico']);
  });

  it('sets bundle.icon when desktop.icon is provided (build mode)', () => {
    const result = buildOverride({
      kind: 'build',
      app: 'sandbox',
      dist: '/dist',
      desktop: { ...baseDesktop, icon: 'src/assets/icon.ico' },
      version: '1.0.0',
    });
    const bundle = result.bundle as Record<string, unknown>;
    expect(bundle.icon).toEqual(['src/assets/icon.ico']);
    // bundle.active must still be set in build mode
    expect(bundle.active).toBe(true);
  });

  it('does not set bundle when desktop.icon is absent (dev mode)', () => {
    const result = buildOverride({
      kind: 'dev',
      app: 'sandbox',
      devUrl: 'http://localhost:3000',
      desktop: baseDesktop,
      version: '1.0.0',
    });
    expect(result.bundle).toBeUndefined();
  });
});
