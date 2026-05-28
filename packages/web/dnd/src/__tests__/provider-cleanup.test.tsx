/**
 * Tests for DnDProvider defensive cleanup on unmount.
 *
 * Edge case: user begins drag → route change unmounts DnDProvider before
 * drag ends. Without onCleanup(cleanup), 4 window-level listeners
 * (pointermove, pointerup, pointercancel, keydown) remain attached with
 * stale signal closures. Each interrupted drag = +4 orphan listeners.
 *
 * onCleanup(cleanup) in context.tsx closes this. These tests verify it.
 */
/* @vitest-environment jsdom */
import { render } from 'solid-js/web';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DnDProvider, useDnD } from '../context';

let container: HTMLDivElement;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
});

afterEach(() => {
  if (container.parentNode) document.body.removeChild(container);
});

// ---------------------------------------------------------------------------
// Helper: fire a synthetic PointerEvent on window
// ---------------------------------------------------------------------------
function fireWindowPointerEvent(type: string, init?: PointerEventInit) {
  const evt = new PointerEvent(type, { bubbles: true, cancelable: true, ...init });
  window.dispatchEvent(evt);
  return evt;
}

// ---------------------------------------------------------------------------
// Test 1: no listeners are attached when no drag has started
// ---------------------------------------------------------------------------
describe('DnDProvider — window listeners lifecycle', () => {
  it('no window listeners attached before drag starts', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');

    const dispose = render(() => <DnDProvider>{null}</DnDProvider>, container);
    dispose();

    // addEventListener should not have been called for drag-tracking events
    const dragEvents = ['pointermove', 'pointerup', 'pointercancel', 'keydown'];
    for (const evt of dragEvents) {
      const calls = addSpy.mock.calls.filter((c) => c[0] === evt);
      expect(calls.length, `${evt} should not be added before drag`).toBe(0);
    }

    addSpy.mockRestore();
  });

  // -------------------------------------------------------------------------
  // Test 2: startDrag attaches exactly 4 listeners
  // -------------------------------------------------------------------------
  it('startDrag attaches 4 window listeners', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    let capturedDnD: ReturnType<typeof useDnD> | null = null;

    // We need a real draggable element registered so startDrag does not bail
    // out early at `if (!entry) return`. Build a minimal IDraggableEntry by
    // reaching into the context via a child component.
    const Harness = () => {
      const dnd = useDnD();
      capturedDnD = dnd;

      // Register a minimal draggable entry
      const el = document.createElement('div');
      dnd.registerDraggable({
        id: 'test-drag',
        el,
        data: () => ({ kind: 'test' }),
      });

      return <div />;
    };

    const dispose = render(
      () => (
        <DnDProvider>
          <Harness />
        </DnDProvider>
      ),
      container,
    );

    // Clear spy calls accumulated during render
    addSpy.mockClear();

    // Fire startDrag
    const pe = new PointerEvent('pointerdown', { clientX: 10, clientY: 20 });
    capturedDnD!.startDrag('test-drag', pe);

    const dragEvents = ['pointermove', 'pointerup', 'pointercancel', 'keydown'];
    for (const evt of dragEvents) {
      const calls = addSpy.mock.calls.filter((c) => c[0] === evt);
      expect(calls.length, `${evt} should be added once`).toBe(1);
    }

    dispose();
    addSpy.mockRestore();
  });

  // -------------------------------------------------------------------------
  // Test 3: CORE — unmount during active drag removes all 4 listeners
  // -------------------------------------------------------------------------
  it('unmount during active drag removes all 4 window listeners', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    let capturedDnD: ReturnType<typeof useDnD> | null = null;

    const Harness = () => {
      const dnd = useDnD();
      capturedDnD = dnd;

      const el = document.createElement('div');
      dnd.registerDraggable({
        id: 'drag-unmount',
        el,
        data: () => ({ kind: 'unmount-test' }),
      });

      return <div />;
    };

    const dispose = render(
      () => (
        <DnDProvider>
          <Harness />
        </DnDProvider>
      ),
      container,
    );

    // Start drag so listeners are attached
    const pe = new PointerEvent('pointerdown', { clientX: 5, clientY: 5 });
    capturedDnD!.startDrag('drag-unmount', pe);

    // Clear spy calls from startDrag phase
    removeSpy.mockClear();

    // Unmount provider (simulates route change mid-drag)
    dispose();

    const dragEvents = ['pointermove', 'pointerup', 'pointercancel', 'keydown'];
    for (const evt of dragEvents) {
      const calls = removeSpy.mock.calls.filter((c) => c[0] === evt);
      expect(calls.length, `${evt} should be removed on unmount`).toBeGreaterThanOrEqual(1);
    }

    removeSpy.mockRestore();
  });

  // -------------------------------------------------------------------------
  // Test 4: normal drag completion (pointerup) also removes all 4 listeners
  // -------------------------------------------------------------------------
  it('normal pointerup removes all 4 window listeners', () => {
    // jsdom does not implement document.elementFromPoint — stub it so onPointerUp
    // can complete without throwing before it calls cleanup().
    const elemFromPointOrig = document.elementFromPoint;
    document.elementFromPoint = () => null;

    const removeSpy = vi.spyOn(window, 'removeEventListener');
    let capturedDnD: ReturnType<typeof useDnD> | null = null;

    const Harness = () => {
      const dnd = useDnD();
      capturedDnD = dnd;

      const el = document.createElement('div');
      dnd.registerDraggable({
        id: 'drag-normal',
        el,
        data: () => ({ kind: 'normal' }),
      });

      return <div />;
    };

    const dispose = render(
      () => (
        <DnDProvider>
          <Harness />
        </DnDProvider>
      ),
      container,
    );

    const pe = new PointerEvent('pointerdown', { clientX: 0, clientY: 0 });
    capturedDnD!.startDrag('drag-normal', pe);

    removeSpy.mockClear();

    // Fire pointerup — normal completion path
    fireWindowPointerEvent('pointerup', { clientX: 0, clientY: 0 });

    const dragEvents = ['pointermove', 'pointerup', 'pointercancel', 'keydown'];
    for (const evt of dragEvents) {
      const calls = removeSpy.mock.calls.filter((c) => c[0] === evt);
      expect(calls.length, `${evt} should be removed after pointerup`).toBeGreaterThanOrEqual(1);
    }

    dispose();
    removeSpy.mockRestore();
    document.elementFromPoint = elemFromPointOrig;
  });

  // -------------------------------------------------------------------------
  // Test 5: Escape key also cleans up listeners
  // -------------------------------------------------------------------------
  it('Escape keydown removes all 4 window listeners', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    let capturedDnD: ReturnType<typeof useDnD> | null = null;

    const Harness = () => {
      const dnd = useDnD();
      capturedDnD = dnd;

      const el = document.createElement('div');
      dnd.registerDraggable({
        id: 'drag-escape',
        el,
        data: () => ({ kind: 'escape-test' }),
      });

      return <div />;
    };

    const dispose = render(
      () => (
        <DnDProvider>
          <Harness />
        </DnDProvider>
      ),
      container,
    );

    const pe = new PointerEvent('pointerdown', { clientX: 0, clientY: 0 });
    capturedDnD!.startDrag('drag-escape', pe);

    removeSpy.mockClear();

    // Fire Escape
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    const dragEvents = ['pointermove', 'pointerup', 'pointercancel', 'keydown'];
    for (const evt of dragEvents) {
      const calls = removeSpy.mock.calls.filter((c) => c[0] === evt);
      expect(calls.length, `${evt} should be removed after Escape`).toBeGreaterThanOrEqual(1);
    }

    dispose();
    removeSpy.mockRestore();
  });
});
