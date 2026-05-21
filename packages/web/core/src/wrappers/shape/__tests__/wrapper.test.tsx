/* @vitest-environment jsdom */
/**
 * wrapper.test.tsx — характеризационные тесты Shape batch-flow (v0.4.0+).
 *
 * BREAKING (v0.4.0): Shape больше не итерирует данные per-item.
 * Весь массив `data` + extras из definition передаются в `as`-template как единый пакет.
 * Итерация — ответственность template'а (Ui.List / Ui.DataTable / custom).
 *
 * Покрытие:
 *  1. data array передаётся в as-template целиком
 *  2. consumer JSX `data` overrides definition `defaults`
 *  3. consumer JSX `as` overrides definition `as`
 *  4. extras из definition (columns, etc.) передаются в template
 *  5. consumer extras перезаписывают definition extras (consumer wins)
 *  6. definition extras + consumer extras мерджатся (non-overlapping keys оба попадают)
 *  7. path-tracker `as: ui.X.Y` резолвится через ShapeUiContext
 *  8. нет template (ни definition.as, ни consumer.as) → рендерит null
 *  9. definition с `defaults` без consumer `data` → defaults идут в template
 * 10. consumer `data` = пустой массив → переопределяет defaults (не fallback к defaults)
 */

import { z } from 'zod';
import { createSignal } from 'solid-js';
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

/** Простой шаблон-захватчик: записывает полученные props и рендерит data-testid. */
const makeCaptureTemplate = (testId: string) => {
  let captured: Record<string, unknown> = {};
  const Template = (props: Record<string, unknown>) => {
    captured = { ...props };
    return <div data-testid={testId}>{JSON.stringify(props.data)}</div>;
  };
  const getCapture = () => captured;
  return { Template, getCapture };
};

// ---------------------------------------------------------------------------
// 1. data array передаётся в as-template целиком
// ---------------------------------------------------------------------------

describe('Shape batch flow — data passes through as array', () => {
  it('passes defaults array to template as `data` prop', () => {
    const { Template, getCapture } = makeCaptureTemplate('batch-1');

    const MyShape = Shape(() => ({
      schema: z.array(z.string()),
      defaults: ['a', 'b', 'c'],
      as: Template,
    }));

    cleanup = render(() => <MyShape />, container);
    expect(getCapture().data).toEqual(['a', 'b', 'c']);
    // рендерит не три отдельных div, а один div с JSON
    expect(container.querySelectorAll('[data-testid="batch-1"]').length).toBe(1);
  });

  it('template receives data as single array, not iterated items', () => {
    const received: unknown[] = [];
    const Template = (props: { data?: unknown[] }) => {
      received.push(props.data);
      return <div data-testid="single">{String(Array.isArray(props.data))}</div>;
    };

    const MyShape = Shape(() => ({
      schema: z.array(z.number()),
      defaults: [1, 2, 3],
      as: Template,
    }));

    cleanup = render(() => <MyShape />, container);
    // Template вызван ровно один раз
    expect(received).toHaveLength(1);
    expect(Array.isArray(received[0])).toBe(true);
    expect(received[0]).toEqual([1, 2, 3]);
  });
});

// ---------------------------------------------------------------------------
// 2. consumer `data` overrides definition `defaults`
// ---------------------------------------------------------------------------

describe('Shape batch flow — consumer data overrides defaults', () => {
  it('consumer JSX data prop replaces definition defaults', () => {
    const { Template, getCapture } = makeCaptureTemplate('override-data');

    const MyShape = Shape(() => ({
      schema: z.array(z.string()),
      defaults: ['default-1', 'default-2'],
      as: Template,
    }));

    cleanup = render(() => <MyShape data={['override-a', 'override-b']} />, container);
    expect(getCapture().data).toEqual(['override-a', 'override-b']);
  });

  it('consumer data=[] overrides defaults (empty array is explicit, not falsy fallback)', () => {
    const { Template, getCapture } = makeCaptureTemplate('empty-override');

    const MyShape = Shape(() => ({
      schema: z.array(z.string()),
      defaults: ['should-not-appear'],
      as: Template,
    }));

    cleanup = render(() => <MyShape data={[]} />, container);
    expect(getCapture().data).toEqual([]);
  });

  it('no consumer data → definition defaults used', () => {
    const { Template, getCapture } = makeCaptureTemplate('use-defaults');

    const MyShape = Shape(() => ({
      schema: z.array(z.string()),
      defaults: ['from-defaults'],
      as: Template,
    }));

    cleanup = render(() => <MyShape />, container);
    expect(getCapture().data).toEqual(['from-defaults']);
  });
});

