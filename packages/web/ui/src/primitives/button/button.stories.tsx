import { ArrowRight, Loader2, Plus, Send, Trash2 } from 'lucide-solid';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';

import { Button } from './button';

const meta = {
  title: 'Components/Button',
  component: Button,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'],
    },
    size: {
      control: 'select',
      options: ['default', 'sm', 'lg', 'icon'],
    },
    disabled: { control: 'boolean' },
  },
  args: {
    variant: 'default',
    size: 'default',
    children: 'Button',
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Destructive: Story = { args: { variant: 'destructive', children: 'Delete' } };

export const Outline: Story = { args: { variant: 'outline', children: 'Outline' } };

export const Secondary: Story = { args: { variant: 'secondary', children: 'Secondary' } };

export const Ghost: Story = { args: { variant: 'ghost', children: 'Ghost' } };

export const Link: Story = { args: { variant: 'link', children: 'Link' } };

export const Disabled: Story = { args: { disabled: true, children: 'Disabled' } };

export const Small: Story = { args: { size: 'sm', children: 'Small' } };

export const Large: Story = { args: { size: 'lg', children: 'Large' } };

export const WithLeadingIcon: Story = {
  args: {
    children: (
      <>
        <Send /> Send
      </>
    ),
  },
};

export const WithTrailingIcon: Story = {
  args: {
    children: (
      <>
        Continue <ArrowRight />
      </>
    ),
  },
};

export const DestructiveWithIcon: Story = {
  args: {
    variant: 'destructive',
    children: (
      <>
        <Trash2 /> Delete
      </>
    ),
  },
};

export const Loading: Story = {
  args: {
    disabled: true,
    children: (
      <>
        <Loader2 class="animate-spin" /> Loading
      </>
    ),
  },
};

export const IconOnly: Story = {
  args: { size: 'icon', children: <Plus /> },
};

export const IconOnlyOutline: Story = {
  args: { size: 'icon', variant: 'outline', children: <Plus /> },
};

export const IconOnlyGhost: Story = {
  args: { size: 'icon', variant: 'ghost', children: <Plus /> },
};
