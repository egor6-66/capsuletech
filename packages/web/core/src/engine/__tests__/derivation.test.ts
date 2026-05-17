import { describe, expect, it } from 'vitest';
import { TAG_TO_INPUT_TYPE, deriveInputType, deriveName } from '../derivation';

/**
 * Pure-helpers UiProxy:
 *  - `deriveName`         — выбор первого «конкретного» (не-`@`) тега из `meta.tags`.
 *  - `deriveInputType`    — маппинг тегов → DOM input.type (closed set).
 *
 * Регрессии тут проявятся как сломанная form-data (отсутствие `name`) или
 * неправильный input-type на live-полях — это пользователь ловит сразу. Тесты
 * пинают контракт раньше.
 */

describe('deriveName', () => {
  it('returns first tag that does not start with @', () => {
    expect(deriveName({ tags: ['email', 'submit'] })).toBe('email');
  });

  it('skips @-prefixed alias tags', () => {
    expect(deriveName({ tags: ['@login-form', 'email'] })).toBe('email');
  });

  it('returns undefined for all-alias array', () => {
    expect(deriveName({ tags: ['@login-form', '@header'] })).toBeUndefined();
  });

  it('returns undefined for empty tags', () => {
    expect(deriveName({ tags: [] })).toBeUndefined();
  });

  it('returns undefined when tags is missing', () => {
    expect(deriveName({})).toBeUndefined();
  });

  it('returns undefined when meta is undefined', () => {
    expect(deriveName(undefined)).toBeUndefined();
  });

  it('returns undefined when meta is null', () => {
    expect(deriveName(null)).toBeUndefined();
  });

  it('ignores non-string entries (defensive)', () => {
    // .find returns first truthy match; non-strings shouldn't match either branch
    expect(deriveName({ tags: [123 as never, 'submit'] })).toBe('submit');
  });
});

describe('deriveInputType', () => {
  it.each([
    ['password', 'password'],
    ['email', 'email'],
    ['phone', 'tel'],
    ['number', 'number'],
    ['text', 'text'],
  ])('maps tag "%s" → input type "%s"', (tag, expected) => {
    expect(deriveInputType({ tags: [tag] })).toBe(expected);
  });

  it('returns first matched mapping when multiple known tags present', () => {
    expect(deriveInputType({ tags: ['email', 'password'] })).toBe('email');
  });

  it('returns undefined for unknown tags only', () => {
    expect(deriveInputType({ tags: ['submit', 'nav'] })).toBeUndefined();
  });

  it('returns undefined for empty tags', () => {
    expect(deriveInputType({ tags: [] })).toBeUndefined();
  });

  it('returns undefined for missing meta', () => {
    expect(deriveInputType(undefined)).toBeUndefined();
    expect(deriveInputType({})).toBeUndefined();
  });

  it('handles @-alias tags without matching them as input types', () => {
    // @-aliases never appear in TAG_TO_INPUT_TYPE map.
    expect(deriveInputType({ tags: ['@email', 'submit'] })).toBeUndefined();
  });
});

describe('TAG_TO_INPUT_TYPE — closed set guarantee', () => {
  it('locks the public mapping (regression guard)', () => {
    // Если изменили map — это break-API для пользователей tag-driven форм.
    // Тест требует осознанного апдейта.
    expect(TAG_TO_INPUT_TYPE).toEqual({
      password: 'password',
      email: 'email',
      phone: 'tel',
      number: 'number',
      text: 'text',
    });
  });
});
