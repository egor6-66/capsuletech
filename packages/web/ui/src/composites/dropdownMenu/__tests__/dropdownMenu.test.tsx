/**
 * DropdownMenu composite tests.
 *
 * DropdownMenu delegates to the Dropdown primitive, which portal-mounts its
 * content to document.body via Kobalte. All queries against open-menu content
 * therefore use document.body, not the render container.
 *
 * Covered:
 *   - rendering 1 leaf item → 1 menuitem role
 *   - rendering a separator
 *   - rendering a group with a label
 *   - rendering a sub-menu: SubTrigger visible, click opens SubContent
 *   - onSelect fires for a leaf item
 *   - disabled item suppresses onSelect
 *   - icon rendered alongside label
 */
/* @vitest-environment jsdom */
import { render } from 'solid-js/web';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Button } from '../../../primitives/button';
import { DropdownMenu } from '../dropdownMenu';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let container: HTMLDivElement;
let cleanup: (() => void) | undefined;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
});

afterEach(() => {
  cleanup?.();
  cleanup = undefined;
  document.body.innerHTML = '';
});

/** Fires the pointer-down → pointer-up → click sequence expected by Kobalte. */
const click = (el: Element) => {
  el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
  el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true }));
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
};

/** Polls until a predicate is truthy or the timeout elapses. */
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

/** Opens the dropdown by clicking its trigger. */
const openMenu = async (triggerTestId = 'trigger') => {
  const trigger = container.querySelector(`[data-testid="${triggerTestId}"]`)!;
  click(trigger);
  // Wait until at least one menuitem (or menu role) appears in the portal.
  await waitFor(() => document.body.querySelector('[role="menu"]') !== null);
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DropdownMenu composite', () => {
  describe('leaf item rendering', () => {
    it('renders 1 item → 1 menuitem role after trigger click', async () => {
      cleanup = render(
        () => (
          <DropdownMenu
            trigger={<Button data-testid="trigger">Open</Button>}
            data={[{ type: 'item', id: 'item-1', label: 'Item One', onSelect: () => {} }]}
          />
        ),
        container,
      );

      await openMenu();

      const items = document.body.querySelectorAll('[role="menuitem"]');
      expect(items).toHaveLength(1);
      expect(items[0].textContent).toContain('Item One');
    });
  });

  describe('separator rendering', () => {
    it('renders a separator element inside the open dropdown', async () => {
      cleanup = render(
        () => (
          <DropdownMenu
            trigger={<Button data-testid="trigger">Open</Button>}
            data={[
              { type: 'item', id: 'item-a', label: 'Item A' },
              { type: 'separator', id: 'sep-1' },
              { type: 'item', id: 'item-b', label: 'Item B' },
            ]}
          />
        ),
        container,
      );

      await openMenu();

      // Kobalte renders DropdownMenu.Separator as <hr> (implicit role="separator").
      // jsdom does not automatically map implicit ARIA roles so we query the element directly.
      const sep = document.body.querySelector('hr');
      expect(sep).not.toBeNull();
    });
  });

  describe('group with label rendering', () => {
    it('renders group label text inside the open dropdown', async () => {
      cleanup = render(
        () => (
          <DropdownMenu
            trigger={<Button data-testid="trigger">Open</Button>}
            data={[
              {
                type: 'group',
                id: 'grp-1',
                label: 'Account',
                items: [
                  { type: 'item', id: 'profile', label: 'Profile' },
                  { type: 'item', id: 'settings', label: 'Settings' },
                ],
              },
            ]}
          />
        ),
        container,
      );

      await openMenu();

      // Kobalte renders group label with role="group" ancestor; text should be present.
      const bodyText = document.body.textContent ?? '';
      expect(bodyText).toContain('Account');
      expect(bodyText).toContain('Profile');
      expect(bodyText).toContain('Settings');
    });
  });

  describe('sub-menu rendering', () => {
    it('SubTrigger is visible when parent dropdown is open', async () => {
      cleanup = render(
        () => (
          <DropdownMenu
            trigger={<Button data-testid="trigger">Open</Button>}
            data={[
              { type: 'item', id: 'top-item', label: 'Top Item' },
              {
                type: 'sub',
                id: 'theme-sub',
                label: 'Color scheme',
                items: [
                  { type: 'item', id: 'black', label: 'Black' },
                  { type: 'item', id: 'ocean', label: 'Ocean' },
                ],
              },
            ]}
          />
        ),
        container,
      );

      await openMenu();

      const bodyText = document.body.textContent ?? '';
      expect(bodyText).toContain('Color scheme');
    });

    it('clicking SubTrigger opens the sub-menu content', async () => {
      cleanup = render(
        () => (
          <DropdownMenu
            trigger={<Button data-testid="trigger">Open</Button>}
            data={[
              {
                type: 'sub',
                id: 'theme-sub',
                label: 'Color scheme',
                items: [
                  { type: 'item', id: 'black', label: 'Black', onSelect: () => {} },
                  { type: 'item', id: 'ocean', label: 'Ocean', onSelect: () => {} },
                ],
              },
            ]}
          />
        ),
        container,
      );

      await openMenu();

      // Find the sub-trigger by its text content.
      const allItems = Array.from(document.body.querySelectorAll('[role="menuitem"]'));
      const subTrigger = allItems.find((el) => el.textContent?.includes('Color scheme'));
      expect(subTrigger).not.toBeNull();

      click(subTrigger!);
      await waitFor(() => {
        const texts = document.body.textContent ?? '';
        return texts.includes('Black') && texts.includes('Ocean');
      });

      const bodyText = document.body.textContent ?? '';
      expect(bodyText).toContain('Black');
      expect(bodyText).toContain('Ocean');
    });
  });

  describe('onSelect callback', () => {
    it('fires onSelect when a leaf item is activated', async () => {
      const onSelect = vi.fn();

      cleanup = render(
        () => (
          <DropdownMenu
            trigger={<Button data-testid="trigger">Open</Button>}
            data={[
              { type: 'item', id: 'action', label: 'Do action', onSelect },
            ]}
          />
        ),
        container,
      );

      await openMenu();

      const items = document.body.querySelectorAll('[role="menuitem"]');
      click(items[0]);

      await waitFor(() => onSelect.mock.calls.length > 0);
      expect(onSelect).toHaveBeenCalledOnce();
    });
  });

  describe('disabled item', () => {
    it('disabled item does not fire onSelect when clicked', async () => {
      const onSelect = vi.fn();

      cleanup = render(
        () => (
          <DropdownMenu
            trigger={<Button data-testid="trigger">Open</Button>}
            data={[
              { type: 'item', id: 'disabled', label: 'Cannot click', disabled: true, onSelect },
            ]}
          />
        ),
        container,
      );

      await openMenu();

      const items = document.body.querySelectorAll('[role="menuitem"]');
      click(items[0]);

      // Short grace — onSelect must NOT fire.
      await new Promise((r) => setTimeout(r, 50));
      expect(onSelect).not.toHaveBeenCalled();
    });
  });

  describe('icon rendering', () => {
    it('icon is rendered alongside the item label', async () => {
      cleanup = render(
        () => (
          <DropdownMenu
            trigger={<Button data-testid="trigger">Open</Button>}
            data={[
              {
                type: 'item',
                id: 'with-icon',
                label: 'With Icon',
                icon: <span data-testid="icon">★</span>,
              },
            ]}
          />
        ),
        container,
      );

      await openMenu();

      const icon = document.body.querySelector('[data-testid="icon"]');
      expect(icon).not.toBeNull();
      expect(icon!.textContent).toBe('★');
    });
  });
});
