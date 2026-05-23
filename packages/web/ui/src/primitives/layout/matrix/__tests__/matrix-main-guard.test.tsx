/**
 * Guard tests: Matrix preset='app-shell' throws when `main` slot is absent.
 *
 * The error is thrown inside `appShellResolver` (presets/app-shell.ts) when
 * the resolver is called via `resolvePreset`. Centroid path (only main) does
 * NOT throw — covered here for completeness.
 *
 * Note: raw `rows` API does NOT privilege a cell with `id='main'` — only
 * preset='app-shell' makes main required.
 */
/* @vitest-environment jsdom */
import { render } from 'solid-js/web';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Matrix } from '../matrix';

let container: HTMLDivElement;
let cleanup: (() => void) | undefined;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
});

afterEach(() => {
  cleanup?.();
  cleanup = undefined;
  document.body.removeChild(container);
});

describe("Matrix preset='app-shell' — missing main guard", () => {
  it('throws when slots has sidebar but no main', () => {
    expect(() => {
      cleanup = render(
        () => (
          <Matrix
            preset="app-shell"
            slots={
              {
                sidebar: <div>Sidebar</div>,
                // main intentionally omitted — simulates runtime JS misuse
              } as never
            }
          />
        ),
        container,
      );
    }).toThrow("preset='app-shell': `main` slot is required");
  });

  it('throws when slots has header + footer but no main', () => {
    expect(() => {
      cleanup = render(
        () => (
          <Matrix
            preset="app-shell"
            slots={
              {
                header: <div>Header</div>,
                footer: <div>Footer</div>,
              } as never
            }
          />
        ),
        container,
      );
    }).toThrow("preset='app-shell': `main` slot is required");
  });

  it('throws when slots has only sidebar (object-form) but no main', () => {
    expect(() => {
      cleanup = render(
        () => (
          <Matrix
            preset="app-shell"
            slots={
              {
                sidebar: { children: <div>Sidebar</div>, initialSize: 0.2 },
              } as never
            }
          />
        ),
        container,
      );
    }).toThrow("preset='app-shell': `main` slot is required");
  });

  it('does NOT throw when only main is provided (centroid path)', () => {
    expect(() => {
      cleanup = render(
        () => (
          <Matrix
            preset="app-shell"
            slots={{
              main: <div data-testid="content">Hello</div>,
            }}
          />
        ),
        container,
      );
    }).not.toThrow();

    expect(container.querySelector('[data-testid="content"]')).not.toBeNull();
  });

  it('does NOT throw when main + sidebar are both provided', () => {
    expect(() => {
      cleanup = render(
        () => (
          <Matrix
            preset="app-shell"
            slots={{
              main: <div data-testid="main-ok">Main</div>,
              sidebar: <div>Side</div>,
            }}
          />
        ),
        container,
      );
    }).not.toThrow();

    expect(container.querySelector('[data-testid="main-ok"]')).not.toBeNull();
  });

  it('raw rows API: does NOT require a cell with id=main', () => {
    expect(() => {
      cleanup = render(
        () => (
          <Matrix
            rows={[
              {
                cells: [
                  { id: 'a', children: <div data-testid="raw-a">A</div> },
                  { id: 'b', children: <div data-testid="raw-b">B</div> },
                ],
              },
            ]}
          />
        ),
        container,
      );
    }).not.toThrow();

    expect(container.querySelector('[data-testid="raw-a"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="raw-b"]')).not.toBeNull();
  });
});
