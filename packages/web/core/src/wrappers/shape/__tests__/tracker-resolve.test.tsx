/* @vitest-environment jsdom */
/**
 * tracker-resolve.test.tsx — характеризационные тесты для резолва tracker-значений
 * в definitionExtras Shape wrapper'а.
 *
 * Покрытие:
 *  1. `itemAs: ui.Y` в extras → резолвится в realUi.Y component
 *  2. `itemProps: (item) => ({ as: ui.Y })` → при вызове результат содержит resolved Y
 *  3. non-tracker: plain primitive и plain object проходят без изменений
 *  4. callback который НЕ возвращает object → возвращается как есть (pass-through)
 *  5. tracker в extras при отсутствии ShapeUiContext → pass-through (не крашится)
 *  6. `itemAs` resolver не ломает существующий `defaultAs` (as: ui.X) механизм
 */

import { z } from 'zod';
import { render } from 'solid-js/web';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ShapeUiContext } from '../context';
import { createUiTracker } from '../ui-tracker';
import { Shape } from '../wrapper';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

let container: HTMLDivElement;
let cleanup: () => void;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
});

afterEach(() => {
  cleanup?.();
  document.body.removeChild(container);
});

const makeCaptureTemplate = (testId: string) => {
  let captured: Record<string, unknown> = {};
  const Template = (props: Record<string, unknown>) => {
    captured = { ...props };
    return <div data-testid={testId} />;
  };
  const getCapture = () => captured;
  return { Template, getCapture };
};

// ---------------------------------------------------------------------------
// 1. itemAs: ui.Y резолвится в realUi.Y component
// ---------------------------------------------------------------------------

describe('tracker-resolve — itemAs in extras resolves via ShapeUiContext', () => {
  it('itemAs path-tracker resolves to corresponding component from realUi', () => {
    const ButtonComponent = (_props: any) => <button type="button" data-testid="btn" />;

    const fakeUi = { Button: ButtonComponent };
    const tracker = createUiTracker();

    const { Template, getCapture } = makeCaptureTemplate('itemAs-1');

    const MyShape = Shape(() => ({
      schema: z.array(z.string()),
      defaults: [],
      as: Template,
      itemAs: tracker.Button as any,
    }));

    cleanup = render(
      () => (
        <ShapeUiContext.Provider value={fakeUi as any}>
          <MyShape />
        </ShapeUiContext.Provider>
      ),
      container,
    );

    expect(getCapture().itemAs).toBe(ButtonComponent);
  });

  it('nested path tracker (ui.Navigation.Item) resolves correctly as itemAs', () => {
    const NavItemComponent = (_props: any) => <a href="#" data-testid="nav-item">nav</a>;

    const fakeUi = { Navigation: { Item: NavItemComponent } };
    const tracker = createUiTracker();

    const { Template, getCapture } = makeCaptureTemplate('itemAs-nested');

    const MyShape = Shape(() => ({
      schema: z.array(z.string()),
      defaults: [],
      as: Template,
      itemAs: tracker.Navigation.Item as any,
    }));

    cleanup = render(
      () => (
        <ShapeUiContext.Provider value={fakeUi as any}>
          <MyShape />
        </ShapeUiContext.Provider>
      ),
      container,
    );

    expect(getCapture().itemAs).toBe(NavItemComponent);
  });
});

// ---------------------------------------------------------------------------
// 2. itemProps callable: результат содержит resolved tracker
// ---------------------------------------------------------------------------

