import { describe, expect, it } from 'vitest';
import { exportTheme } from '../editor/export';
import type { ITheme } from '../editor/types';

// exportTheme сериализует ITheme в CSS-блок. copyTheme не тестируем — там
// navigator.clipboard, нужен jsdom + clipboard polyfill.

const mkTheme = (overrides: Partial<ITheme> = {}): ITheme => ({
  mode: 'light',
  primary: 'oklch(0.65 0.18 250)',
  radius: 0.5,
  spacingBase: 0.25,
  fontBaseSize: 1,
  fontFamily: 'Inter, sans-serif',
  ...overrides,
});

describe('exportTheme', () => {
  it('wraps light mode in :root selector', () => {
    const css = exportTheme(mkTheme({ mode: 'light' }));
    expect(css.startsWith(':root {')).toBe(true);
    expect(css.endsWith('}')).toBe(true);
  });

  it('wraps dark mode in .dark selector', () => {
    const css = exportTheme(mkTheme({ mode: 'dark' }));
    expect(css.startsWith('.dark {')).toBe(true);
  });

  it('emits --primary as raw oklch string', () => {
    const css = exportTheme(mkTheme({ primary: 'oklch(0.65 0.18 250)' }));
    expect(css).toContain('--primary: oklch(0.65 0.18 250);');
  });

  it('emits --primary-foreground via contrastForeground (light primary → dark fg)', () => {
    const css = exportTheme(mkTheme({ primary: 'oklch(0.8 0.1 60)' }));
    expect(css).toContain('--primary-foreground: oklch(0.145 0 0);');
  });

  it('--ring is duplicated from --primary', () => {
    const css = exportTheme(mkTheme({ primary: 'oklch(0.4 0.2 100)' }));
    expect(css).toContain('--ring: oklch(0.4 0.2 100);');
  });

  it('numeric fields get rem suffix', () => {
    const css = exportTheme(mkTheme({ radius: 0.75, spacingBase: 0.3, fontBaseSize: 1.125 }));
    expect(css).toContain('--radius: 0.75rem;');
    expect(css).toContain('--spacing-base: 0.3rem;');
    expect(css).toContain('--text-base-size: 1.125rem;');
  });

  it('emits font-family without rem/quote transformation', () => {
    const css = exportTheme(mkTheme({ fontFamily: '"JetBrains Mono", monospace' }));
    expect(css).toContain('font-family: "JetBrains Mono", monospace;');
  });
});
