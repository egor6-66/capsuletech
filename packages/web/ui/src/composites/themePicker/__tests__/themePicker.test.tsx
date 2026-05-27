/**
 * ThemePicker composite tests.
 *
 * ThemePicker uses the Dropdown primitive (Kobalte) which portal-mounts its
 * content to document.body. All queries against open-menu content therefore
 * use document.body, not the render container.
 *
 * Covered:
 *   - component renders without crash
 *   - trigger shows current theme name
 *   - opening the dropdown lists all theme items
 *   - selecting a theme calls onChange with that theme name
 *   - active theme shows checkmark (✓) in the list
 *   - custom triggerLabel overrides the default "Theme: <name>" text
 *   - trigger text updates after theme selection
 */
/* @vitest-environment jsdom */
import { render } from 'solid-js/web';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock @capsuletech/web-style — vi.mock is hoisted, no outer-scope refs.
// ---------------------------------------------------------------------------

vi.mock('@capsuletech/web-style', async () => {
  const { createSignal } = await import('solid-js');
  const THEMES = ['black', 'damon', 'zen'];
  const [theme, setThemeSignal] = createSignal<string>(THEMES[0]!);

  return {
    DISCOVERED_THEMES: THEMES,
    useTheme: () => theme,
    setTheme: vi.fn((name: string, _target?: HTMLElement) => {
      if (THEMES.includes(name)) setThemeSignal(name);
    }),
    // Stubs for other symbols imported transitively (e.g. dropdown/variants.ts → cva).
    cva: vi.fn((_base: string, _config?: unknown) => () => ''),
    cn: (...args: string[]) => args.filter(Boolean).join(' '),
    createStyle: vi.fn((_cva: unknown, _props: unknown) => ({
      className: () => '',
      style: () => undefined,
    })),
    useDarkMode: () => () => false,
    toggleDarkMode: vi.fn(),
    setDarkMode: vi.fn(),
    useLayoutMode: () => () => 'view' as const,
    toggleLayoutMode: vi.fn(),
    setLayoutMode: vi.fn(),
  };
});

import { setTheme } from '@capsuletech/web-style';
import { ThemePicker } from '../themePicker';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let container: HTMLDivElement;
let cleanup: (() => void) | undefined;

beforeEach(() => {
  // Reset theme to 'black' so every test starts from the same initial state.
  vi.mocked(setTheme)('black');
  vi.mocked(setTheme).mockClear();
  container = document.createElement('div');
  document.body.appendChild(container);
});

afterEach(() => {
  cleanup?.();
  cleanup = undefined;
  document.body.innerHTML = '';
});

/** Fires pointer-down → pointer-up → click sequence expected by Kobalte. */
const click = (el: Element) => {
  el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
  el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true }));
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
};

/** Polls until predicate is truthy or timeout elapses. */
const waitFor = (predicate: () => boolean, ms = 300): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      if (predicate()) return resolve();
      if (Date.now() - start > ms) return reject(new Error('waitFor timeout'));
      setTimeout(check, 10);
    };
    check();
  });

const getTrigger = () => container.querySelector('button')!;

