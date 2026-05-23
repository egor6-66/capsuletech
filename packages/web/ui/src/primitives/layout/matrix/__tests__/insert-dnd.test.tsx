/**
 * Tests for insert-mode DnD in Matrix v2 (Phase 1.3).
 *
 * Contract tests only — actual cross-row drag-and-drop is verified visually
 * in Storybook (web-dnd's pointer-event handling is its own concern).
 */
/* @vitest-environment jsdom */
import { render } from 'solid-js/web';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Matrix } from '../matrix';

let container: HTMLDivElement;
let cleanup: (() => void) | undefined;

beforeEach(() => {
  container = document.createElement('div');
  container.style.width = '800px';
  container.style.height = '600px';
  document.body.appendChild(container);
});

afterEach(() => {
  cleanup?.();
  cleanup = undefined;
  document.body.removeChild(container);
});

describe('Matrix — insert-mode DnD', () => {
  it('renders cells in insert mode without errors', () => {
    expect(() => {
      cleanup = render(
        () => (
          <Matrix
            layoutMode="edit"
            dndMode="insert"
            rows={[
              {
                id: 'row-1',
                resizable: true,
                cells: [
                  {
                    id: 'a',
                    children: <div data-testid="cell-a">A</div>,
                    draggable: true,
                    width: 0.5,
                    resizable: true,
                  },
                  {
                    id: 'b',
                    children: <div data-testid="cell-b">B</div>,
                    draggable: true,
                    width: 0.5,
                    resizable: true,
                  },
                ],
              },
              {
                id: 'row-2',
                resizable: true,
                cells: [
                  {
                    id: 'c',
                    children: <div data-testid="cell-c">C</div>,
                    draggable: true,
                  },
                ],
              },
            ]}
          />
        ),
        container,
      );
    }).not.toThrow();

    expect(container.querySelector('[data-testid="cell-a"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="cell-b"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="cell-c"]')).not.toBeNull();
  });

  it('view mode does not invoke onLayoutChange (DnD is gated)', () => {
    const onLayoutChange = vi.fn();
    cleanup = render(
      () => (
        <Matrix
          // No layoutMode → uncontrolled, default 'view'
          dndMode="insert"
          onLayoutChange={onLayoutChange}
          rows={[
            {
              id: 'row-1',
              cells: [
                { id: 'a', children: <div>A</div>, draggable: true },
                { id: 'b', children: <div>B</div>, draggable: true },
              ],
            },
          ]}
        />
      ),
      container,
    );

    // No swap-engine, no drop simulation — callback should NOT fire just on mount.
    expect(onLayoutChange).not.toHaveBeenCalled();
  });

  it('no global edit-mode badge in insert mode (badge UX removed)', () => {
    // The old global "Toggle layout edit mode" EditBadge was removed in the
    // badge-UX redesign. Insert mode is gated by layoutMode prop — no toggle UI.
    cleanup = render(
      () => (
        <Matrix
          dndMode="insert"
          rows={[
            {
              id: 'row-1',
              cells: [
                { id: 'a', children: <div>A</div>, draggable: true },
                { id: 'b', children: <div>B</div>, draggable: true },
              ],
            },
          ]}
        />
      ),
      container,
    );

    expect(container.querySelector('button[aria-label="Toggle layout edit mode"]')).toBeNull();
    // DragBadge (swap-mode only) not rendered in insert mode either
    expect(container.querySelector('[aria-label="Drag to swap cell"]')).toBeNull();
    // Cells still render
    expect(container.querySelector('div')).not.toBeNull();
  });

  it('rows without id are silently skipped (no draggable bindings)', () => {
    // Cells in a row without id can't participate in insert mode (no sortable).
    // They still render — just no DnD.
    expect(() => {
      cleanup = render(
        () => (
          <Matrix
            layoutMode="edit"
            dndMode="insert"
            rows={[
              {
                // id intentionally omitted
                cells: [
                  {
                    id: 'a',
                    children: <div data-testid="orphan-a">A</div>,
                    draggable: true,
                  },
                ],
              },
            ]}
          />
        ),
        container,
      );
    }).not.toThrow();

    expect(container.querySelector('[data-testid="orphan-a"]')).not.toBeNull();
  });

  it('non-draggable cells in insert mode render without binding', () => {
    expect(() => {
      cleanup = render(
        () => (
          <Matrix
            layoutMode="edit"
            dndMode="insert"
            rows={[
              {
                id: 'row-1',
                cells: [
                  // Only first is draggable; second renders normally
                  { id: 'a', children: <div data-testid="drag-a">A</div>, draggable: true },
                  { id: 'b', children: <div data-testid="static-b">B</div> },
                ],
              },
            ]}
          />
        ),
        container,
      );
    }).not.toThrow();

    expect(container.querySelector('[data-testid="drag-a"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="static-b"]')).not.toBeNull();
  });
});
