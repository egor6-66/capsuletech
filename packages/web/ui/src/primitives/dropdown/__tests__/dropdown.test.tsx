/**
 * Dropdown primitive tests.
 *
 * Kobalte's DropdownMenu renders its content inside a Portal (teleported to
 * document.body). This means the content is NOT a descendant of the render
 * container — tests query document.body directly when the menu is open.
 *
 * Covered:
 *   - Content is absent from DOM when closed.
 *   - Clicking Trigger shows Content items.
 *   - Item onSelect fires on click.
 *   - Menu closes (content removed) after item selection.
 *   - Separator renders inside an open dropdown.
 *   - Disabled item does not fire onSelect.
 *   - Disabled item carries data-disabled attribute.
 *   - Content is Portal-mounted (not a child of the render container).
 *   - SubTrigger is visible inside an open dropdown.
 *   - Clicking SubTrigger opens the submenu (SubContent).
 *   - Label renders with correct text.
 */
/* @vitest-environment jsdom */
import { render } from 'solid-js/web';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Dropdown } from '../dropdown';

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

let container: HTMLDivElement;
let cleanup: (() => void) | undefined;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
});

afterEach(() => {
  cleanup?.();
  cleanup = undefined;
  // Remove the container AND anything Kobalte's Portal left in body.
  document.body.innerHTML = '';
});

/** Triggers a pointer-down + pointer-up + click sequence on an element. */
const click = (el: Element) => {
  el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
  el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true }));
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
};

/** Waits for a predicate to be truthy, polling up to `ms` ms. */
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

// --------------------------------------------------------------------------
// Tests
// --------------------------------------------------------------------------

