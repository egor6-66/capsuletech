import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { createSignal } from 'solid-js';

import { DarkModeToggle } from './darkModeToggle';

const meta = {
  title: 'Composites/DarkModeToggle',
  component: DarkModeToggle,
  tags: ['autodocs'],
  decorators: [
    (Story: () => import('solid-js').JSX.Element) => (
      <div class="flex flex-col gap-4 p-6">
        {Story()}
      </div>
    ),
  ],
} satisfies Meta<typeof DarkModeToggle>;

export default meta;
type Story = StoryObj<typeof meta>;

// ---------------------------------------------------------------------------
// Default
// ---------------------------------------------------------------------------

export const Default: Story = {
  name: 'default',
  render: () => <DarkModeToggle />,
};

// ---------------------------------------------------------------------------
// WithCallback — shows the toggled value in a log
// ---------------------------------------------------------------------------

export const WithCallback: Story = {
  name: 'with onChange callback',
  render: () => {
    const [log, setLog] = createSignal<string[]>([]);
    return (
      <div class="flex flex-col gap-2">
        <DarkModeToggle onChange={(dark) => setLog((prev) => [...prev, `isDark: ${dark}`])} />
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
// WithExtraClass — forward a class to size the button differently
// ---------------------------------------------------------------------------

export const WithExtraClass: Story = {
  name: 'with extra class (larger)',
  render: () => <DarkModeToggle class="text-lg px-5 py-2.5" />,
};
