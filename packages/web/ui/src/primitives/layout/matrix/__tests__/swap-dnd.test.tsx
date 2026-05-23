/**
 * Tests for swap-mode DnD in Matrix v2 — badge UX (Phase 1.2 v2).
 *
 * Badge-UX contract:
 * - A DragBadge (grip icon button) renders inside each draggable cell when
 *   2+ draggable cells exist (otherwise no swap target exists).
 * - No global edit badge / no edit-mode toggle.
 * - Drag is triggered via badge pointerdown → dnd.startDrag; cell surface
 *   itself does not initiate drag.
 * - Drop → onLayoutChange fires with { kind: 'swap', a, b }.
 * - swapGroup constraint enforced (badge still shown but drop rejected).
 *
 * Full pointer-event DnD is an e2e / Storybook concern. Unit tests cover:
 *   1. Badge renders when 2+ draggable cells.
 *   2. Badge NOT rendered when < 2 draggable cells.
 *   3. Badge count matches draggable cell count.
 *   4. onLayoutChange handler wires without errors.
 *   5. Non-draggable cells render without badge.
 *   6. No crash on preset with only main slot (no draggable cells).
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

describe('Matrix — badge-UX swap DnD', () => {
  it('badge renders on each draggable cell when 2+ draggable cells exist', () => {
    cleanup = render(
      () => (
        <Matrix
          dndMode="swap"
          rows={[
            {
              id: 'r',
              resizable: true,
              cells: [
                {
                  id: 'a',
                  children: <div data-testid="cell-a">A</div>,
                  draggable: true,
                  swapGroup: 'g',
                  width: 0.5,
                  resizable: true,
                },
                {
                  id: 'b',
                  children: <div data-testid="cell-b">B</div>,
                  draggable: true,
                  swapGroup: 'g',
                  width: 0.5,
                  resizable: true,
                },
              ],
            },
          ]}
        />
      ),
      container,
    );

    const badges = container.querySelectorAll('[aria-label="Drag to swap cell"]');
    expect(badges.length).toBe(2);
    // Cell content still renders
    expect(container.querySelector('[data-testid="cell-a"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="cell-b"]')).not.toBeNull();
  });

  it('badge NOT rendered when only 1 draggable cell (nothing to swap with)', () => {
    cleanup = render(
      () => (
        <Matrix
          dndMode="swap"
          rows={[
            {
              id: 'r',
              resizable: true,
              cells: [
                {
                  id: 'a',
                  children: <div>A</div>,
                  draggable: true,
                  swapGroup: 'g',
                  width: 0.5,
                  resizable: true,
                },
                {
                  id: 'b',
                  children: <div>B</div>,
                  // NOT draggable
                  width: 0.5,
                  resizable: true,
                },
              ],
            },
          ]}
        />
      ),
      container,
    );

    const badges = container.querySelectorAll('[aria-label="Drag to swap cell"]');
    expect(badges.length).toBe(0);
  });

  it('badge NOT rendered when no draggable cells at all', () => {
    cleanup = render(
      () => <Matrix preset="app-shell" slots={{ main: <div data-testid="m">M</div> }} />,
      container,
    );

    const badges = container.querySelectorAll('[aria-label="Drag to swap cell"]');
    expect(badges.length).toBe(0);
    expect(container.querySelector('[data-testid="m"]')).not.toBeNull();
  });

  it('3 draggable cells → 3 badges', () => {
    cleanup = render(
      () => (
        <Matrix
          dndMode="swap"
          rows={[
            {
              id: 'r',
              resizable: true,
              cells: [
                {
                  id: 'a',
                  children: <div>A</div>,
                  draggable: true,
                  swapGroup: 'g',
                  width: 0.33,
                  resizable: true,
                },
                {
                  id: 'b',
                  children: <div>B</div>,
                  draggable: true,
                  swapGroup: 'g',
                  width: 0.34,
                  resizable: true,
                },
                {
                  id: 'c',
                  children: <div>C</div>,
                  draggable: true,
                  swapGroup: 'g',
                  width: 0.33,
                  resizable: true,
                },
              ],
            },
          ]}
        />
      ),
      container,
    );

    const badges = container.querySelectorAll('[aria-label="Drag to swap cell"]');
    expect(badges.length).toBe(3);
  });

  it('badge has title="Drag to swap" for discoverability', () => {
    cleanup = render(
      () => (
        <Matrix
          dndMode="swap"
          rows={[
            {
              id: 'r',
              resizable: true,
              cells: [
                {
                  id: 'a',
                  children: <div>A</div>,
                  draggable: true,
                  swapGroup: 'g',
                  width: 0.5,
                  resizable: true,
                },
                {
                  id: 'b',
                  children: <div>B</div>,
                  draggable: true,
                  swapGroup: 'g',
                  width: 0.5,
                  resizable: true,
                },
              ],
            },
          ]}
        />
      ),
      container,
    );

    const badge = container.querySelector('[aria-label="Drag to swap cell"]');
    expect(badge?.getAttribute('title')).toBe('Drag to swap');
  });

  it('no global edit-mode badge rendered', () => {
    cleanup = render(
      () => (
        <Matrix
          rows={[
            {
              cells: [
                { id: 'a', children: <div>A</div>, draggable: true, swapGroup: 'g' },
                { id: 'b', children: <div>B</div>, draggable: true, swapGroup: 'g' },
              ],
            },
          ]}
        />
      ),
      container,
    );

    // Old EditBadge used aria-label="Toggle layout edit mode" — must be gone
    expect(container.querySelector('button[aria-label="Toggle layout edit mode"]')).toBeNull();
  });

  it('non-draggable cells in same row render without badge', () => {
    cleanup = render(
      () => (
        <Matrix
          dndMode="swap"
          rows={[
            {
              id: 'r',
              resizable: true,
              cells: [
                {
                  id: 'a',
                  children: <div data-testid="cell-a">A</div>,
                  draggable: true,
                  swapGroup: 'g',
                  width: 0.5,
                  resizable: true,
                },
                {
                  id: 'b',
                  children: <div data-testid="cell-b">B</div>,
                  // NOT draggable
                  width: 0.5,
                  resizable: true,
                },
                {
                  id: 'c',
                  children: <div data-testid="cell-c">C</div>,
                  draggable: true,
                  swapGroup: 'g',
                  width: 0.0,
                  resizable: true,
                },
              ],
            },
          ]}
        />
      ),
      container,
    );

    // 2 draggable cells → 2 badges; non-draggable cell 'b' has no badge
    const badges = container.querySelectorAll('[aria-label="Drag to swap cell"]');
    expect(badges.length).toBe(2);
    expect(container.querySelector('[data-testid="cell-b"]')).not.toBeNull();
  });

  it('onLayoutChange handler wires without errors', () => {
    const onLayoutChange = vi.fn();
    expect(() => {
      cleanup = render(
        () => (
          <Matrix
            dndMode="swap"
            onLayoutChange={onLayoutChange}
            rows={[
              {
                cells: [
                  { id: 'a', children: <div>A</div>, draggable: true, swapGroup: 'g' },
                  { id: 'b', children: <div>B</div>, draggable: true, swapGroup: 'g' },
                ],
              },
            ]}
          />
        ),
        container,
      );
    }).not.toThrow();
    // No pointer events fired — callback not invoked yet
    expect(onLayoutChange).not.toHaveBeenCalled();
  });

  it('preset app-shell with draggable sidebar + rightBar → 2 badges', () => {
    cleanup = render(
      () => (
        <Matrix
          preset="app-shell"
          slots={{
            main: <div data-testid="main">M</div>,
            sidebar: {
              children: <div data-testid="sidebar">S</div>,
              draggable: true,
              swapGroup: 'aside',
            },
            rightBar: {
              children: <div data-testid="rightBar">R</div>,
              draggable: true,
              swapGroup: 'aside',
            },
          }}
        />
      ),
      container,
    );

    const badges = container.querySelectorAll('[aria-label="Drag to swap cell"]');
    expect(badges.length).toBe(2);
    expect(container.querySelector('[data-testid="main"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="sidebar"]')).not.toBeNull();
  });
});