const openDropdown = async () => {
  click(getTrigger());
  await waitFor(() => document.body.querySelector('[role="menu"]') !== null);
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

import { Dropdown } from '../../../primitives/dropdown';

describe('ThemePicker composite', () => {
  describe('rendering', () => {
    it('renders a trigger button', () => {
      cleanup = render(() => <ThemePicker />, container);
      expect(getTrigger()).not.toBeNull();
    });

    it('trigger shows current theme name (initial: "black")', () => {
      cleanup = render(() => <ThemePicker />, container);
      expect(getTrigger().textContent).toContain('black');
    });

    it('custom triggerLabel overrides the default Theme: <name> text', () => {
      cleanup = render(() => <ThemePicker triggerLabel="Pick theme" />, container);
      expect(getTrigger().textContent).toContain('Pick theme');
      expect(getTrigger().textContent).not.toContain('Theme:');
    });
  });

  describe('dropdown items', () => {
    it('opening the dropdown shows all theme names as menu items', async () => {
      cleanup = render(() => <ThemePicker themes={['black', 'damon', 'zen']} />, container);
      await openDropdown();

      const bodyText = document.body.textContent ?? '';
      expect(bodyText).toContain('black');
      expect(bodyText).toContain('damon');
      expect(bodyText).toContain('zen');
    });

    it('active theme has a checkmark visible in the list', async () => {
      cleanup = render(() => <ThemePicker themes={['black', 'damon', 'zen']} />, container);
      await openDropdown();

      // The checkmark ✓ is rendered inside an inline-block span next to each item.
      // Only the active theme (black) should have visible checkmark text.
      const items = Array.from(document.body.querySelectorAll('[role="menuitem"]'));
      const blackItem = items.find((el) => el.textContent?.includes('black'));
      expect(blackItem?.textContent).toContain('✓');
    });
  });

  describe('onChange callback', () => {
    it('selecting a theme fires onChange with that theme name', async () => {
      const onChange = vi.fn();
      cleanup = render(
        () => <ThemePicker themes={['black', 'damon', 'zen']} onChange={onChange} />,
        container,
      );
      await openDropdown();

      const items = Array.from(document.body.querySelectorAll('[role="menuitem"]'));
      const damonItem = items.find((el) => el.textContent?.includes('damon'))!;
      click(damonItem);

      await waitFor(() => onChange.mock.calls.length > 0);
      expect(onChange).toHaveBeenCalledWith('damon');
    });
  });

  describe('sub mode', () => {
    it('mode="sub" does not render its own root trigger button — only the parent Trigger appears', () => {
      cleanup = render(
        () => (
          <Dropdown>
            <Dropdown.Trigger>Parent</Dropdown.Trigger>
            <Dropdown.Content>
              <ThemePicker mode="sub" />
            </Dropdown.Content>
          </Dropdown>
        ),
        container,
      );

      // Only the parent Dropdown.Trigger button is in the container.
      // ThemePicker in sub mode must NOT inject its own root trigger button.
      const buttons = container.querySelectorAll('button');
      expect(buttons.length).toBe(1);
      expect(buttons[0]!.textContent).toContain('Parent');
    });

    it('mode="sub" — SubTrigger is in the parent menu and SubContent reveals theme items on click', async () => {
      cleanup = render(
        () => (
          <Dropdown>
            <Dropdown.Trigger>Parent</Dropdown.Trigger>
            <Dropdown.Content>
              <ThemePicker
                mode="sub"
                themes={['black', 'damon', 'zen']}
                triggerLabel={<span data-testid="sub-trigger-label">Theme</span>}
              />
            </Dropdown.Content>
          </Dropdown>
        ),
        container,
      );

      // Open the parent dropdown.
      click(container.querySelector('button')!);
      await waitFor(() => document.body.querySelector('[role="menu"]') !== null);

      // The sub-trigger label is now visible inside the portal-mounted parent menu.
      const subTriggerLabel = document.body.querySelector('[data-testid="sub-trigger-label"]');
      expect(subTriggerLabel).not.toBeNull();

      // Click the SubTrigger element (its closest ancestor with role=menuitem).
      const subTriggerEl = subTriggerLabel!.closest('[role="menuitem"]') ?? subTriggerLabel!.parentElement!;
      click(subTriggerEl);

      // Wait for sub-menu items to appear (two role=menu panels: parent + sub).
      await waitFor(() => document.body.querySelectorAll('[role="menu"]').length >= 2);

      const bodyText = document.body.textContent ?? '';
      expect(bodyText).toContain('black');
      expect(bodyText).toContain('damon');
      expect(bodyText).toContain('zen');

      // Active theme (black) must have the checkmark.
      const items = Array.from(document.body.querySelectorAll('[role="menuitem"]'));
      const blackItem = items.find(
        (el) => el.textContent?.includes('black') && el.textContent.includes('✓'),
      );
      expect(blackItem).not.toBeNull();
    });
  });

  describe('re-render', () => {
    it('trigger text updates after theme selection', async () => {
      cleanup = render(() => <ThemePicker themes={['black', 'damon', 'zen']} />, container);

      // Initial state shows 'black'.
      expect(getTrigger().textContent).toContain('black');

      await openDropdown();
      const items = Array.from(document.body.querySelectorAll('[role="menuitem"]'));
      const zenItem = items.find((el) => el.textContent?.includes('zen'))!;
      click(zenItem);

      await waitFor(() => getTrigger().textContent?.includes('zen') ?? false);
      expect(getTrigger().textContent).toContain('zen');
    });
  });
});
