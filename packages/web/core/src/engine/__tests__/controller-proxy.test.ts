import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IDefineStateSchema, ITarget } from '../../wrappers/interfaces';
import { ControllerProxy } from '../controller-proxy';

/**
 * ControllerProxy — диспетчер вызовов `controller.<method>(target, ctx)`.
 *
 * Контракт:
 *  1. Sys-поля `store`/`destroy` отдаются напрямую (без proxy-вызова).
 *  2. Поиск handler'а: `schema.states[currentState][method]` → `schema[method]`
 *     (top-level fallback) → `next()` auto-bubble к parent.
 *  3. `next(payload?)` делегирует `parent.controller[method]` (или ремап через
 *     `overrides[method]`), обогащая `target.payload`.
 *  4. `state.set(name)` шлёт `__GOTO_<name>__`; `state.matches` сверяет string
 *     или string[].
 *  5. Async-ошибки в handler'е логируются и re-throw'аются (нельзя глотать).
 */

const ITarget_EMPTY: ITarget = {};

const makeState = (value: string) => ({ value });

const makeStore = () => ({ id: 'store-mock' });

/** Минимальный schema-стаб; легко расширяем в каждом тесте. */
const makeSchema = (overrides: Partial<IDefineStateSchema> = {}): IDefineStateSchema => ({
  initial: 'idle',
  states: {},
  ...overrides,
});

describe('ControllerProxy — system fields', () => {
  it('returns the store via .store', () => {
    const store = makeStore();
    const ctl = ControllerProxy({
      schema: makeSchema(),
      state: makeState('idle'),
      send: vi.fn(),
      store,
    });
    expect(ctl.store).toBe(store);
  });

  it('returns a no-op function via .destroy', () => {
    const ctl = ControllerProxy({
      schema: makeSchema(),
      state: makeState('idle'),
      send: vi.fn(),
      store: makeStore(),
    });
    expect(typeof ctl.destroy).toBe('function');
    expect(ctl.destroy()).toBeUndefined();
  });
});

describe('ControllerProxy — method dispatch order', () => {
  it('state-level handler beats top-level', async () => {
    const stateHandler = vi.fn(async () => 'state-result');
    const topHandler = vi.fn(async () => 'top-result');
    const schema = makeSchema({
      states: { idle: { onClick: stateHandler } },
      onClick: topHandler,
    });

    const ctl = ControllerProxy({
      schema,
      state: makeState('idle'),
      send: vi.fn(),
      store: makeStore(),
    });

    const result = await ctl.onClick(ITarget_EMPTY, {});
    expect(result).toBe('state-result');
    expect(stateHandler).toHaveBeenCalledOnce();
    expect(topHandler).not.toHaveBeenCalled();
  });

  it('falls back to top-level handler when state-level missing', async () => {
    const topHandler = vi.fn(async () => 'top-result');
    const schema = makeSchema({
      states: { idle: {} },
      onClick: topHandler,
    });

    const ctl = ControllerProxy({
      schema,
      state: makeState('idle'),
      send: vi.fn(),
      store: makeStore(),
    });

    expect(await ctl.onClick(ITarget_EMPTY, {})).toBe('top-result');
    expect(topHandler).toHaveBeenCalledOnce();
  });

  it('uses the handler for the CURRENT state, not initial', async () => {
    const idleHandler = vi.fn(async () => 'idle');
    const busyHandler = vi.fn(async () => 'busy');
    const schema = makeSchema({
      initial: 'idle',
      states: { idle: { onClick: idleHandler }, busy: { onClick: busyHandler } },
    });

    const ctl = ControllerProxy({
      schema,
      state: makeState('busy'),
      send: vi.fn(),
      store: makeStore(),
    });

    expect(await ctl.onClick(ITarget_EMPTY, {})).toBe('busy');
    expect(idleHandler).not.toHaveBeenCalled();
  });

  it('auto-bubbles to parent when no handler anywhere', async () => {
    const parentHandler = vi.fn(async () => 'from-parent');
    const parent = {
      // biome-ignore lint/suspicious/noExplicitAny: test stub
      controller: { onClick: parentHandler } as any,
      state: makeState('parent-state'),
      // biome-ignore lint/suspicious/noExplicitAny: minimum stub
      store: {} as any,
    };

    const ctl = ControllerProxy({
      schema: makeSchema({ states: { idle: {} } }),
      state: makeState('idle'),
      send: vi.fn(),
      store: makeStore(),
      // biome-ignore lint/suspicious/noExplicitAny: test stub
      parent: parent as any,
    });

    expect(await ctl.onClick(ITarget_EMPTY, {})).toBe('from-parent');
    expect(parentHandler).toHaveBeenCalledOnce();
  });

  it('returns null when no handler and no parent', async () => {
    const ctl = ControllerProxy({
      schema: makeSchema({ states: { idle: {} } }),
      state: makeState('idle'),
      send: vi.fn(),
      store: makeStore(),
    });

    expect(await ctl.onClick(ITarget_EMPTY, {})).toBeNull();
  });
});

