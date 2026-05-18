import { describe, expect, it, vi } from 'vitest';
import { wrap } from '../types';

// wrap(raw) — pure обёртка над TanStack-роутером (AnyRouter), вынесена в types.ts
// без value-импорта @tanstack/solid-router. Благодаря этому покрывается в
// node-env без jsdom.
//
// Сам createRouter() тут не тестируется: он value-импортит @tanstack/solid-router,
// который тянет клиентские Solid-API (CatchBoundary и т.п.) и падает в node.
// Интеграция createRouter <-> wrap тривиальна — её держит apps/*/bootstrap.tsx
// как end-to-end smoke.

const mkRaw = (overrides: Partial<any> = {}) => {
  const navigate = vi.fn();
  const historyBack = vi.fn();
  const raw = {
    navigate,
    state: { location: { pathname: '/cur' } },
    history: { back: historyBack },
    options: { context: {} },
    ...overrides,
  } as any;
  return { raw, navigate, historyBack };
};

describe('wrap — shape', () => {
  it('returns ICapsuleRouter with goTo/back/current/raw', () => {
    const { raw } = mkRaw();
    const w = wrap(raw);
    expect(typeof w.goTo).toBe('function');
    expect(typeof w.back).toBe('function');
    expect(typeof w.current).toBe('function');
    expect(w.raw).toBe(raw);
  });
});

describe('wrap — goTo', () => {
  // С ADR 014 второй аргумент — options-объект:
  //   { params?, search?, hash?, replace? }
  // Все поля прямо мапятся в raw.navigate({ to, ...opts }).

  it('delegates to raw.navigate with just { to } when no opts', () => {
    const { raw, navigate } = mkRaw();
    wrap(raw).goTo('/bar');
    expect(navigate).toHaveBeenCalledWith({ to: '/bar' });
  });

  it('forwards params via opts.params', () => {
    const { raw, navigate } = mkRaw();
    wrap(raw).goTo('/users/:id', { params: { id: 42 } });
    expect(navigate).toHaveBeenCalledWith({ to: '/users/:id', params: { id: 42 } });
  });

  it('forwards search query', () => {
    const { raw, navigate } = mkRaw();
    wrap(raw).goTo('/items', { search: { tag: 'urgent', sort: 'date' } });
    expect(navigate).toHaveBeenCalledWith({
      to: '/items',
      search: { tag: 'urgent', sort: 'date' },
    });
  });

  it('forwards hash', () => {
    const { raw, navigate } = mkRaw();
    wrap(raw).goTo('/docs', { hash: 'section-3' });
    expect(navigate).toHaveBeenCalledWith({ to: '/docs', hash: 'section-3' });
  });

  it('forwards replace flag', () => {
    const { raw, navigate } = mkRaw();
    wrap(raw).goTo('/login', { replace: true });
    expect(navigate).toHaveBeenCalledWith({ to: '/login', replace: true });
  });

  it('combines all opts in one call', () => {
    const { raw, navigate } = mkRaw();
    wrap(raw).goTo('/orgs/:slug/items', {
      params: { slug: 'acme' },
      search: { q: 'laptop' },
      hash: 'top',
      replace: true,
    });
    expect(navigate).toHaveBeenCalledWith({
      to: '/orgs/:slug/items',
      params: { slug: 'acme' },
      search: { q: 'laptop' },
      hash: 'top',
      replace: true,
    });
  });

  it('does not throw on empty path', () => {
    const { raw, navigate } = mkRaw();
    expect(() => wrap(raw).goTo('')).not.toThrow();
    expect(navigate).toHaveBeenCalledWith({ to: '' });
  });
});

describe('wrap — back', () => {
  it('delegates to raw.history.back (не window.history напрямую)', () => {
    const { raw, historyBack } = mkRaw();
    wrap(raw).back();
    expect(historyBack).toHaveBeenCalledOnce();
  });
});

describe('wrap — current', () => {
  it('returns raw.state.location.pathname', () => {
    const { raw } = mkRaw();
    expect(wrap(raw).current()).toBe('/cur');
  });

  it('reads pathname dynamically (не закешировано)', () => {
    const { raw } = mkRaw();
    const w = wrap(raw);
    expect(w.current()).toBe('/cur');
    raw.state.location.pathname = '/next';
    expect(w.current()).toBe('/next');
  });
});
