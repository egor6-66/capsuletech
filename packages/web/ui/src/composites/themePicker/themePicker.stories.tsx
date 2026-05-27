import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { createSignal } from 'solid-js';

import { Dropdown } from '../../primitives/dropdown';
import { ThemePicker } from './themePicker';

const meta = {
  title: 'Composites/ThemePicker',
  component: ThemePicker,
  tags: ['autodocs'],
  decorators: [
    (Story: () => import('solid-js').JSX.Element) => (
      <div class="flex flex-col gap-4 p-6">
        {Story()}
      </div>
    ),
  ],
} satisfies Meta<typeof ThemePicker>;

export default meta;
type Story = StoryObj<typeof meta>;

// ---------------------------------------------------------------------------
// Default — all discovered themes
// ---------------------------------------------------------------------------

export const Default: Story = {
  name: 'default · all discovered themes',
  render: () => <ThemePicker />,
};

// ---------------------------------------------------------------------------
// Subset — only 3 themes
// ---------------------------------------------------------------------------

export const Subset: Story = {
  name: 'subset · 3 themes',
  render: () => <ThemePicker themes={['black', 'zen', 'damon']} />,
};

// ---------------------------------------------------------------------------
// CustomTriggerLabel
// ---------------------------------------------------------------------------

export const CustomTriggerLabel: Story = {
  name: 'custom trigger label',
  render: () => <ThemePicker triggerLabel="Choose theme" />,
};

// ---------------------------------------------------------------------------
// Nested — sub mode inside a parent Dropdown
// ---------------------------------------------------------------------------

export const Nested: Story = {
  name: 'nested · sub mode inside parent Dropdown',
  render: () => (
    <Dropdown>
      <Dropdown.Trigger>Open menu</Dropdown.Trigger>
      <Dropdown.Content>
        <Dropdown.Item>Some action</Dropdown.Item>
        <Dropdown.Separator />
        <ThemePicker mode="sub" />
      </Dropdown.Content>
    </Dropdown>
  ),
};

// ---------------------------------------------------------------------------
// WithCallback — logs each selection
// ---------------------------------------------------------------------------

export const WithCallback: Story = {
  name: 'with onChange callback',
  render: () => {
    const [log, setLog] = createSignal<string[]>([]);
    return (
      <div class="flex flex-col gap-2">
        <ThemePicker
          themes={['black', 'zen', 'damon']}
          onChange={(theme) => setLog((prev) => [...prev, `selected: ${theme}`])}
        />
        <ul class="text-xs text-muted-foreground">
          {log().map((entry, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: stable static list
            <li key={i}>{entry}</li>
          ))}
        </ul>
      </div>
    );
  },
};