describe('ControllerProxy — handler API surface', () => {
  it('passes { target, context, next, store, state } to handler', async () => {
    const target: ITarget = { name: 'submit', value: 'x' };
    const context = { user: 'foo' };
    const store = makeStore();
    let received: unknown = null;
    const schema = makeSchema({
      states: {
        idle: {
          onClick: async (api) => {
            received = api;
            return 'ok';
          },
        },
      },
    });

    const ctl = ControllerProxy({
      schema,
      state: makeState('idle'),
      send: vi.fn(),
      store,
    });

    await ctl.onClick(target, context);
    const api = received as {
      target: ITarget;
      context: unknown;
      next: unknown;
      store: unknown;
      state: { current: string; set: unknown; matches: unknown };
    };
    expect(api.target).toBe(target);
    expect(api.context).toBe(context);
    expect(api.store).toBe(store);
    expect(typeof api.next).toBe('function');
    expect(api.state.current).toBe('idle');
    expect(typeof api.state.set).toBe('function');
    expect(typeof api.state.matches).toBe('function');
  });
});

describe('ControllerProxy — stateApi', () => {
  it('state.current reflects current state value', async () => {
    const schema = makeSchema({
      states: {
        active: {
          onClick: async ({ state }) => state.current,
        },
      },
    });
    const ctl = ControllerProxy({
      schema,
      state: makeState('active'),
      send: vi.fn(),
      store: makeStore(),
    });

    expect(await ctl.onClick(ITarget_EMPTY, {})).toBe('active');
  });

  it('state.set sends __GOTO_<name>__ event', async () => {
    const send = vi.fn();
    const schema = makeSchema({
      states: { idle: { onClick: async ({ state }) => state.set('busy') } },
    });
    const ctl = ControllerProxy({
      schema,
      state: makeState('idle'),
      send,
      store: makeStore(),
    });

    await ctl.onClick(ITarget_EMPTY, {});
    expect(send).toHaveBeenCalledWith({ type: '__GOTO_busy__' });
  });

  it('state.matches accepts single name', async () => {
    let matched = false;
    const schema = makeSchema({
      states: {
        idle: {
          onClick: async ({ state }) => {
            matched = state.matches('idle');
          },
        },
      },
    });
    const ctl = ControllerProxy({
      schema,
      state: makeState('idle'),
      send: vi.fn(),
      store: makeStore(),
    });
    await ctl.onClick(ITarget_EMPTY, {});
    expect(matched).toBe(true);
  });

  it('state.matches accepts array of names (OR-match)', async () => {
    let matched = false;
    const schema = makeSchema({
      states: {
        idle: {
          onClick: async ({ state }) => {
            matched = state.matches(['idle', 'busy']);
          },
        },
      },
    });
    const ctl = ControllerProxy({
      schema,
      state: makeState('idle'),
      send: vi.fn(),
      store: makeStore(),
    });
    await ctl.onClick(ITarget_EMPTY, {});
    expect(matched).toBe(true);
  });

  it('state.matches returns false when no match', async () => {
    let matched = true;
    const schema = makeSchema({
      states: {
        idle: {
          onClick: async ({ state }) => {
            matched = state.matches(['busy', 'done']);
          },
        },
      },
    });
    const ctl = ControllerProxy({
      schema,
      state: makeState('idle'),
      send: vi.fn(),
      store: makeStore(),
    });
    await ctl.onClick(ITarget_EMPTY, {});
    expect(matched).toBe(false);
  });
});