describe('Dropdown', () => {
  describe('closed state', () => {
    it('content items are absent from DOM before trigger click', () => {
      cleanup = render(
        () => (
          <Dropdown>
            <Dropdown.Trigger data-testid="trigger">Open</Dropdown.Trigger>
            <Dropdown.Content>
              <Dropdown.Item data-testid="item-one">Item One</Dropdown.Item>
            </Dropdown.Content>
          </Dropdown>
        ),
        container,
      );

      expect(document.body.querySelector('[data-testid="item-one"]')).toBeNull();
    });
  });

  describe('Trigger opens Content', () => {
    it('clicking trigger makes content items visible', async () => {
      cleanup = render(
        () => (
          <Dropdown>
            <Dropdown.Trigger data-testid="trigger">Open</Dropdown.Trigger>
            <Dropdown.Content>
              <Dropdown.Item data-testid="item-one">Item One</Dropdown.Item>
              <Dropdown.Item data-testid="item-two">Item Two</Dropdown.Item>
            </Dropdown.Content>
          </Dropdown>
        ),
        container,
      );

      const trigger = container.querySelector('[data-testid="trigger"]')!;
      click(trigger);

      await waitFor(() => document.body.querySelector('[data-testid="item-one"]') !== null);

      expect(document.body.querySelector('[data-testid="item-one"]')).not.toBeNull();
      expect(document.body.querySelector('[data-testid="item-two"]')).not.toBeNull();
    });
  });

  describe('Item interaction', () => {
    it('onSelect fires when item is clicked', async () => {
      const onSelect = vi.fn();
      cleanup = render(
        () => (
          <Dropdown>
            <Dropdown.Trigger data-testid="trigger">Open</Dropdown.Trigger>
            <Dropdown.Content>
              <Dropdown.Item data-testid="item-one" onSelect={onSelect}>
                Item One
              </Dropdown.Item>
            </Dropdown.Content>
          </Dropdown>
        ),
        container,
      );

      click(container.querySelector('[data-testid="trigger"]')!);
      await waitFor(() => document.body.querySelector('[data-testid="item-one"]') !== null);

      click(document.body.querySelector('[data-testid="item-one"]')!);

      await waitFor(() => onSelect.mock.calls.length > 0);
      expect(onSelect).toHaveBeenCalledOnce();
    });

    it('menu closes (content removed) after item selection', async () => {
      const onSelect = vi.fn();
      cleanup = render(
        () => (
          <Dropdown>
            <Dropdown.Trigger data-testid="trigger">Open</Dropdown.Trigger>
            <Dropdown.Content>
              <Dropdown.Item data-testid="item-one" onSelect={onSelect}>
                Item One
              </Dropdown.Item>
            </Dropdown.Content>
          </Dropdown>
        ),
        container,
      );

      click(container.querySelector('[data-testid="trigger"]')!);
      await waitFor(() => document.body.querySelector('[data-testid="item-one"]') !== null);

      click(document.body.querySelector('[data-testid="item-one"]')!);

      await waitFor(() => document.body.querySelector('[data-testid="item-one"]') === null);
      expect(document.body.querySelector('[data-testid="item-one"]')).toBeNull();
    });
  });

  describe('Separator', () => {
    it('separator renders inside open dropdown', async () => {
      cleanup = render(
        () => (
          <Dropdown>
            <Dropdown.Trigger data-testid="trigger">Open</Dropdown.Trigger>
            <Dropdown.Content>
              <Dropdown.Item>Item A</Dropdown.Item>
              <Dropdown.Separator data-testid="sep" />
              <Dropdown.Item>Item B</Dropdown.Item>
            </Dropdown.Content>
          </Dropdown>
        ),
        container,
      );

      click(container.querySelector('[data-testid="trigger"]')!);
      await waitFor(() => document.body.querySelector('[data-testid="sep"]') !== null);

      expect(document.body.querySelector('[data-testid="sep"]')).not.toBeNull();
    });
  });

  describe('Disabled item', () => {
    it('disabled item does not fire onSelect when clicked', async () => {
      const onSelect = vi.fn();
      cleanup = render(
        () => (
          <Dropdown>
            <Dropdown.Trigger data-testid="trigger">Open</Dropdown.Trigger>
            <Dropdown.Content>
              <Dropdown.Item data-testid="disabled-item" disabled onSelect={onSelect}>
                Cannot click
              </Dropdown.Item>
            </Dropdown.Content>
          </Dropdown>
        ),
        container,
      );

      click(container.querySelector('[data-testid="trigger"]')!);
      await waitFor(() => document.body.querySelector('[data-testid="disabled-item"]') !== null);

      click(document.body.querySelector('[data-testid="disabled-item"]')!);

      // Small grace period — if onSelect were going to fire, it would fire synchronously.
      await new Promise((r) => setTimeout(r, 50));
      expect(onSelect).not.toHaveBeenCalled();
    });

    it('disabled item has data-disabled attribute', async () => {
      cleanup = render(
        () => (
          <Dropdown>
            <Dropdown.Trigger data-testid="trigger">Open</Dropdown.Trigger>
            <Dropdown.Content>
              <Dropdown.Item data-testid="disabled-item" disabled>
                Disabled
              </Dropdown.Item>
            </Dropdown.Content>
          </Dropdown>
        ),
        container,
      );

      click(container.querySelector('[data-testid="trigger"]')!);
      await waitFor(() => document.body.querySelector('[data-testid="disabled-item"]') !== null);

      const item = document.body.querySelector('[data-testid="disabled-item"]')!;
      expect(item.hasAttribute('data-disabled')).toBe(true);
    });
  });

  describe('Portal mounting', () => {
    it('content is in document.body, NOT inside the render container', async () => {
      cleanup = render(
        () => (
          <Dropdown>
            <Dropdown.Trigger data-testid="trigger">Open</Dropdown.Trigger>
            <Dropdown.Content>
              <Dropdown.Item data-testid="portal-item">Portal item</Dropdown.Item>
            </Dropdown.Content>
          </Dropdown>
        ),
        container,
      );

      click(container.querySelector('[data-testid="trigger"]')!);
      await waitFor(() => document.body.querySelector('[data-testid="portal-item"]') !== null);

      const item = document.body.querySelector('[data-testid="portal-item"]')!;
      // Must be in body
      expect(document.body.contains(item)).toBe(true);
      // Must NOT be a descendant of the render container
      expect(container.contains(item)).toBe(false);
    });
  });

  describe('Submenu', () => {
    it('SubTrigger is visible when parent dropdown is open', async () => {
      cleanup = render(
        () => (
          <Dropdown>
            <Dropdown.Trigger data-testid="trigger">Open</Dropdown.Trigger>
            <Dropdown.Content>
              <Dropdown.Item data-testid="item-a">Item A</Dropdown.Item>
              <Dropdown.Sub>
                <Dropdown.SubTrigger data-testid="sub-trigger">More</Dropdown.SubTrigger>
                <Dropdown.SubContent>
                  <Dropdown.Item data-testid="sub-item">Sub Item</Dropdown.Item>
                </Dropdown.SubContent>
              </Dropdown.Sub>
            </Dropdown.Content>
          </Dropdown>
        ),
        container,
      );

      click(container.querySelector('[data-testid="trigger"]')!);
      await waitFor(() => document.body.querySelector('[data-testid="sub-trigger"]') !== null);

      expect(document.body.querySelector('[data-testid="sub-trigger"]')).not.toBeNull();
    });

    it('clicking SubTrigger opens the submenu', async () => {
      cleanup = render(
        () => (
          <Dropdown>
            <Dropdown.Trigger data-testid="trigger">Open</Dropdown.Trigger>
            <Dropdown.Content>
              <Dropdown.Sub>
                <Dropdown.SubTrigger data-testid="sub-trigger">More</Dropdown.SubTrigger>
                <Dropdown.SubContent>
                  <Dropdown.Item data-testid="sub-item">Sub Item</Dropdown.Item>
                </Dropdown.SubContent>
              </Dropdown.Sub>
            </Dropdown.Content>
          </Dropdown>
        ),
        container,
      );

      click(container.querySelector('[data-testid="trigger"]')!);
      await waitFor(() => document.body.querySelector('[data-testid="sub-trigger"]') !== null);

      click(document.body.querySelector('[data-testid="sub-trigger"]')!);
      await waitFor(() => document.body.querySelector('[data-testid="sub-item"]') !== null);

      expect(document.body.querySelector('[data-testid="sub-item"]')).not.toBeNull();
    });
  });

  describe('Label', () => {
    it('label renders with correct text inside open dropdown (must be inside Group)', async () => {
      cleanup = render(
        () => (
          <Dropdown>
            <Dropdown.Trigger data-testid="trigger">Open</Dropdown.Trigger>
            <Dropdown.Content>
              <Dropdown.Group>
                <Dropdown.Label data-testid="label">Section Title</Dropdown.Label>
                <Dropdown.Item>Item</Dropdown.Item>
              </Dropdown.Group>
            </Dropdown.Content>
          </Dropdown>
        ),
        container,
      );

      click(container.querySelector('[data-testid="trigger"]')!);
      await waitFor(() => document.body.querySelector('[data-testid="label"]') !== null);

      expect(document.body.querySelector('[data-testid="label"]')!.textContent).toBe(
        'Section Title',
      );
    });
  });
});