// ---------------------------------------------------------------------------
// 3. consumer `as` overrides definition `as`
// ---------------------------------------------------------------------------

describe('Shape batch flow — consumer as overrides definition as', () => {
  it('consumer JSX as prop replaces definition as', () => {
    const DefinitionTemplate = (_props: any) => <div data-testid="def-tpl">DEF</div>;
    const ConsumerTemplate = (_props: any) => <div data-testid="consumer-tpl">CONSUMER</div>;

    const MyShape = Shape(() => ({
      schema: z.array(z.string()),
      defaults: [],
      as: DefinitionTemplate,
    }));

    cleanup = render(() => <MyShape as={ConsumerTemplate} />, container);
    expect(container.querySelector('[data-testid="consumer-tpl"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="def-tpl"]')).toBeNull();
  });

  it('definition as is used when consumer does not provide as', () => {
    const DefinitionTemplate = (_props: any) => <div data-testid="def-default">DEF</div>;

    const MyShape = Shape(() => ({
      schema: z.array(z.string()),
      defaults: [],
      as: DefinitionTemplate,
    }));

    cleanup = render(() => <MyShape />, container);
    expect(container.querySelector('[data-testid="def-default"]')).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 4. extras из definition передаются в template
// ---------------------------------------------------------------------------

describe('Shape batch flow — definition extras passed to template', () => {
  it('extra field `columns` from definition reaches template props', () => {
    const columns = [{ key: 'name', label: 'Name' }];
    const { Template, getCapture } = makeCaptureTemplate('extras-1');

    const MyShape = Shape(() => ({
      schema: z.array(z.object({ name: z.string() })),
      defaults: [],
      as: Template,
      columns,
    }));

    cleanup = render(() => <MyShape />, container);
    expect(getCapture().columns).toEqual(columns);
  });

  it('multiple extras all arrive in template', () => {
    const { Template, getCapture } = makeCaptureTemplate('extras-multi');

    const MyShape = Shape(() => ({
      schema: z.array(z.string()),
      defaults: [],
      as: Template,
      sortable: true,
      pageSize: 20,
      emptyLabel: 'No items',
    }));

    cleanup = render(() => <MyShape />, container);
    expect(getCapture().sortable).toBe(true);
    expect(getCapture().pageSize).toBe(20);
    expect(getCapture().emptyLabel).toBe('No items');
  });

  it('schema/defaults/as fields are NOT forwarded as extras', () => {
    const { Template, getCapture } = makeCaptureTemplate('no-internal-fields');

    const MyShape = Shape(() => ({
      schema: z.array(z.string()),
      defaults: ['x'],
      as: Template,
    }));

    cleanup = render(() => <MyShape />, container);
    // 'schema' and 'as' must not leak as props
    expect(getCapture().schema).toBeUndefined();
    expect(getCapture().as).toBeUndefined();
    // 'defaults' is also internal — must not leak
    expect(getCapture().defaults).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 5. consumer extras override definition extras (consumer wins)
// ---------------------------------------------------------------------------

describe('Shape batch flow — consumer extras win over definition extras', () => {
  it('consumer prop overrides same-named definition extra', () => {
    const { Template, getCapture } = makeCaptureTemplate('consumer-wins');

    const MyShape = Shape(() => ({
      schema: z.array(z.string()),
      defaults: [],
      as: Template,
      pageSize: 10,
    }));

    cleanup = render(() => <MyShape pageSize={50} />, container);
    expect(getCapture().pageSize).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// 6. non-overlapping extras from definition and consumer both arrive
// ---------------------------------------------------------------------------

describe('Shape batch flow — definition and consumer extras are merged', () => {
  it('non-overlapping keys from both sources appear in template', () => {
    const { Template, getCapture } = makeCaptureTemplate('merge-extras');

    const MyShape = Shape(() => ({
      schema: z.array(z.string()),
      defaults: [],
      as: Template,
      fromDefinition: 'def-value',
    }));

    cleanup = render(() => <MyShape fromConsumer="consumer-value" />, container);
    expect(getCapture().fromDefinition).toBe('def-value');
    expect(getCapture().fromConsumer).toBe('consumer-value');
  });
});

// ---------------------------------------------------------------------------
// 7. path-tracker `as: ui.X.Y` resolves through ShapeUiContext
// ---------------------------------------------------------------------------

describe('Shape batch flow — path-tracker resolves via ShapeUiContext', () => {
  it('ui.X.Y path-tracker resolves to component from provided Ui namespace', () => {
    const TrackedTemplate = (_props: any) => <div data-testid="tracked-tpl">TRACKED</div>;

    const fakeUi = {
      MyGroup: {
        MyTpl: TrackedTemplate,
      },
    };

    const tracker = createUiTracker();

    const MyShape = Shape(() => ({
      schema: z.array(z.string()),
      defaults: [],
      as: tracker.MyGroup.MyTpl as any, // path-tracker captured at factory time
    }));

    cleanup = render(
      () => (
        <ShapeUiContext.Provider value={fakeUi as any}>
          <MyShape />
        </ShapeUiContext.Provider>
      ),
      container,
    );
    expect(container.querySelector('[data-testid="tracked-tpl"]')).not.toBeNull();
  });

  it('path-tracker with missing path in Ui → renders null (resolveByPath returns undefined)', () => {
    const tracker = createUiTracker();
    const fakeUi = { SomeGroup: {} };

    const MyShape = Shape(() => ({
      schema: z.array(z.string()),
      defaults: [],
      as: tracker.SomeGroup.NonExistent as any,
    }));

    cleanup = render(
      () => (
        <ShapeUiContext.Provider value={fakeUi as any}>
          <MyShape />
        </ShapeUiContext.Provider>
      ),
      container,
    );
    // no crash, null rendered
    expect(container.innerHTML).toBe('');
  });
});

// ---------------------------------------------------------------------------
// 8. нет template → рендерит null
// ---------------------------------------------------------------------------

describe('Shape batch flow — no template renders null', () => {
  it('shape with no definition.as and no consumer.as renders null', () => {
    const MyShape = Shape(() => ({
      schema: z.array(z.string()),
      defaults: ['a', 'b'],
    }));

    cleanup = render(() => <MyShape />, container);
    expect(container.innerHTML).toBe('');
  });

  it('shape with no Ui in context and path-tracker as → renders null gracefully', () => {
    const tracker = createUiTracker();

    const MyShape = Shape(() => ({
      schema: z.array(z.string()),
      defaults: [],
      as: tracker.SomeComponent as any,
    }));

    // No ShapeUiContext provided — useShapeUi() returns null
    cleanup = render(() => <MyShape />, container);
    expect(container.innerHTML).toBe('');
  });
});

// ---------------------------------------------------------------------------
// 9. reactive data via signal
// ---------------------------------------------------------------------------

describe('Shape batch flow — reactive data', () => {
  it('consumer data signal updates propagate to template', () => {
    const received: unknown[][] = [];
    const Template = (props: { data?: string[] }) => {
      received.push(props.data ?? []);
      return <div data-testid="reactive">{(props.data ?? []).join(',')}</div>;
    };

    const [data, setData] = createSignal(['initial']);

    const MyShape = Shape(() => ({
      schema: z.array(z.string()),
      as: Template,
    }));

    cleanup = render(() => <MyShape data={data()} />, container);
    expect(container.querySelector('[data-testid="reactive"]')?.textContent).toBe('initial');

    setData(['updated', 'list']);
    expect(container.querySelector('[data-testid="reactive"]')?.textContent).toBe('updated,list');
  });
});
