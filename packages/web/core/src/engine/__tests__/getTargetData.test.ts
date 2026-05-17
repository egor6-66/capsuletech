import { describe, expect, it } from 'vitest';
import { type AnyEvent, getTargetData } from '../derivation';

/**
 * `getTargetData` собирает payload, который ControllerProxy и handlers
 * получают как `target` на каждое UI-событие. Контракт фиксированный — изменения
 * тут означают breaking для всех Controller'ов на проекте.
 */

const makeEvent = (overrides: Partial<AnyEvent>): AnyEvent =>
  ({
    type: 'click',
    ...overrides,
  }) as unknown as AnyEvent;

const makeEl = (overrides: Record<string, unknown>) => ({ ...overrides });

describe('getTargetData — name resolution', () => {
  it('prefers DOM element name over derivedName/props', () => {
    const e = makeEvent({ currentTarget: makeEl({ name: 'from-dom' }) });
    const data = getTargetData(e, { name: 'from-props' }, 'derived');
    expect(data.name).toBe('from-dom');
  });

  it('falls back to derivedName when DOM name is missing', () => {
    const e = makeEvent({ currentTarget: makeEl({}) });
    const data = getTargetData(e, { name: 'from-props' }, 'derived');
    expect(data.name).toBe('derived');
  });

  it('falls back to props.name when DOM and derived are absent', () => {
    const e = makeEvent({ currentTarget: makeEl({}) });
    const data = getTargetData(e, { name: 'from-props' });
    expect(data.name).toBe('from-props');
  });

  it('returns undefined when no source has a name', () => {
    const e = makeEvent({ currentTarget: makeEl({}) });
    const data = getTargetData(e, {});
    expect(data.name).toBeUndefined();
  });
});

describe('getTargetData — value resolution', () => {
  it('returns el.value for text-like inputs', () => {
    const e = makeEvent({ currentTarget: makeEl({ type: 'text', value: 'hello' }) });
    expect(getTargetData(e, {}).value).toBe('hello');
  });

  it('returns el.checked for checkbox inputs', () => {
    const e = makeEvent({ currentTarget: makeEl({ type: 'checkbox', checked: true }) });
    expect(getTargetData(e, {}).value).toBe(true);
  });

  it('returns false for unchecked checkbox', () => {
    const e = makeEvent({ currentTarget: makeEl({ type: 'checkbox', checked: false }) });
    expect(getTargetData(e, {}).value).toBe(false);
  });

  it('falls back to props.value when el has no value', () => {
    const e = makeEvent({ currentTarget: makeEl({ type: 'button' }) });
    expect(getTargetData(e, { value: 'fallback' }).value).toBe('fallback');
  });

  it('treats empty-string el.value as a valid value (not nullish)', () => {
    const e = makeEvent({ currentTarget: makeEl({ type: 'text', value: '' }) });
    expect(getTargetData(e, { value: 'props-fallback' }).value).toBe('');
  });
});

describe('getTargetData — meta / dynamicMeta / payload', () => {
  it('takes meta from JSX props (not from DOM attribute)', () => {
    // A-5 regression: never call el.getAttribute('meta') — Solid does not
    // serialise objects to attributes.
    const propsMeta = { tags: ['email'] };
    const e = makeEvent({
      currentTarget: { getAttribute: () => '[object Object]' } as unknown as EventTarget,
    });
    expect(getTargetData(e, { meta: propsMeta }).meta).toBe(propsMeta);
  });

  it('passes dynamicMeta from props through unchanged', () => {
    const dyn = { tags: ['@scope'] };
    const data = getTargetData(makeEvent({}), { dynamicMeta: dyn });
    expect(data.dynamicMeta).toBe(dyn);
  });

  it('passes payload from props through unchanged', () => {
    const payload = { href: '/x' };
    const data = getTargetData(makeEvent({}), { payload });
    expect(data.payload).toBe(payload);
  });
});

describe('getTargetData — keyboard / modifiers', () => {
  it('captures key from event', () => {
    const e = makeEvent({ key: 'Enter' });
    expect(getTargetData(e, {}).key).toBe('Enter');
  });

  it('captures modifier booleans', () => {
    const e = makeEvent({ ctrlKey: true, shiftKey: true });
    expect(getTargetData(e, {}).modifiers).toEqual({
      ctrl: true,
      shift: true,
      alt: false,
      meta: false,
    });
  });

  it('returns modifiers = undefined when no event provided', () => {
    expect(getTargetData(undefined, {}).modifiers).toBeUndefined();
  });
});

describe('getTargetData — no event (lifecycle calls)', () => {
  it('still works with undefined event (returns props-based target)', () => {
    const data = getTargetData(undefined, { name: 'p', value: 'v', meta: { tags: ['t'] } });
    expect(data).toMatchObject({
      name: 'p',
      value: 'v',
      meta: { tags: ['t'] },
      type: undefined,
      key: undefined,
      modifiers: undefined,
    });
  });
});
