import { describe, expect, it } from 'vitest';
import { createUiTracker, getTrackerPath, resolveByPath } from '../ui-tracker';

/**
 * Path-tracker для Shape factory.
 *
 * Контракт:
 *  - `createUiTracker()` возвращает Proxy. Любой property-access накапливает путь.
 *  - `getTrackerPath(x)` извлекает накопленный путь (`undefined`, если это не tracker).
 *  - `resolveByPath(root, path)` ходит по объекту по сегментам.
 *
 * Тесты ловят регрессию резолва `definition.as = ui.Navigation.Item` →
 * `realUi.Navigation.Item` в Shape-wrapper'е.
 */

describe('createUiTracker', () => {
  it('empty tracker has path []', () => {
    expect(getTrackerPath(createUiTracker())).toEqual([]);
  });

  it('single property-access accumulates one segment', () => {
    const t = createUiTracker();
    expect(getTrackerPath(t.Navigation)).toEqual(['Navigation']);
  });

  it('chained property-access accumulates segments in order', () => {
    const t = createUiTracker();
    expect(getTrackerPath(t.Navigation.Item)).toEqual(['Navigation', 'Item']);
  });

  it('deep chains keep accumulating', () => {
    const t = createUiTracker();
    expect(getTrackerPath(t.A.B.C.D)).toEqual(['A', 'B', 'C', 'D']);
  });

  it('does not share state between sibling traversals', () => {
    const t = createUiTracker();
    const a = t.A;
    const b = t.B;
    expect(getTrackerPath(a)).toEqual(['A']);
    expect(getTrackerPath(b)).toEqual(['B']);
  });

  it('does not mutate the original tracker on read', () => {
    const t = createUiTracker();
    void t.X.Y.Z; // read deep chain
    expect(getTrackerPath(t)).toEqual([]);
  });

  it('symbol keys return undefined (not nested trackers)', () => {
    const t = createUiTracker();
    const sym = Symbol('foo');
    expect((t as unknown as Record<symbol, unknown>)[sym]).toBeUndefined();
  });
});

describe('getTrackerPath', () => {
  it('returns undefined for primitives', () => {
    expect(getTrackerPath(undefined)).toBeUndefined();
    expect(getTrackerPath(null)).toBeUndefined();
    expect(getTrackerPath(42)).toBeUndefined();
    expect(getTrackerPath('hello')).toBeUndefined();
    expect(getTrackerPath(true)).toBeUndefined();
  });

  it('returns undefined for plain objects', () => {
    expect(getTrackerPath({})).toBeUndefined();
    expect(getTrackerPath({ A: { B: 1 } })).toBeUndefined();
  });

  it('returns undefined for non-tracker functions', () => {
    expect(getTrackerPath(() => undefined)).toBeUndefined();
  });

  it('returns path for tracker', () => {
    expect(getTrackerPath(createUiTracker())).toEqual([]);
    expect(getTrackerPath(createUiTracker().A.B)).toEqual(['A', 'B']);
  });
});

describe('resolveByPath', () => {
  const tree = {
    Navigation: {
      Item: 'NAV_ITEM',
      List: 'NAV_LIST',
    },
    Card: { Header: 'CARD_HEADER' },
    deep: { a: { b: { c: 42 } } },
  };

  it('walks a known path', () => {
    expect(resolveByPath(tree, ['Navigation', 'Item'])).toBe('NAV_ITEM');
    expect(resolveByPath(tree, ['Card', 'Header'])).toBe('CARD_HEADER');
  });

  it('returns root for empty path', () => {
    expect(resolveByPath(tree, [])).toBe(tree);
  });

  it('returns undefined for missing segment', () => {
    expect(resolveByPath(tree, ['Unknown'])).toBeUndefined();
    expect(resolveByPath(tree, ['Navigation', 'Bogus'])).toBeUndefined();
  });

  it('returns undefined on null-walk midway', () => {
    expect(resolveByPath({ A: null }, ['A', 'B'])).toBeUndefined();
  });

  it('walks deep paths', () => {
    expect(resolveByPath(tree, ['deep', 'a', 'b', 'c'])).toBe(42);
  });

  it('returns undefined if root is null', () => {
    expect(resolveByPath(null, ['anything'])).toBeUndefined();
  });
});

describe('integration: tracker → path → resolve', () => {
  const realUi = {
    Navigation: {
      Item: 'NAV_ITEM',
      List: 'NAV_LIST',
    },
    Field: { Label: 'FIELD_LABEL' },
  };

  it('reproduces the Shape pattern (`ui.X.Y` → resolveByPath)', () => {
    const tracker = createUiTracker();
    const definitionAs = tracker.Navigation.Item; // captured at factory time
    const path = getTrackerPath(definitionAs);
    expect(path).toEqual(['Navigation', 'Item']);

    const resolved = resolveByPath(realUi, path!);
    expect(resolved).toBe('NAV_ITEM');
  });

  it('Shape-pattern handles missing-leaf gracefully', () => {
    const tracker = createUiTracker();
    const definitionAs = tracker.Navigation.NonExistent;
    const path = getTrackerPath(definitionAs);
    expect(resolveByPath(realUi, path!)).toBeUndefined();
  });
});
