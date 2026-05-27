import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { Mail, Moon, Palette, Settings, Sun, Trash2, User } from 'lucide-solid';

import { Button } from '../../primitives/button';
import { DropdownMenu } from './dropdownMenu';
import type { IDropdownMenuItem } from './interfaces';

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

const meta = {
  title: 'Composites/DropdownMenu',
  component: DropdownMenu,
  tags: ['autodocs'],
  decorators: [
    (Story: () => import('solid-js').JSX.Element) => (
      <div class="flex min-h-64 items-start justify-center p-8">
        {Story()}
      </div>
    ),
  ],
} satisfies Meta<typeof DropdownMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

// ---------------------------------------------------------------------------
// Basic — 3 leaf items
// ---------------------------------------------------------------------------

export const Basic: Story = {
  name: 'basic · 3 items',
  render: () => (
    <DropdownMenu
      trigger={<Button variant="outline">Open menu</Button>}
      data={[
        { type: 'item', id: 'profile', label: 'Profile', onSelect: () => console.log('Profile') },
        { type: 'item', id: 'settings', label: 'Settings', onSelect: () => console.log('Settings') },
        { type: 'item', id: 'logout', label: 'Logout', onSelect: () => console.log('Logout') },
      ]}
    />
  ),
};

// ---------------------------------------------------------------------------
// WithSeparators — items + separators
// ---------------------------------------------------------------------------

export const WithSeparators: Story = {
  name: 'with separators',
  render: () => (
    <DropdownMenu
      trigger={<Button variant="outline">Account</Button>}
      data={[
        { type: 'item', id: 'profile', label: 'Profile', onSelect: () => console.log('Profile') },
        { type: 'item', id: 'settings', label: 'Settings', onSelect: () => console.log('Settings') },
        { type: 'separator', id: 'sep-1' },
        { type: 'item', id: 'help', label: 'Help', onSelect: () => console.log('Help') },
        { type: 'separator', id: 'sep-2' },
        { type: 'item', id: 'logout', label: 'Logout', onSelect: () => console.log('Logout') },
      ]}
    />
  ),
};

// ---------------------------------------------------------------------------
// WithGroups — 2 groups with labels
// ---------------------------------------------------------------------------

export const WithGroups: Story = {
  name: 'with groups · labeled sections',
  render: () => (
    <DropdownMenu
      trigger={<Button variant="outline">Workspace</Button>}
      data={[
        {
          type: 'group',
          id: 'account-group',
          label: 'Account',
          items: [
            { type: 'item', id: 'profile', label: 'Profile', onSelect: () => console.log('Profile') },
            { type: 'item', id: 'billing', label: 'Billing', onSelect: () => console.log('Billing') },
          ],
        },
        { type: 'separator', id: 'sep-1' },
        {
          type: 'group',
          id: 'prefs-group',
          label: 'Preferences',
          items: [
            { type: 'item', id: 'appearance', label: 'Appearance', onSelect: () => console.log('Appearance') },
            { type: 'item', id: 'notifications', label: 'Notifications', onSelect: () => console.log('Notifications') },
          ],
        },
      ]}
    />
  ),
};

// ---------------------------------------------------------------------------
// WithSubmenu — nested submenu (theme picker)
// ---------------------------------------------------------------------------

export const WithSubmenu: Story = {
  name: 'with submenu · theme picker',
  render: () => (
    <DropdownMenu
      trigger={<Button variant="outline">User menu</Button>}
      data={[
        { type: 'item', id: 'profile', label: 'Profile', onSelect: () => console.log('Profile') },
        { type: 'item', id: 'logout', label: 'Logout', onSelect: () => console.log('Logout') },
        { type: 'separator', id: 'sep-1' },
        {
          type: 'sub',
          id: 'theme-sub',
          label: 'Color scheme',
          items: [
            { type: 'item', id: 'theme-black', label: 'Black', onSelect: () => console.log('theme: black') },
            { type: 'item', id: 'theme-ocean', label: 'Ocean', onSelect: () => console.log('theme: ocean') },
            { type: 'item', id: 'theme-forest', label: 'Forest', onSelect: () => console.log('theme: forest') },
            { type: 'item', id: 'theme-rose', label: 'Rose', onSelect: () => console.log('theme: rose') },
          ],
        },
      ]}
    />
  ),
};

// ---------------------------------------------------------------------------
// WithIcons — items with lucide-solid icons
// ---------------------------------------------------------------------------

const ITEMS_WITH_ICONS: IDropdownMenuItem[] = [
  {
    type: 'item',
    id: 'profile',
    label: 'Profile',
    icon: <User class="size-4" />,
    onSelect: () => console.log('Profile'),
  },
  {
    type: 'item',
    id: 'messages',
    label: 'Messages',
    icon: <Mail class="size-4" />,
    onSelect: () => console.log('Messages'),
  },
  {
    type: 'item',
    id: 'settings',
    label: 'Settings',
    icon: <Settings class="size-4" />,
    onSelect: () => console.log('Settings'),
  },
  { type: 'separator', id: 'sep-1' },
  {
    type: 'item',
    id: 'delete',
    label: 'Delete account',
    icon: <Trash2 class="size-4" />,
    onSelect: () => console.log('Delete'),
  },
];

export const WithIcons: Story = {
  name: 'with icons · lucide-solid',
  render: () => (
    <DropdownMenu
      trigger={<Button variant="outline">Options</Button>}
      data={ITEMS_WITH_ICONS}
    />
  ),
};

// ---------------------------------------------------------------------------
// Mixed — all 4 types in one menu (account group + separator + theme submenu)
// ---------------------------------------------------------------------------

export const Mixed: Story = {
  name: 'mixed · all node types',
  render: () => (
    <DropdownMenu
      trigger={<Button variant="outline">Full menu</Button>}
      data={[
        {
          type: 'group',
          id: 'account-group',
          label: 'Account',
          items: [
            {
              type: 'item',
              id: 'profile',
              label: 'Profile',
              icon: <User class="size-4" />,
              onSelect: () => console.log('Profile'),
            },
            {
              type: 'item',
              id: 'settings',
              label: 'Settings',
              icon: <Settings class="size-4" />,
              onSelect: () => console.log('Settings'),
            },
            {
              type: 'item',
              id: 'disabled-item',
              label: 'Admin panel',
              disabled: true,
              onSelect: () => console.log('should not fire'),
            },
          ],
        },
        { type: 'separator', id: 'sep-1' },
        {
          type: 'sub',
          id: 'theme-sub',
          label: 'Color scheme',
          icon: <Palette class="size-4" />,
          items: [
            {
              type: 'item',
              id: 'theme-light',
              label: 'Light',
              icon: <Sun class="size-4" />,
              onSelect: () => console.log('theme: light'),
            },
            {
              type: 'item',
              id: 'theme-dark',
              label: 'Dark',
              icon: <Moon class="size-4" />,
              onSelect: () => console.log('theme: dark'),
            },
          ],
        },
        { type: 'separator', id: 'sep-2' },
        {
          type: 'item',
          id: 'logout',
          label: 'Logout',
          onSelect: () => console.log('Logout'),
        },
      ]}
    />
  ),
};
