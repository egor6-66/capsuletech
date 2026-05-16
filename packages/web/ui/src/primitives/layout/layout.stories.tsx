import type { Meta, StoryObj } from 'storybook-solidjs-vite';

import {
  MockFooter,
  MockHeader,
  MockMain,
  MockRightBar,
  MockSidebar,
} from '../_mocks';
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
      <div class="h-[600px] w-full border border-dashed border-white/15 overflow-hidden">
        {Story()}
      </div>
    ),
  ],
} satisfies Meta<typeof Layout>;

export default meta;
type Story = StoryObj<typeof meta>;

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
      header: <MockHeader />,
      main: <MockMain />,
      footer: <MockFooter />,
    },
  },
};

export const Dashboard: Story = {
  name: 'dashboard',
  args: {
    variant: 'dashboard',
    slots: {
      sidebar: <MockSidebar />,
      main: <MockMain />,
    },
  },
};

export const DashboardFull: Story = {
  name: 'dashboard · header + rightBar',
  args: {
    variant: 'dashboard',
    slots: {
      sidebar: <MockSidebar />,
      header: <MockHeader />,
      main: <MockMain />,
      rightBar: <MockRightBar />,
    },
  },
};

/**
 * Dashboard в режиме resize: слоты заданы объектами `{children, resizable, ...}`.
 * Header остаётся над горизонтальной Resizable-группой sidebar/main/rightBar.
 */
export const DashboardResizable: Story = {
  name: 'dashboard · resizable',
  args: {
    variant: 'dashboard',
    slots: {
      header: <MockHeader />,
      sidebar: { children: <MockSidebar />, resizable: true, initialSize: 0.2, minSize: 0.12 },
      main: { children: <MockMain />, resizable: true },
      rightBar: { children: <MockRightBar />, resizable: true, initialSize: 0.22, minSize: 0.15 },
    },
  },
};

/**
 * Dashboard с фиксированной правой панелью (`resizable: false`). Handle между
 * `main` и `rightBar` исчезает.
 */
export const DashboardFixedRight: Story = {
  name: 'dashboard · fixed rightBar',
  args: {
    variant: 'dashboard',
    slots: {
      header: <MockHeader />,
      sidebar: { children: <MockSidebar />, resizable: true, initialSize: 0.22 },
      main: { children: <MockMain />, resizable: true },
      rightBar: { children: <MockRightBar />, resizable: false, initialSize: 0.22 },
    },
  },
};