describe('ControllerProxy — next() bubbling', () => {
  it('next() calls parent.controller[method]', async () => {
    const parentHandler = vi.fn(async () => 'from-parent');
    const schema = makeSchema({
      states: {
        idle: {
          onClick: async ({ next }) => {
            return await next();
          },
        },
      },
    });
    const ctl = ControllerProxy({
      schema,
      state: makeState('idle'),
      send: vi.fn(),
      store: makeStore(),
      // biome-ignore lint/suspicious/noExplicitAny: test stub
      parent: { controller: { onClick: parentHandler } as any } as any,
    });

    expect(await ctl.onClick({ name: 'x' }, {})).toBe('from-parent');
  });

  it('next(payload) enriches target.payload before calling parent', async () => {
    let received: ITarget | null = null;
    const parentHandler = vi.fn(async (target: ITarget) => {
      received = target;
    });

    const schema = makeSchema({
      states: {
        idle: {
          onClick: async ({ next }) => {
            await next({ enriched: true });
          },
        },
      },
    });

    const ctl = ControllerProxy({
      schema,
      state: makeState('idle'),
      send: vi.fn(),
      store: makeStore(),
      // biome-ignore lint/suspicious/noExplicitAny: test stub
      parent: { controller: { onClick: parentHandler } as any } as any,
    });

    await ctl.onClick({ name: 'btn', payload: { original: true } }, {});
    expect((received as ITarget | null)?.payload).toEqual({ enriched: true });
    expect((received as ITarget | null)?.name).toBe('btn');
  });

  it('next() without payload keeps original target.payload', async () => {
    let received: ITarget | null = null;
    const schema = makeSchema({
      states: {
        idle: {
          onClick: async ({ next }) => {
            await next();
          },
        },
      },
    });

    const ctl = ControllerProxy({
      schema,
      state: makeState('idle'),
      send: vi.fn(),
      store: makeStore(),
      parent: {
        controller: {
          onClick: async (t: ITarget) => {
            received = t;
          },
          // biome-ignore lint/suspicious/noExplicitAny: stub
        } as any,
        // biome-ignore lint/suspicious/noExplicitAny: stub
      } as any,
    });

    await ctl.onClick({ name: 'btn', payload: 'original' }, {});
    expect((received as ITarget | null)?.payload).toBe('original');
  });

  it('overrides remap method name when bubbling to parent', async () => {
    const parentSubmit = vi.fn(async () => 'submit-result');
    const schema = makeSchema({
      states: {
        idle: {
          onClick: async ({ next }) => await next(),
        },
      },
    });

    const ctl = ControllerProxy({
      schema,
      state: makeState('idle'),
      send: vi.fn(),
      store: makeStore(),
      // biome-ignore lint/suspicious/noExplicitAny: stub
      parent: { controller: { submit: parentSubmit } as any } as any,
      overrides: { onClick: 'submit' },
    });

    expect(await ctl.onClick(ITarget_EMPTY, {})).toBe('submit-result');
    expect(parentSubmit).toHaveBeenCalledOnce();
  });

  it('next() returns null if parent has no matching method', async () => {
    const schema = makeSchema({
      states: {
        idle: {
          onClick: async ({ next }) => await next(),
        },
      },
    });

    const ctl = ControllerProxy({
      schema,
      state: makeState('idle'),
      send: vi.fn(),
      store: makeStore(),
      // biome-ignore lint/suspicious/noExplicitAny: stub
      parent: { controller: {} as any } as any,
    });

    expect(await ctl.onClick(ITarget_EMPTY, {})).toBeNull();
  });
});

describe('ControllerProxy — error handling', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => {
    errorSpy.mockRestore();
  });

  it('logs and rethrows when handler throws synchronously', async () => {
    const error = new Error('boom');
    const schema = makeSchema({
      states: {
        idle: {
          onClick: () => {
            throw error;
          },
        },
      },
    });

    const ctl = ControllerProxy({
      schema,
      state: makeState('idle'),
      send: vi.fn(),
      store: makeStore(),
    });

    await expect(ctl.onClick(ITarget_EMPTY, {})).rejects.toThrow('boom');
    expect(errorSpy).toHaveBeenCalled();
  });

  it('logs and rethrows when handler rejects', async () => {
    const error = new Error('async boom');
    const schema = makeSchema({
      states: {
        idle: {
          onClick: async () => {
            throw error;
          },
        },
      },
    });

    const ctl = ControllerProxy({
      schema,
      state: makeState('idle'),
      send: vi.fn(),
      store: makeStore(),
    });

    await expect(ctl.onClick(ITarget_EMPTY, {})).rejects.toThrow('async boom');
    expect(errorSpy).toHaveBeenCalled();
  });
});
