import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { createSignal } from 'solid-js';

import { LayoutModeToggle } from './layoutModeToggle';

const meta = {
  title: 'Composites/LayoutModeToggle',
  component: LayoutModeToggle,
  tags: ['autodocs'],
  decorators: [
    (Story: () => import('solid-js').JSX.Element) => (
      <div class="flex flex-col gap-4 p-6">
        {Story()}
      </div>
    ),
  ],
} satisfies Meta<typeof LayoutModeToggle>;

export default meta;
type Story = StoryObj<typeof meta>;

// ---------------------------------------------------------------------------
// Default
// ---------------------------------------------------------------------------

export const Default: Story = {
  name: 'default',
  render: () => <LayoutModeToggle />,
};

// ---------------------------------------------------------------------------
// WithCallback — logs each mode transition
// ---------------------------------------------------------------------------

export const WithCallback: Story = {
  name: 'with onChange callback',
  render: () => {
    const [log, setLog] = createSignal<string[]>([]);
    return (
      <div class="flex flex-col gap-2">
        <LayoutModeToggle onChange={(mode) => setLog((prev) => [...prev, `mode: ${mode}`])} />
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

// ---------------------------------------------------------------------------
// WithExtraClass — demonstrates class forwarding
// ---------------------------------------------------------------------------

export const WithExtraClass: Story = {
  name: 'with extra class (larger)',
  render: () => <LayoutModeToggle class="text-base px-5 py-2.5" />,
};
