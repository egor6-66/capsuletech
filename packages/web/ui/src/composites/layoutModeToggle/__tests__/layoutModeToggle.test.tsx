/**
 * LayoutModeToggle composite tests.
 *
 * Tests render + interaction via solid-js/web render in jsdom.
 * The @capsuletech/web-style switcher/layoutMode module uses a module-level
 * signal; we mock the entire @capsuletech/web-style package to keep tests
 * isolated from localStorage and matchMedia side effects.
 */
/* @vitest-environment jsdom */
import { render } from 'solid-js/web';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock @capsuletech/web-style — vi.mock is hoisted, no outer-scope refs.
// ---------------------------------------------------------------------------

vi.mock('@capsuletech/web-style', async () => {
  const { createSignal } = await import('solid-js');
  const [mode, setMode] = createSignal<'view' | 'edit'>('view');

  return {
    useLayoutMode: () => mode,
    toggleLayoutMode: vi.fn(() => {
      setMode((prev) => (prev === 'view' ? 'edit' : 'view'));
    }),
    setLayoutMode: vi.fn((next: 'view' | 'edit') => setMode(next)),
    // Stubs for other symbols imported transitively.
    useDarkMode: () => () => false,
    toggleDarkMode: vi.fn(),
    setDarkMode: vi.fn(),
    useTheme: () => () => 'black',
    setTheme: vi.fn(),
    DISCOVERED_THEMES: ['black', 'zen'],
    cva: vi.fn((_base: string, _config?: unknown) => () => ''),
    createStyle: vi.fn((_cva: unknown, _props: unknown) => ({
      className: () => '',
      style: () => undefined,
    })),
    cn: (...args: string[]) => args.filter(Boolean).join(' '),
  };
});

import { setLayoutMode } from '@capsuletech/web-style';
import { LayoutModeToggle } from '../layoutModeToggle';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let container: HTMLDivElement;
let cleanup: (() => void) | undefined;

beforeEach(() => {
  // Reset layout mode to 'view' so every test starts from the same initial state.
  vi.mocked(setLayoutMode)('view');
  container = document.createElement('div');
  document.body.appendChild(container);
});

afterEach(() => {
  cleanup?.();
  cleanup = undefined;
  document.body.innerHTML = '';
});

const getButton = () => container.querySelector('button')!;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('LayoutModeToggle composite', () => {
  describe('rendering', () => {
    it('renders a button element', () => {
      cleanup = render(() => <LayoutModeToggle />, container);
      expect(getButton()).not.toBeNull();
    });

    it('shows edit label in view mode (initial)', () => {
      cleanup = render(() => <LayoutModeToggle />, container);
      expect(getButton().textContent).toContain('Edit');
    });

    it('has aria-label "Switch to edit mode" in view mode', () => {
      cleanup = render(() => <LayoutModeToggle />, container);
      expect(getButton().getAttribute('aria-label')).toBe('Switch to edit mode');
    });

    it('forwards extra class to the button', () => {
      cleanup = render(() => <LayoutModeToggle class="extra-cls" />, container);
      expect(getButton().className).toContain('extra-cls');
    });
  });

  describe('interaction', () => {
    it('click switches label from Edit to View', () => {
      cleanup = render(() => <LayoutModeToggle />, container);
      const btn = getButton();
      expect(btn.textContent).toContain('Edit');
      btn.click();
      expect(btn.textContent).toContain('View');
    });

    it('click changes aria-label to "Switch to view mode" after toggle', () => {
      cleanup = render(() => <LayoutModeToggle />, container);
      const btn = getButton();
      btn.click();
      expect(btn.getAttribute('aria-label')).toBe('Switch to view mode');
    });

    it('onChange callback fires with "edit" after first click (view → edit)', () => {
      const onChange = vi.fn();
      cleanup = render(() => <LayoutModeToggle onChange={onChange} />, container);
      getButton().click();
      expect(onChange).toHaveBeenCalledOnce();
      expect(onChange).toHaveBeenCalledWith('edit');
    });

    it('onChange callback fires with "view" on second click (edit → view)', () => {
      const onChange = vi.fn();
      cleanup = render(() => <LayoutModeToggle onChange={onChange} />, container);
      getButton().click(); // view → edit
      getButton().click(); // edit → view
      expect(onChange).toHaveBeenCalledTimes(2);
      expect(onChange).toHaveBeenLastCalledWith('view');
    });

    it('re-render sees updated mode after second toggle (back to Edit)', () => {
      cleanup = render(() => <LayoutModeToggle />, container);
      const btn = getButton();
      btn.click(); // view → edit
      btn.click(); // edit → view
      expect(btn.textContent).toContain('Edit');
    });
  });
});
