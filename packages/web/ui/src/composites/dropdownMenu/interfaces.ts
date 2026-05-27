import type { DropdownMenuRootProps } from '@kobalte/core/dropdown-menu';
import type { JSX } from 'solid-js';

/**
 * A leaf menu item that the user can activate.
 * Renders as a single clickable row in the dropdown panel.
 */
export interface IDropdownMenuItemLeaf {
  type: 'item';
  /** Unique key — used as JSX `key` and for list reconciliation. */
  id: string;
  /** Visible label. May be a string or any JSX (e.g. styled text). */
  label: string | JSX.Element;
  /** Called when the item is selected (click or keyboard Enter/Space). */
  onSelect?: () => void;
  /** Optional icon rendered before the label. */
  icon?: JSX.Element;
  /** When true the item is rendered but cannot be activated. */
  disabled?: boolean;
}

/**
 * A sub-menu item — renders as a row with a right-arrow indicator.
 * Hovering or pressing ArrowRight opens a nested `Dropdown.SubContent` panel.
 * `items` is recursive: each child may itself be a sub, group, separator, or leaf.
 */
export interface IDropdownMenuItemSub {
  type: 'sub';
  /** Unique key for JSX reconciliation. */
  id: string;
  /** Visible label of the sub-trigger row. */
  label: string | JSX.Element;
  /** Nested menu items rendered inside the submenu panel. */
  items: IDropdownMenuItem[];
  /** Optional icon rendered before the label on the sub-trigger row. */
  icon?: JSX.Element;
}

/**
 * A non-interactive visual divider between sections of a menu.
 * Renders as `<hr role="separator">` via `Dropdown.Separator`.
 */
export interface IDropdownMenuItemSeparator {
  type: 'separator';
  /** Unique key for JSX reconciliation. */
  id: string;
}

/**
 * A semantically grouped set of items with an optional heading.
 * Renders as `Dropdown.Group` + optional `Dropdown.Label`.
 * Typically contains leaf items, though sub-menus are also supported.
 */
export interface IDropdownMenuItemGroup {
  type: 'group';
  /** Unique key for JSX reconciliation. */
  id: string;
  /** Optional non-interactive heading rendered above the group's items. */
  label?: string | JSX.Element;
  /** Items belonging to this group. */
  items: IDropdownMenuItem[];
}

/**
 * Union of all supported menu item descriptor types.
 * Pass an array of these to `DropdownMenu.data`.
 */
export type IDropdownMenuItem =
  | IDropdownMenuItemLeaf
  | IDropdownMenuItemSub
  | IDropdownMenuItemSeparator
  | IDropdownMenuItemGroup;

/**
 * Props for the declarative `DropdownMenu` composite.
 *
 * This composite mirrors the `DataTable` pattern: Shape passes `data` (a flat
 * or nested array of item descriptors) and the composite builds the full
 * `Dropdown` tree internally. For full compositional control use `Dropdown`
 * directly.
 */
export interface IDropdownMenuProps
  extends Pick<
    DropdownMenuRootProps,
    'open' | 'defaultOpen' | 'onOpenChange' | 'placement' | 'gutter'
  > {
  /**
   * The element that opens the dropdown (typically a `<Button>`).
   * Rendered inside `Dropdown.Trigger` as its child.
   */
  trigger: JSX.Element;
  /**
   * Declarative menu tree. Supports four node types:
   * - `'item'` — leaf action row
   * - `'sub'` — nested submenu (recursive)
   * - `'separator'` — visual divider
   * - `'group'` — labeled group of items
   */
  data: IDropdownMenuItem[];
}
