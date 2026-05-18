import { describe, expect, it } from 'vitest';
import { contrastForeground, formatOklch, parseOklch } from '../editor/oklch';

// Pure-helpers для OKLCH-color-space.

describe('parseOklch', () => {
  it('parses standard format "oklch(L C H)"', () => {
    expect(parseOklch('oklch(0.65 0.18 250)')).toEqual({ l: 0.65, c: 0.18, h: 250 });
  });

  it('tolerates extra whitespace', () => {
    expect(parseOklch('  oklch( 0.5  0.1  120 )  ')).toEqual({ l: 0.5, c: 0.1, h: 120 });
  });

  it('case-insensitive (matches OKLCH and oklch)', () => {
    expect(parseOklch('OKLCH(0.7 0.2 60)')).toEqual({ l: 0.7, c: 0.2, h: 60 });
  });

  it('returns black-ish fallback for invalid input', () => {
    expect(parseOklch('rgb(255,0,0)')).toEqual({ l: 0.5, c: 0, h: 0 });
    expect(parseOklch('')).toEqual({ l: 0.5, c: 0, h: 0 });
    expect(parseOklch('oklch(missing)')).toEqual({ l: 0.5, c: 0, h: 0 });
  });

  it('parses integer values too', () => {
    expect(parseOklch('oklch(1 0 0)')).toEqual({ l: 1, c: 0, h: 0 });
  });
});

describe('formatOklch', () => {
  it('formats with fixed precision (3/3/1)', () => {
    expect(formatOklch({ l: 0.65, c: 0.18, h: 250 })).toBe('oklch(0.650 0.180 250.0)');
  });

  it('rounds floats to expected precision', () => {
    expect(formatOklch({ l: 0.12345, c: 0.1, h: 99.99 })).toBe('oklch(0.123 0.100 100.0)');
  });

  it('round-trips parseOklch(formatOklch(x)) ≈ x', () => {
    const x = { l: 0.65, c: 0.18, h: 250 };
    expect(parseOklch(formatOklch(x))).toEqual(x);
  });
});

describe('contrastForeground', () => {
  it('returns light foreground for dark primary (l < 0.5)', () => {
    expect(contrastForeground('oklch(0.2 0.1 250)')).toBe('oklch(0.985 0 0)');
  });

  it('returns dark foreground for light primary (l >= 0.5)', () => {
    expect(contrastForeground('oklch(0.8 0.1 250)')).toBe('oklch(0.145 0 0)');
  });

  it('boundary l=0.5 → dark (>= 0.5 branch)', () => {
    expect(contrastForeground('oklch(0.5 0.1 250)')).toBe('oklch(0.145 0 0)');
  });

  it('invalid input → uses fallback l=0.5 → dark', () => {
    expect(contrastForeground('not-a-color')).toBe('oklch(0.145 0 0)');
  });
});
