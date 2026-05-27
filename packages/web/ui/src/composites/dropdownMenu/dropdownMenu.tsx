import { For, Show, splitProps } from 'solid-js';
import type { JSX } from 'solid-js';

import { Dropdown } from '../../primitives/dropdown';
import type { IDropdownMenuItem, IDropdownMenuProps } from './interfaces';

/**
 * Recursively renders an array of `IDropdownMenuItem` descriptors into the
 * appropriate `Dropdown.*` compound elements.
 *
 * Called both for top-level `data` and for nested `items` inside sub-menus
 * and groups — this is what makes the tree recursive.
 */
function renderItems(items: IDropdownMenuItem[]): JSX.Element {
  return (
    <For each={items}>
      {(item) => {
        if (item.type === 'separator') {
          return <Dropdown.Separator />;
        }

        if (item.type === 'group') {
          return (
            <Dropdown.Group>
              <Show when={item.label !== undefined}>
                <Dropdown.Label>{item.label}</Dropdown.Label>
              </Show>
              {renderItems(item.items)}
            </Dropdown.Group>
          );
        }

        if (item.type === 'sub') {
          return (
            <Dropdown.Sub>
              <Dropdown.SubTrigger>
                <Show when={item.icon !== undefined}>{item.icon}</Show>
                {item.label}
              </Dropdown.SubTrigger>
              <Dropdown.SubContent>{renderItems(item.items)}</Dropdown.SubContent>
            </Dropdown.Sub>
          );
        }

        // item.type === 'item'
        return (
          <Dropdown.Item onSelect={item.onSelect} disabled={item.disabled}>
            <Show when={item.icon !== undefined}>{item.icon}</Show>
            {item.label}
          </Dropdown.Item>
        );
      }}
    </For>
  );
}

/**
 * Declarative dropdown menu composite.
 *
 * Accepts a `trigger` element and a `data` array of item descriptors and
 * builds the full `Dropdown` tree automatically. Mirrors the `DataTable`
 * pattern — Shape passes the data array and the composite owns the rendering.
 *
 * For full compositional control (custom item layouts, icons as components,
 * etc.) use the lower-level `Dropdown` primitive directly.
 *
 * @example
 * ```tsx
 * <DropdownMenu
 *   trigger={<Button variant="outline">Open</Button>}
 *   data={[
 *     { type: 'item', id: 'profile', label: 'Profile', onSelect: () => navigate('/profile') },
 *     { type: 'separator', id: 'sep-1' },
 *     { type: 'item', id: 'logout', label: 'Logout', onSelect: logout },
 *   ]}
 * />
 * ```
 */
export function DropdownMenu(props: IDropdownMenuProps): JSX.Element {
  const [own, rest] = splitProps(props, ['trigger', 'data']);
  return (
    <Dropdown {...rest}>
      <Dropdown.Trigger>{own.trigger}</Dropdown.Trigger>
      <Dropdown.Content>{renderItems(own.data)}</Dropdown.Content>
    </Dropdown>
  );
}
