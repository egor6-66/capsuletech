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

describe('integration: Views-namespace — combined ShapeUiContext namespace', () => {
  /**
   * Симулирует combined namespace, который View/Widget/Page кладут в ShapeUiContext:
   *   { ...Ui, Views: getGlobalRegistry('Views') }
   *
   * Shape factory может ссылаться через path-tracker как на Ui primitive (`ui.Field`),
   * так и на View (`ui.Views.Forms.Field`). resolveByPath работает одинаково —
   * просто ходит по dot-path через combined object.
   */
  const MockFormsFieldView = 'MOCK_FORMS_FIELD_VIEW';
  const MockCardView = 'MOCK_CARD_VIEW';

  const combinedNs = {
    // Ui primitives at top level (backward-compat)
    Field: 'UI_FIELD',
    Button: 'UI_BUTTON',
    // Views registry under 'Views' key
    Views: {
      Forms: {
        Field: MockFormsFieldView,
      },
      Card: MockCardView,
    },
  };

  it('backward-compat: ui.Field still resolves to Ui primitive', () => {
    const tracker = createUiTracker();
    const definitionAs = tracker.Field;
    const path = getTrackerPath(definitionAs);
    expect(path).toEqual(['Field']);
    expect(resolveByPath(combinedNs, path!)).toBe('UI_FIELD');
  });

  it('ui.Views.Forms.Field resolves to composite View', () => {
    const tracker = createUiTracker();
    const definitionAs = tracker.Views.Forms.Field;
    const path = getTrackerPath(definitionAs);
    expect(path).toEqual(['Views', 'Forms', 'Field']);
    expect(resolveByPath(combinedNs, path!)).toBe(MockFormsFieldView);
  });

  it('ui.Views.Card resolves to top-level View group entry', () => {
    const tracker = createUiTracker();
    const definitionAs = tracker.Views.Card;
    const path = getTrackerPath(definitionAs);
    expect(path).toEqual(['Views', 'Card']);
    expect(resolveByPath(combinedNs, path!)).toBe(MockCardView);
  });

  it('missing View resolves to undefined without throwing', () => {
    const tracker = createUiTracker();
    const definitionAs = tracker.Views.NonExistent.Deep;
    const path = getTrackerPath(definitionAs);
    expect(resolveByPath(combinedNs, path!)).toBeUndefined();
  });

  it('tracker path for ui.Views.Forms.Field is exactly 3 segments', () => {
    const tracker = createUiTracker();
    expect(getTrackerPath(tracker.Views.Forms.Field)).toEqual(['Views', 'Forms', 'Field']);
  });
});
