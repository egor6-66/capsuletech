import { cn } from '@capsuletech/web-style';
import { DropdownMenu as KobalteDropdown } from '@kobalte/core/dropdown-menu';
import { splitProps } from 'solid-js';

import type {
  IDropdownContentProps,
  IDropdownGroupProps,
  IDropdownItemProps,
  IDropdownLabelProps,
  IDropdownProps,
  IDropdownSeparatorProps,
  IDropdownSubContentProps,
  IDropdownSubProps,
  IDropdownSubTriggerProps,
  IDropdownTriggerProps,
} from './interfaces';
import {
  dropdownContentCva,
  dropdownItemCva,
  dropdownLabelCva,
  dropdownSeparatorCva,
} from './variants';

/**
 * Root dropdown container — thin pass-through to `KobalteDropdown.Root`.
 * Manages open/close state. Accepts all Kobalte root props (open, defaultOpen,
 * onOpenChange, placement, gutter, …).
 */
const DropdownImpl = (props: IDropdownProps) => <KobalteDropdown {...props} />;

/**
 * Button (or any element via `as`) that opens the dropdown on click.
 */
const Trigger = (props: IDropdownTriggerProps) => {
  const [local, others] = splitProps(props, ['class']);
  return <KobalteDropdown.Trigger class={cn(local.class)} {...(others as object)} />;
};

/**
 * Dropdown panel teleported into a Portal (mounted on `document.body` by default).
 * Kobalte uses Floating UI internally for viewport-safe collision detection + flip.
 */
const Content = (props: IDropdownContentProps) => {
  const [local, others] = splitProps(props, ['class', 'style', 'portalProps']);
  return (
    <KobalteDropdown.Portal {...local.portalProps}>
      <KobalteDropdown.Content
        class={cn(dropdownContentCva(), local.class)}
        style={local.style}
        {...(others as object)}
      />
    </KobalteDropdown.Portal>
  );
};

/**
 * Interactive menu item. Calls `onSelect` when activated.
 * Kobalte sets `data-[highlighted]` on keyboard/hover focus and `data-[disabled]`
 * when disabled — both are styled via `dropdownItemCva`.
 */
const Item = (props: IDropdownItemProps) => {
  const [local, others] = splitProps(props, ['class']);
  return (
    <KobalteDropdown.Item
      class={cn(dropdownItemCva(), local.class)}
      {...(others as object)}
    />
  );
};

/**
 * Non-interactive visual divider. Renders `role="separator"` for accessibility.
 */
const Separator = (props: IDropdownSeparatorProps) => {
  const [local, others] = splitProps(props, ['class']);
  return (
    <KobalteDropdown.Separator
      class={cn(dropdownSeparatorCva(), local.class)}
      {...(others as object)}
    />
  );
};

/**
 * Semantic group wrapper. Provides `aria-labelledby` linkage between `Label`
 * and the items it annotates. Use together with `Dropdown.Label`:
 *
 * ```tsx
 * <Dropdown.Group>
 *   <Dropdown.Label>Account</Dropdown.Label>
 *   <Dropdown.Item>Profile</Dropdown.Item>
 * </Dropdown.Group>
 * ```
 */
const Group = (props: IDropdownGroupProps) => <KobalteDropdown.Group {...props} />;

/**
 * Non-interactive heading for a group. Must be rendered inside `Dropdown.Group`.
 * Does not receive keyboard focus.
 */
const Label = (props: IDropdownLabelProps) => {
  const [local, others] = splitProps(props, ['class']);
  return (
    <KobalteDropdown.GroupLabel
      class={cn(dropdownLabelCva(), local.class)}
      {...(others as object)}
    />
  );
};

/**
 * Container for a nested submenu. Must contain exactly one `SubTrigger` and one `SubContent`.
 */
const Sub = (props: IDropdownSubProps) => <KobalteDropdown.Sub {...props} />;

/**
 * An item that opens a nested submenu when hovered or when the right-arrow key is pressed.
 */
const SubTrigger = (props: IDropdownSubTriggerProps) => {
  const [local, others] = splitProps(props, ['class']);
  return (
    <KobalteDropdown.SubTrigger
      class={cn(dropdownItemCva(), local.class)}
      {...(others as object)}
    />
  );
};

/**
 * Panel for a nested submenu — same Portal + collision-detection behaviour as `Content`.
 */
const SubContent = (props: IDropdownSubContentProps) => {
  const [local, others] = splitProps(props, ['class', 'style', 'portalProps']);
  return (
    <KobalteDropdown.Portal {...local.portalProps}>
      <KobalteDropdown.Content
        class={cn(dropdownContentCva(), local.class)}
        style={local.style}
        {...(others as object)}
      />
    </KobalteDropdown.Portal>
  );
};

/**
 * Accessible dropdown menu primitive built on `@kobalte/core/dropdown-menu`.
 *
 * Features:
 * - Keyboard navigation (arrow keys, Enter, Escape, Tab).
 * - Auto-positioning via Floating UI — never clips beyond the viewport.
 * - Portal-based content (mounted on `document.body`) to avoid z-index/overflow issues.
 * - Nested submenus via `Dropdown.Sub` + `Dropdown.SubTrigger` + `Dropdown.SubContent`.
 *
 * @example
 * ```tsx
 * <Dropdown>
 *   <Dropdown.Trigger as={Button} variant="outline">Open</Dropdown.Trigger>
 *   <Dropdown.Content>
 *     <Dropdown.Group>
 *       <Dropdown.Label>Account</Dropdown.Label>
 *       <Dropdown.Item onSelect={() => logout()}>Logout</Dropdown.Item>
 *     </Dropdown.Group>
 *     <Dropdown.Separator />
 *     <Dropdown.Sub>
 *       <Dropdown.SubTrigger>Color scheme</Dropdown.SubTrigger>
 *       <Dropdown.SubContent>
 *         <Dropdown.Item onSelect={() => setTheme('black')}>Black</Dropdown.Item>
 *         <Dropdown.Item onSelect={() => setTheme('ocean')}>Ocean</Dropdown.Item>
 *       </Dropdown.SubContent>
 *     </Dropdown.Sub>
 *   </Dropdown.Content>
 * </Dropdown>
 * ```
 */
export const Dropdown = Object.assign(DropdownImpl, {
  Trigger,
  Content,
  Item,
  Separator,
  Group,
  Label,
  Sub,
  SubTrigger,
  SubContent,
});

// Named re-exports под Table-pattern (web-core lazy uses individual symbols).
// `Dropdown.Trigger`-style стабильный compound — выше, эти aliases — для
// `createLazy(..., 'DropdownTrigger')` в web-core/ui-kit/imports.tsx.
export {
  Trigger as DropdownTrigger,
  Content as DropdownContent,
  Item as DropdownItem,
  Separator as DropdownSeparator,
  Group as DropdownGroup,
  Label as DropdownLabel,
  Sub as DropdownSub,
  SubTrigger as DropdownSubTrigger,
  SubContent as DropdownSubContent,
};
