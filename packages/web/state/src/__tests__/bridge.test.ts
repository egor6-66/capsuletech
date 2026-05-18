import { describe, expect, it, vi } from 'vitest';
import { createBridge } from '../bridge';
import { clearAliases, registerAliases } from '../tag-registry';

/**
 * `createBridge(state, send)` оборачивает XState-snapshot в reactive-API,
 * который видят Controller/Feature handlers (`store`).
 *
 * Контракт:
 *  - getters (ctx, loading, styles, errors, components, props) — pass-through
 *    из `state.context.*`, с {} fallback для undefined.
 *  - mutations — отправляют корректный XState event.
 *  - tag-операции (pick/omit/match/matchEntry/patch) — работают над
 *    `state.context.components`.
 */

const mkState = (context: Record<string, unknown> = {}) => ({ context });

describe('createBridge — getters', () => {
  it('ctx returns state.context', () => {
    const state = mkState({ data: { foo: 1 } });
    expect(createBridge(state, vi.fn()).ctx).toBe(state.context);
  });

  it('loading reads context.loading', () => {
    expect(createBridge(mkState({ loading: true }), vi.fn()).loading).toBe(true);
  });

  it.each([
    ['styles', { btn: 'red' }],
    ['errors', { email: 'invalid' }],
    ['components', { 'id-1': { meta: { tags: ['x'] } } }],
    ['props', { 'id-1': { active: true } }],
  ])('%s returns context.%s', (field, value) => {
    const bridge = createBridge(mkState({ [field]: value }), vi.fn());
    expect(bridge[field as keyof typeof bridge]).toEqual(value);
  });

  it.each([
    'styles',
    'errors',
    'components',
    'props',
  ])('%s defaults to {} when missing from context', (field) => {
    const bridge = createBridge(mkState({}), vi.fn());
    expect(bridge[field as keyof typeof bridge]).toEqual({});
  });
});

describe('createBridge — mutations', () => {
  it('update sends SET_DATA event', () => {
    const send = vi.fn();
    createBridge(mkState(), send).update({ foo: 1 });
    expect(send).toHaveBeenCalledWith({ type: 'SET_DATA', payload: { foo: 1 } });
  });

  it('setLoading sends SET_LOADING', () => {
    const send = vi.fn();
    createBridge(mkState(), send).setLoading(true);
    expect(send).toHaveBeenCalledWith({ type: 'SET_LOADING', value: true });
  });

  it('setStyles sends SET_STYLES', () => {
    const send = vi.fn();
    createBridge(mkState(), send).setStyles({ btn: 'red' });
    expect(send).toHaveBeenCalledWith({ type: 'SET_STYLES', styles: { btn: 'red' } });
  });

  it('setErrors sends SET_ERRORS', () => {
    const send = vi.fn();
    createBridge(mkState(), send).setErrors({ email: 'invalid' });
    expect(send).toHaveBeenCalledWith({ type: 'SET_ERRORS', errors: { email: 'invalid' } });
  });

  it('setProps sends SET_PROPS', () => {
    const send = vi.fn();
    createBridge(mkState(), send).setProps({ id1: { active: true } });
    expect(send).toHaveBeenCalledWith({
      type: 'SET_PROPS',
      payload: { id1: { active: true } },
    });
  });

  it('registerComponent sends REGISTER_COMPONENT', () => {
    const send = vi.fn();
    createBridge(mkState(), send).registerComponent({ 'id-1': { meta: {} } });
    expect(send).toHaveBeenCalledWith({
      type: 'REGISTER_COMPONENT',
      payload: { 'id-1': { meta: {} } },
    });
  });

  it('unregisterComponent sends UNREGISTER_COMPONENT', () => {
    const send = vi.fn();
    createBridge(mkState(), send).unregisterComponent('id-1');
    expect(send).toHaveBeenCalledWith({ type: 'UNREGISTER_COMPONENT', id: 'id-1' });
  });
});

