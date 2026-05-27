import type { Meta, StoryObj } from 'storybook-solidjs-vite';

import { Button } from '../button';
import { Dropdown } from '.';

const meta = {
  title: 'Components/Dropdown',
  component: Dropdown,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div class="flex min-h-48 items-start justify-center p-8">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Dropdown>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Basic dropdown with 3 items. */
export const Basic: Story = {
  render: () => (
    <Dropdown>
      <Dropdown.Trigger as={Button} variant="outline">
        Open menu
      </Dropdown.Trigger>
      <Dropdown.Content>
        <Dropdown.Item onSelect={() => console.log('Profile')}>Profile</Dropdown.Item>
        <Dropdown.Item onSelect={() => console.log('Settings')}>Settings</Dropdown.Item>
        <Dropdown.Item onSelect={() => console.log('Logout')}>Logout</Dropdown.Item>
      </Dropdown.Content>
    </Dropdown>
  ),
};

/** Items divided into sections by a separator. */
export const WithSeparator: Story = {
  render: () => (
    <Dropdown>
      <Dropdown.Trigger as={Button} variant="outline">
        Account
      </Dropdown.Trigger>
      <Dropdown.Content>
        <Dropdown.Item onSelect={() => console.log('Profile')}>Profile</Dropdown.Item>
        <Dropdown.Item onSelect={() => console.log('Settings')}>Settings</Dropdown.Item>
        <Dropdown.Separator />
        <Dropdown.Item onSelect={() => console.log('Help')}>Help</Dropdown.Item>
        <Dropdown.Separator />
        <Dropdown.Item onSelect={() => console.log('Logout')}>Logout</Dropdown.Item>
      </Dropdown.Content>
    </Dropdown>
  ),
};

/** Nested submenu — e.g. a color scheme picker inside a user menu. */
export const WithSubmenu: Story = {
  render: () => (
    <Dropdown>
      <Dropdown.Trigger as={Button} variant="outline">
        User menu
      </Dropdown.Trigger>
      <Dropdown.Content>
        <Dropdown.Item onSelect={() => console.log('Logout')}>Logout</Dropdown.Item>
        <Dropdown.Separator />
        <Dropdown.Sub>
          <Dropdown.SubTrigger>Color scheme</Dropdown.SubTrigger>
          <Dropdown.SubContent>
            <Dropdown.Item onSelect={() => console.log('black')}>Black</Dropdown.Item>
            <Dropdown.Item onSelect={() => console.log('ocean')}>Ocean</Dropdown.Item>
            <Dropdown.Item onSelect={() => console.log('forest')}>Forest</Dropdown.Item>
            <Dropdown.Item onSelect={() => console.log('rose')}>Rose</Dropdown.Item>
          </Dropdown.SubContent>
        </Dropdown.Sub>
      </Dropdown.Content>
    </Dropdown>
  ),
};

/** Items grouped under non-interactive labels. Labels must be inside Group. */
export const WithLabels: Story = {
  render: () => (
    <Dropdown>
      <Dropdown.Trigger as={Button} variant="outline">
        Workspace
      </Dropdown.Trigger>
      <Dropdown.Content>
        <Dropdown.Group>
          <Dropdown.Label>Account</Dropdown.Label>
          <Dropdown.Item onSelect={() => console.log('Profile')}>Profile</Dropdown.Item>
          <Dropdown.Item onSelect={() => console.log('Settings')}>Settings</Dropdown.Item>
        </Dropdown.Group>
        <Dropdown.Separator />
        <Dropdown.Group>
          <Dropdown.Label>Preferences</Dropdown.Label>
          <Dropdown.Item onSelect={() => console.log('Appearance')}>Appearance</Dropdown.Item>
          <Dropdown.Item onSelect={() => console.log('Notifications')}>Notifications</Dropdown.Item>
        </Dropdown.Group>
      </Dropdown.Content>
    </Dropdown>
  ),
};

/** Disabled item does not fire onSelect and is visually dimmed. */
export const Disabled: Story = {
  render: () => (
    <Dropdown>
      <Dropdown.Trigger as={Button} variant="outline">
        Options
      </Dropdown.Trigger>
      <Dropdown.Content>
        <Dropdown.Item onSelect={() => console.log('Edit')}>Edit</Dropdown.Item>
        <Dropdown.Item disabled onSelect={() => console.log('this should not fire')}>
          Delete (disabled)
        </Dropdown.Item>
        <Dropdown.Item onSelect={() => console.log('Duplicate')}>Duplicate</Dropdown.Item>
      </Dropdown.Content>
    </Dropdown>
  ),
};
