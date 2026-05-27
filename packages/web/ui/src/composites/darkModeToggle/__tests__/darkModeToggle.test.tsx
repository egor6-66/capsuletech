/**
 * DarkModeToggle composite tests.
 *
 * Tests render + interaction via solid-js/web render in jsdom.
 * The @capsuletech/web-style switcher/theme module uses module-level signals;
 * we mock it inline to keep tests isolated and avoid matchMedia/localStorage
 * side effects from interfering with each other.
 */
/* @vitest-environment jsdom */
import { render } from 'solid-js/web';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock @capsuletech/web-style — vi.mock is hoisted, no outer-scope refs.
// ---------------------------------------------------------------------------

vi.mock('@capsuletech/web-style', async () => {
  const { createSignal } = await import('solid-js');
  const [isDark, setIsDark] = createSignal(false);

  return {
    useDarkMode: () => isDark,
    toggleDarkMode: vi.fn((_target?: HTMLElement) => {
      setIsDark((prev) => !prev);
    }),
    setDarkMode: vi.fn((dark: boolean, _target?: HTMLElement) => setIsDark(dark)),
    // Stubs for other symbols used transitively by other imports.
    useTheme: () => () => 'black',
    setTheme: vi.fn(),
    useLayoutMode: () => () => 'view' as const,
    toggleLayoutMode: vi.fn(),
    setLayoutMode: vi.fn(),
    DISCOVERED_THEMES: ['black', 'zen'],
    cva: vi.fn((_base: string, _config?: unknown) => () => ''),
    createStyle: vi.fn((_cva: unknown, _props: unknown) => ({
      className: () => '',
      style: () => undefined,
    })),
    cn: (...args: string[]) => args.filter(Boolean).join(' '),
  };
});

import { setDarkMode } from '@capsuletech/web-style';
import { DarkModeToggle } from '../darkModeToggle';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let container: HTMLDivElement;
let cleanup: (() => void) | undefined;

beforeEach(() => {
  // Reset dark mode to false so every test starts from the same initial state.
  vi.mocked(setDarkMode)(false);
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

describe('DarkModeToggle composite', () => {
  describe('rendering', () => {
    it('renders a button element', () => {
      cleanup = render(() => <DarkModeToggle />, container);
      expect(getButton()).not.toBeNull();
    });

    it('shows moon icon (☾) in light mode', () => {
      cleanup = render(() => <DarkModeToggle />, container);
      expect(getButton().textContent).toContain('☾');
    });

    it('has aria-label "Switch to dark mode" in light mode', () => {
      cleanup = render(() => <DarkModeToggle />, container);
      expect(getButton().getAttribute('aria-label')).toBe('Switch to dark mode');
    });

    it('forwards extra class to the button', () => {
      cleanup = render(() => <DarkModeToggle class="extra-class" />, container);
      expect(getButton().className).toContain('extra-class');
    });
  });

  describe('interaction', () => {
    it('click toggles icon from moon to sun', () => {
      cleanup = render(() => <DarkModeToggle />, container);
      const btn = getButton();
      expect(btn.textContent).toContain('☾');
      btn.click();
      expect(btn.textContent).toContain('☀');
    });

    it('click changes aria-label to "Switch to light mode" after toggle', () => {
      cleanup = render(() => <DarkModeToggle />, container);
      const btn = getButton();
      btn.click();
      expect(btn.getAttribute('aria-label')).toBe('Switch to light mode');
    });

    it('onChange callback fires with post-toggle isDark value (true after first click)', () => {
      const onChange = vi.fn();
      cleanup = render(() => <DarkModeToggle onChange={onChange} />, container);
      getButton().click();
      expect(onChange).toHaveBeenCalledOnce();
      expect(onChange).toHaveBeenCalledWith(true);
    });

    it('onChange callback fires with false on second click (toggled back)', () => {
      const onChange = vi.fn();
      cleanup = render(() => <DarkModeToggle onChange={onChange} />, container);
      getButton().click(); // light → dark
      getButton().click(); // dark → light
      expect(onChange).toHaveBeenCalledTimes(2);
      expect(onChange).toHaveBeenLastCalledWith(false);
    });
  });
});
