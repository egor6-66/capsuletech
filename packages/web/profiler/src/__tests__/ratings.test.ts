import { describe, expect, it } from 'vitest';
import { getRating } from '../core/ratings';

describe('ratings', () => {
  it('classifies LCP by Web Vitals thresholds (2500/4000 ms)', () => {
    expect(getRating('lcp', 1000).label).toBe('good');
    expect(getRating('lcp', 3000).label).toBe('needs-improvement');
    expect(getRating('lcp', 5000).label).toBe('poor');
  });

  it('classifies CLS by 0.1/0.25 thresholds', () => {
    expect(getRating('cls', 0.05).label).toBe('good');
    expect(getRating('cls', 0.2).label).toBe('needs-improvement');
    expect(getRating('cls', 0.5).label).toBe('poor');
  });

  it('inverts comparison for fps (higher is better)', () => {
    expect(getRating('fps', 60).label).toBe('good');
    expect(getRating('fps', 40).label).toBe('needs-improvement');
    expect(getRating('fps', 10).label).toBe('poor');
  });

  it('returns info for unknown ids', () => {
    expect(getRating('custom.unknown' as never, 42).label).toBe('info');
    expect(getRating('user.mark', 1).label).toBe('info');
  });

  it('returns info for non-numeric values', () => {
    expect(getRating('connection', '4g').label).toBe('info');
  });
});