describe('createBridge — tag operations', () => {
  const components = {
    a: { meta: { tags: ['email'] } },
    b: { meta: { tags: ['nav'] } },
    c: { meta: { tags: ['password'] } },
  };

  it('pick filters components by tags', () => {
    const bridge = createBridge(mkState({ components }), vi.fn());
    expect(bridge.pick(['email'])).toEqual({ a: components.a });
  });

  it('omit returns non-matching components', () => {
    const bridge = createBridge(mkState({ components }), vi.fn());
    expect(bridge.omit(['email', 'password'])).toEqual({ b: components.b });
  });

  it('match returns first matching component', () => {
    const bridge = createBridge(mkState({ components }), vi.fn());
    expect(bridge.match(['nav'])).toBe(components.b);
  });

  it('matchEntry returns first match with its id', () => {
    const bridge = createBridge(mkState({ components }), vi.fn());
    expect(bridge.matchEntry(['nav'])).toMatchObject({ id: 'b', meta: { tags: ['nav'] } });
  });
});

describe('createBridge — patch (tag-based mutator)', () => {
  it('applies object patch to all matched components', () => {
    const send = vi.fn();
    const bridge = createBridge(
      mkState({
        components: {
          a: { meta: { tags: ['email'] } },
          b: { meta: { tags: ['nav'] } },
          c: { meta: { tags: ['email'] } },
        },
      }),
      send,
    );

    bridge.patch(['email'], { disabled: true });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith({
      type: 'SET_PROPS',
      payload: {
        a: { disabled: true },
        c: { disabled: true },
      },
    });
  });

  it('applies function patch per-component', () => {
    const send = vi.fn();
    const components = {
      a: { meta: { tags: ['nav'] }, payload: { href: '/x' } },
      b: { meta: { tags: ['nav'] }, payload: { href: '/y' } },
    };
    const bridge = createBridge(mkState({ components }), send);

    bridge.patch(['nav'], (comp) => ({
      active: (comp.payload as { href: string }).href === '/x',
    }));

    expect(send).toHaveBeenCalledWith({
      type: 'SET_PROPS',
      payload: {
        a: { active: true },
        b: { active: false },
      },
    });
  });

  it('skips components with falsy/empty per-fn patch', () => {
    const send = vi.fn();
    const bridge = createBridge(
      mkState({
        components: {
          a: { meta: { tags: ['x'] } },
          b: { meta: { tags: ['x'] } },
        },
      }),
      send,
    );

    bridge.patch(['x'], (_, id) => (id === 'a' ? { ok: true } : null));
    expect(send).toHaveBeenCalledWith({
      type: 'SET_PROPS',
      payload: { a: { ok: true } },
    });
  });

  it('does not send when there are no matches', () => {
    const send = vi.fn();
    const bridge = createBridge(mkState({ components: { a: { meta: { tags: ['x'] } } } }), send);
    bridge.patch(['y'], { ok: true });
    expect(send).not.toHaveBeenCalled();
  });

  it('does not send when all per-fn patches return empty', () => {
    const send = vi.fn();
    const bridge = createBridge(mkState({ components: { a: { meta: { tags: ['x'] } } } }), send);
    bridge.patch(['x'], () => ({}));
    expect(send).not.toHaveBeenCalled();
  });
});

describe('createBridge — alias expansion in tag ops', () => {
  it('pick(["@inputs"]) expands via tag-registry', () => {
    // Register a custom alias to confirm expansion goes through tag-registry.
    clearAliases();
    registerAliases({ '@form': ['email', 'submit'] });

    const components = {
      a: { meta: { tags: ['email'] } },
      b: { meta: { tags: ['nav'] } },
      c: { meta: { tags: ['submit'] } },
    };
    const bridge = createBridge(mkState({ components }), vi.fn());
    expect(bridge.pick(['@form'])).toEqual({ a: components.a, c: components.c });

    // Restore defaults for other tests.
    clearAliases();
    registerAliases({
      '@inputs': ['email', 'password', 'phone', 'text', 'number'],
      '@actions': ['submit', 'cancel', 'reset'],
    });
  });
});
