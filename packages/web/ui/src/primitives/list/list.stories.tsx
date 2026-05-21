import type { Meta, StoryObj } from 'storybook-solidjs-vite';

import { List } from './list';

const NAV = [
  { id: 1, label: 'Home', active: true },
  { id: 2, label: 'Inbox' },
  { id: 3, label: 'Files' },
  { id: 4, label: 'Settings' },
];

// Batch mode: template component
function NavItem(props: { label: string; active?: boolean }) {
  return (
    <li
      class={`rounded-md px-3 py-2 text-sm ${
        props.active
          ? 'bg-primary text-primary-foreground'
          : 'hover:bg-accent hover:text-accent-foreground'
      }`}
    >
      {props.label}
    </li>
  );
}

const BIG = Array.from({ length: 1000 }, (_, i) => ({
  id: i,
  label: `Row #${i + 1}`,
}));

const meta = {
  title: 'Components/List',
  component: List,
  tags: ['autodocs'],
  argTypes: {
    orientation: { control: 'inline-radio', options: ['vertical', 'horizontal'] },
    variant: { control: 'inline-radio', options: ['default', 'flush'] },
  },
  args: { orientation: 'vertical', variant: 'default' },
  decorators: [
    (Story) => (
      <div class="max-w-sm p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof List>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <List
      {...args}
      items={NAV}
      children={(item) => (
        <div
          class={`rounded-md px-3 py-2 text-sm ${
            item.active
              ? 'bg-primary text-primary-foreground'
              : 'hover:bg-accent hover:text-accent-foreground'
          }`}
        >
          {item.label}
        </div>
      )}
    />
  ),
};

export const Horizontal: Story = {
  args: { orientation: 'horizontal' },
  render: (args) => (
    <List
      {...args}
      items={NAV}
      children={(item) => (
        <div class="rounded-md border border-border px-3 py-1.5 text-sm">{item.label}</div>
      )}
    />
  ),
};

export const Flush: Story = {
  args: { variant: 'flush' },
  render: (args) => (
    <List
      {...args}
      items={NAV}
      children={(item) => (
        <div class="border-b border-border px-3 py-2 text-sm last:border-0">{item.label}</div>
      )}
    />
  ),
};

export const Virtual: Story = {
  name: 'virtual · 1000 rows',
  decorators: [
    (Story) => (
      <div class="h-72 max-w-sm p-4">
        <Story />
      </div>
    ),
  ],
  render: () => (
    <List.Virtual
      items={BIG}
      estimateSize={36}
      children={(item) => (
        <div class="border-b border-border px-3 py-2 text-sm font-mono">{item.label}</div>
      )}
    />
  ),
};

export const BatchMode: Story = {
  name: 'batch mode · data + as template',
  render: (args) => (
    <List
      {...args}
      data={NAV}
      as={NavItem}
      itemProps={(item) => ({ label: item.label, active: item.active })}
    />
  ),
};

export const Semantic: Story = {
  name: 'semantic · plain children',
  render: (args) => (
    <List {...args}>
      <li class="rounded-md px-3 py-2 text-sm hover:bg-accent">Home</li>
      <li class="rounded-md px-3 py-2 text-sm hover:bg-accent">Inbox</li>
      <li class="rounded-md px-3 py-2 text-sm hover:bg-accent">Settings</li>
    </List>
  ),
};
