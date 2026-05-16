import type { Meta, StoryObj } from 'storybook-solidjs-vite';

import { Button } from '../button';
import { Layout } from './layout';

const meta = {
  title: 'Components/Layout',
  component: Layout,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (Story) => (
      <div class="h-[600px] w-full border border-dashed border-white/20 overflow-hidden">
        {Story()}
      </div>
    ),
  ],
} satisfies Meta<typeof Layout>;

export default meta;
type Story = StoryObj<typeof meta>;

const SlotBox = (props: { label: string; class?: string }) => (
  <div
    class={`flex items-center justify-center text-xs uppercase tracking-wide opacity-60 ${
      props.class ?? ''
    }`}
  >
    {props.label}
  </div>
);

export const Centroid: Story = {
  name: 'centroid',
  args: {
    variant: 'centroid',
    slots: {
      main: <Button>Centroid content</Button>,
    },
  },
};

export const CentroidAnimated: Story = {
  name: 'centroid · animated',
  args: {
    variant: 'centroid',
    animated: 'fade',
    slots: {
      main: <Button>Fade in on mount</Button>,
    },
  },
};

export const Standard: Story = {
  name: 'standard',
  args: {
    variant: 'standard',
    slots: {
      header: <SlotBox label="header" class="h-12 bg-white/5 border-b border-white/10" />,
      main: <SlotBox label="main" class="h-full" />,
      footer: <SlotBox label="footer" class="h-12 bg-white/5 border-t border-white/10" />,
    },
  },
};

export const Dashboard: Story = {
  name: 'dashboard',
  args: {
    variant: 'dashboard',
    slots: {
      sidebar: <SlotBox label="sidebar" class="h-full" />,
      main: <SlotBox label="main" class="h-full" />,
    },
  },
};

export const DashboardFull: Story = {
  name: 'dashboard · header + rightBar',
  args: {
    variant: 'dashboard',
    slots: {
      sidebar: <SlotBox label="sidebar" class="h-full" />,
      header: <SlotBox label="header" class="h-12 bg-white/5 border-b border-white/10" />,
      main: <SlotBox label="main" class="h-full" />,
      rightBar: <SlotBox label="rightBar" class="h-full" />,
    },
  },
};