describe('tracker-resolve — itemProps callable wraps result with tracker resolution', () => {
  it('calling itemProps(item) returns object with resolved as-tracker', () => {
    const LinkComponent = (_props: any) => <a href="#" data-testid="link">link</a>;
    const fakeUi = { Link: LinkComponent };
    const tracker = createUiTracker();

    const { Template, getCapture } = makeCaptureTemplate('itemProps-1');

    const MyShape = Shape(() => ({
      schema: z.array(z.object({ to: z.string(), label: z.string() })),
      defaults: [],
      as: Template,
      itemProps: (item: { to: string; label: string }) => ({
        as: tracker.Link as any,
        to: item.to,
        children: item.label,
      }),
    }));

    cleanup = render(
      () => (
        <ShapeUiContext.Provider value={fakeUi as any}>
          <MyShape />
        </ShapeUiContext.Provider>
      ),
      container,
    );

    const capturedItemProps = getCapture().itemProps as ((item: unknown) => Record<string, unknown>) | undefined;
    expect(typeof capturedItemProps).toBe('function');

    const result = capturedItemProps!({ to: '/home', label: 'Home' });
    expect(result.as).toBe(LinkComponent);
    expect(result.to).toBe('/home');
    expect(result.children).toBe('Home');
  });

  it('itemProps callable passes non-tracker values through unchanged', () => {
    const fakeUi = {};
    const { Template, getCapture } = makeCaptureTemplate('itemProps-pass');

    const MyShape = Shape(() => ({
      schema: z.array(z.string()),
      defaults: [],
      as: Template,
      itemProps: (item: string) => ({
        label: item,
        count: 42,
        active: true,
      }),
    }));

    cleanup = render(
      () => (
        <ShapeUiContext.Provider value={fakeUi as any}>
          <MyShape />
        </ShapeUiContext.Provider>
      ),
      container,
    );

    const capturedItemProps = getCapture().itemProps as ((item: unknown) => Record<string, unknown>) | undefined;
    const result = capturedItemProps!('hello');
    expect(result.label).toBe('hello');
    expect(result.count).toBe(42);
    expect(result.active).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 3. non-tracker plain values pass through unchanged
// ---------------------------------------------------------------------------

describe('tracker-resolve — non-tracker values are not modified', () => {
  it('plain primitive extras pass through as-is', () => {
    const { Template, getCapture } = makeCaptureTemplate('plain-1');

    const MyShape = Shape(() => ({
      schema: z.array(z.string()),
      defaults: [],
      as: Template,
      anyPlainProp: 42,
      variant: 'attached' as const,
      enabled: true,
    }));

    cleanup = render(() => <MyShape />, container);

    expect(getCapture().anyPlainProp).toBe(42);
    expect(getCapture().variant).toBe('attached');
    expect(getCapture().enabled).toBe(true);
  });

  it('plain object extra passes through without mutation', () => {
    const configObj = { foo: 1, bar: 'baz' };
    const { Template, getCapture } = makeCaptureTemplate('plain-obj');

    const MyShape = Shape(() => ({
      schema: z.array(z.string()),
      defaults: [],
      as: Template,
      configObj,
    }));

    cleanup = render(() => <MyShape />, container);

    expect(getCapture().configObj).toEqual({ foo: 1, bar: 'baz' });
  });

  it('array extra passes through without mutation', () => {
    const columns = [{ key: 'name', label: 'Name' }];
    const { Template, getCapture } = makeCaptureTemplate('plain-arr');

    const MyShape = Shape(() => ({
      schema: z.array(z.object({ name: z.string() })),
      defaults: [],
      as: Template,
      columns,
    }));

    cleanup = render(() => <MyShape />, container);

    expect(getCapture().columns).toBe(columns);
  });
});

// ---------------------------------------------------------------------------
// 4. callback not returning object → pass-through return value
// ---------------------------------------------------------------------------

describe('tracker-resolve — callable returning non-object passes result through', () => {
  it('callback returning a string passes result through unchanged', () => {
    const { Template, getCapture } = makeCaptureTemplate('cb-string');

    const MyShape = Shape(() => ({
      schema: z.array(z.string()),
      defaults: [],
      as: Template,
      lazyCallback: (item: string) => item.toUpperCase(),
    }));

    cleanup = render(() => <MyShape />, container);

    const captured = getCapture().lazyCallback as ((item: string) => unknown) | undefined;
    expect(typeof captured).toBe('function');
    expect(captured!('hello')).toBe('HELLO');
  });

  it('callback returning null passes null through', () => {
    const { Template, getCapture } = makeCaptureTemplate('cb-null');

    const MyShape = Shape(() => ({
      schema: z.array(z.string()),
      defaults: [],
      as: Template,
      nullCallback: () => null,
    }));

    cleanup = render(() => <MyShape />, container);

    const captured = getCapture().nullCallback as (() => unknown) | undefined;
    expect(captured!()).toBeNull();
  });

  it('callback returning array passes array through (not treated as object)', () => {
    const { Template, getCapture } = makeCaptureTemplate('cb-array');
    const arr = [1, 2, 3];

    const MyShape = Shape(() => ({
      schema: z.array(z.string()),
      defaults: [],
      as: Template,
      arrayCallback: () => arr,
    }));

    cleanup = render(() => <MyShape />, container);

    const captured = getCapture().arrayCallback as (() => unknown) | undefined;
    expect(captured!()).toBe(arr);
  });
});

// ---------------------------------------------------------------------------
// 5. tracker in extras with no ShapeUiContext → pass-through (no crash)
// ---------------------------------------------------------------------------

describe('tracker-resolve — missing ShapeUiContext does not crash', () => {
  it('tracker in extras when no context provided passes tracker value through', () => {
    const tracker = createUiTracker();
    const { Template, getCapture } = makeCaptureTemplate('no-ctx');

    const MyShape = Shape(() => ({
      schema: z.array(z.string()),
      defaults: [],
      as: Template,
      itemAs: tracker.Button as any,
    }));

    // No ShapeUiContext.Provider — useShapeUi() returns null
    cleanup = render(() => <MyShape />, container);

    // Template still renders (as is a direct component, not a tracker here)
    // itemAs value is the tracker itself (pass-through when realUi is null)
    const captured = getCapture().itemAs;
    // Should not throw and should be defined (the tracker proxy)
    expect(captured).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// 6. itemAs resolution does not break defaultAs resolution
// ---------------------------------------------------------------------------

describe('tracker-resolve — itemAs does not interfere with defaultAs resolution', () => {
  it('both as (defaultAs) and itemAs resolve correctly when both are trackers', () => {
    const GroupComponent = (_props: any) => <div data-testid="group" />;
    const ButtonComponent = (_props: any) => <button type="button" data-testid="btn-inner" />;

    const fakeUi = { Group: GroupComponent, Button: ButtonComponent };
    const tracker = createUiTracker();

    let capturedItemAs: unknown;
    const CapturingGroup = (props: Record<string, unknown>) => {
      capturedItemAs = props.itemAs;
      return <div data-testid="group-outer" />;
    };
    // Override Group in fakeUi to capture itemAs
    const fakeUiCapturing = { ...fakeUi, Group: CapturingGroup };

    const MyShape = Shape(() => ({
      schema: z.array(z.string()),
      defaults: [],
      as: tracker.Group as any,
      itemAs: tracker.Button as any,
    }));

    cleanup = render(
      () => (
        <ShapeUiContext.Provider value={fakeUiCapturing as any}>
          <MyShape />
        </ShapeUiContext.Provider>
      ),
      container,
    );

    // defaultAs (as: tracker.Group) must resolve to CapturingGroup — which renders
    expect(container.querySelector('[data-testid="group-outer"]')).not.toBeNull();
    // itemAs must be resolved to ButtonComponent (from fakeUi)
    expect(capturedItemAs).toBe(ButtonComponent);
  });
});
