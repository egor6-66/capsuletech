import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IDefineStateSchema, ITarget } from '../../wrappers/interfaces';
import { ControllerProxy } from '../controller-proxy';

/**
 * ControllerProxy — диспетчер вызовов `controller.<method>(target, ctx)`.
 *
 * Контракт:
 *  1. Sys-поле `store` отдаётся напрямую (без proxy-вызова).
 *  2. Поиск handler'а: `schema.states[currentState][method]` → `schema[method]`
 *     (top-level fallback) → `next()` auto-bubble к parent.
 *  3. `next()` — пассивный bubble: `target.payload` сохраняется (JSX-immutable),
 *     `target.from` сбрасывается в undefined.
 *     `next.with(arg)` — bubble с `target.from = arg` у родителя.
 *     Имя метода у родителя = `overrides[method] ?? method`.
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
      controller: { onClick: parentHandler } as any,
      state: makeState('parent-state'),
      store: {} as any,
    };

    const ctl = ControllerProxy({
      schema: makeSchema({ states: { idle: {} } }),
      state: makeState('idle'),
      send: vi.fn(),
      store: makeStore(),
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

describe('ControllerProxy — next() bubbling (passive)', () => {
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
      parent: { controller: { onClick: parentHandler } as any } as any,
    });

    expect(await ctl.onClick({ name: 'x' }, {})).toBe('from-parent');
  });

  it('next() preserves target.payload as JSX-immutable', async () => {
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
        } as any,
      } as any,
    });

    await ctl.onClick({ name: 'btn', payload: 'jsx-original' }, {});
    expect((received as ITarget | null)?.payload).toBe('jsx-original');
  });

  it('next() resets target.from to undefined (strict — explicit signal only)', async () => {
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
        } as any,
      } as any,
    });

    // даже если target пришёл с from (от child'а), pure next() сбрасывает его —
    // parent видит from=undefined, потому что ЭТОТ уровень ничего не передаёт явно.
    await ctl.onClick({ name: 'btn', from: { childArg: true } }, {});
    expect((received as ITarget | null)?.from).toBeUndefined();
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
      parent: { controller: {} as any } as any,
    });

    expect(await ctl.onClick(ITarget_EMPTY, {})).toBeNull();
  });
});

describe('ControllerProxy — next.with(arg) bubbling (explicit)', () => {
  it('next.with(arg) sets target.from = arg for parent', async () => {
    let received: ITarget | null = null;
    const schema = makeSchema({
      states: {
        idle: {
          onClick: async ({ next }) => {
            await next.with({ enriched: true });
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
        } as any,
      } as any,
    });

    await ctl.onClick({ name: 'btn', payload: 'jsx' }, {});
    expect((received as ITarget | null)?.from).toEqual({ enriched: true });
    // payload остаётся JSX-immutable
    expect((received as ITarget | null)?.payload).toBe('jsx');
    expect((received as ITarget | null)?.name).toBe('btn');
  });

  it('next.with(arg) does NOT mutate target.payload (immutability invariant)', async () => {
    let received: ITarget | null = null;
    const schema = makeSchema({
      states: {
        idle: {
          onClick: async ({ next }) => {
            await next.with('signal-to-parent');
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
        } as any,
      } as any,
    });

    await ctl.onClick({ name: 'btn', payload: { original: true } }, {});
    expect((received as ITarget | null)?.payload).toEqual({ original: true });
    expect((received as ITarget | null)?.from).toBe('signal-to-parent');
  });

  it('next.with(undefined) still bubbles but sets from=undefined (explicit clear)', async () => {
    let received: ITarget | null = null;
    const schema = makeSchema({
      states: {
        idle: {
          onClick: async ({ next }) => {
            await next.with(undefined);
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
        } as any,
      } as any,
    });

    await ctl.onClick({ name: 'btn' }, {});
    expect(received).not.toBeNull();
    expect((received as ITarget | null)?.from).toBeUndefined();
  });

  it('next.with() respects overrides like next() does', async () => {
    const parentSubmit = vi.fn(async () => 'ok');
    const schema = makeSchema({
      states: {
        idle: {
          onClick: async ({ next }) => await next.with({ k: 1 }),
        },
      },
    });
    const ctl = ControllerProxy({
      schema,
      state: makeState('idle'),
      send: vi.fn(),
      store: makeStore(),
      parent: { controller: { submit: parentSubmit } as any } as any,
      overrides: { onClick: 'submit' },
    });

    expect(await ctl.onClick(ITarget_EMPTY, {})).toBe('ok');
    expect(parentSubmit).toHaveBeenCalledOnce();
    const [t] = parentSubmit.mock.calls[0] as [ITarget, unknown];
    expect(t.from).toEqual({ k: 1 });
  });

  it('next.with() returns null if no parent', async () => {
    const schema = makeSchema({
      states: {
        idle: {
          onClick: async ({ next }) => await next.with('x'),
        },
      },
    });
    const ctl = ControllerProxy({
      schema,
      state: makeState('idle'),
      send: vi.fn(),
      store: makeStore(),
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

describe('ControllerProxy — schema.onError hook', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => {
    errorSpy.mockRestore();
  });

  it('fires onError with { error, method, target, context, store, state, next } before re-throw', async () => {
    const onError = vi.fn();
    const error = new Error('handler exploded');
    const schema = makeSchema({
      states: {
        idle: {
          onClick: () => {
            throw error;
          },
        },
      },
      onError,
    });
    const ctl = ControllerProxy({
      schema,
      state: makeState('idle'),
      send: vi.fn(),
      store: makeStore(),
    });

    await expect(ctl.onClick({ name: 't' }, { ctxKey: 1 })).rejects.toThrow('handler exploded');
    expect(onError).toHaveBeenCalledOnce();
    const arg = onError.mock.calls[0][0];
    expect(arg.error).toBe(error);
    expect(arg.method).toBe('onClick');
    expect(arg.target).toEqual({ name: 't' });
    expect(arg.context).toEqual({ ctxKey: 1 });
    expect(typeof arg.next).toBe('function');
    expect(typeof arg.next.with).toBe('function');
    expect(typeof arg.state.set).toBe('function');
    expect(arg.store).toBeDefined();
  });

  it('still re-throws original error even when onError absorbs it', async () => {
    const error = new Error('boom');
    const schema = makeSchema({
      states: {
        idle: {
          onClick: () => {
            throw error;
          },
        },
      },
      onError: vi.fn(),
    });
    const ctl = ControllerProxy({
      schema,
      state: makeState('idle'),
      send: vi.fn(),
      store: makeStore(),
    });
    await expect(ctl.onClick(ITarget_EMPTY, {})).rejects.toThrow('boom');
  });

  it('sync throw inside onError is logged but does not mask the original error', async () => {
    const original = new Error('original');
    const schema = makeSchema({
      states: {
        idle: {
          onClick: () => {
            throw original;
          },
        },
      },
      onError: () => {
        throw new Error('onError-burst');
      },
    });
    const ctl = ControllerProxy({
      schema,
      state: makeState('idle'),
      send: vi.fn(),
      store: makeStore(),
    });
    await expect(ctl.onClick(ITarget_EMPTY, {})).rejects.toThrow('original');
    // оба упоминания: и handler-ошибка, и onError-ошибка залогированы
    expect(errorSpy).toHaveBeenCalled();
  });

  it('async reject inside onError is logged via .catch and does not throw', async () => {
    const original = new Error('original-async');
    const onErrorAsync = vi.fn(async () => {
      throw new Error('onError-async-boom');
    });
    const schema = makeSchema({
      states: {
        idle: {
          onClick: async () => {
            throw original;
          },
        },
      },
      onError: onErrorAsync,
    });
    const ctl = ControllerProxy({
      schema,
      state: makeState('idle'),
      send: vi.fn(),
      store: makeStore(),
    });

    await expect(ctl.onClick(ITarget_EMPTY, {})).rejects.toThrow('original-async');
    expect(onErrorAsync).toHaveBeenCalledOnce();
    // подожди .catch цикла
    await Promise.resolve();
    await Promise.resolve();
    expect(errorSpy).toHaveBeenCalled();
  });

  it('does not fire onError if there is no error', async () => {
    const onError = vi.fn();
    const schema = makeSchema({
      states: { idle: { onClick: async () => 'ok' } },
      onError,
    });
    const ctl = ControllerProxy({
      schema,
      state: makeState('idle'),
      send: vi.fn(),
      store: makeStore(),
    });
    expect(await ctl.onClick(ITarget_EMPTY, {})).toBe('ok');
    expect(onError).not.toHaveBeenCalled();
  });
});
