import type { Meta, StoryObj } from 'storybook-solidjs-vite';

import { MockFooter, MockHeader, MockMain, MockRightBar, MockSidebar } from '../_mocks';
import { Button } from '../button';
import { Layout } from './layout';

// holy-grail слева использует те же sidebar-стили, что dashboard — алиас для ясности.
const MockLeftBar = MockSidebar;

/**
 * # Layout stories
 *
 * **ВАЖНО** про `render`-форму. Storybook отправляет `args` между manager- и
 * preview-фреймами через `postMessage` (structured clone). Solid JSX-ноды
 * (HTMLElement / реактивные функции) этой сериализации не переживают — на
 * preview-стороне `args.slots.sidebar` превратится в `{}`. Поэтому **нельзя**
 * писать `args: { slots: { sidebar: <X/> } }` — слот придёт пустым.
 *
 * Решение: строим JSX внутри `render: (args) => <Layout {...args} slots={...} />`
 * — там JSX-ноды конструируются непосредственно в preview iframe и до
 * сериализации не доходят.
 */
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
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Layout>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Centroid: Story = {
  name: 'centroid',
  render: () => (
    <Layout
      variant="centroid"
      slots={{
        main: <Button>Centroid content</Button>,
      }}
    />
  ),
};

export const CentroidAnimated: Story = {
  name: 'centroid · animated',
  render: () => (
    <Layout
      variant="centroid"
      animated="fade"
      slots={{
        main: <Button>Fade in on mount</Button>,
      }}
    />
  ),
};

export const Standard: Story = {
  name: 'standard',
  render: () => (
    <Layout
      variant="standard"
      slots={{
        header: <MockHeader />,
        main: <MockMain />,
        footer: <MockFooter />,
      }}
    />
  ),
};

/**
 * Standard в режиме resize: header/main/footer заданы объектами
 * `{children, resizable: true}` — все три становятся corvu Panel'ями
 * в одном вертикальном Resizable, между ними появляются drag-handles.
 */
export const StandardResizable: Story = {
  name: 'standard · resizable',
  render: () => (
    <Layout
      variant="standard"
      slots={{
        header: { children: <MockHeader />, resizable: true, initialSize: 0.15, minSize: 0.08 },
        main: { children: <MockMain />, resizable: true },
        footer: { children: <MockFooter />, resizable: true, initialSize: 0.12, minSize: 0.06 },
      }}
    />
  ),
};

export const Dashboard: Story = {
  name: 'dashboard',
  render: () => (
    <Layout
      variant="dashboard"
      slots={{
        sidebar: <MockSidebar />,
        main: <MockMain />,
      }}
    />
  ),
};

export const DashboardFull: Story = {
  name: 'dashboard · header + rightBar',
  render: () => (
    <Layout
      variant="dashboard"
      slots={{
        sidebar: <MockSidebar />,
        header: <MockHeader />,
        main: <MockMain />,
        rightBar: <MockRightBar />,
      }}
    />
  ),
};

/**
 * Dashboard в режиме resize: слоты заданы объектами `{children, resizable, ...}`.
 * Header остаётся над горизонтальной Resizable-группой sidebar/main/rightBar.
 */
export const DashboardResizable: Story = {
  name: 'dashboard · resizable',
  render: () => (
    <Layout
      variant="dashboard"
      slots={{
        header: <MockHeader />,
        sidebar: { children: <MockSidebar />, resizable: true, initialSize: 0.2, minSize: 0.12 },
        main: { children: <MockMain />, resizable: true },
        rightBar: { children: <MockRightBar />, resizable: true, initialSize: 0.22, minSize: 0.15 },
      }}
    />
  ),
};

/**
 * Dashboard с фиксированной правой панелью (`resizable: false`). Handle между
 * `main` и `rightBar` исчезает.
 */
export const DashboardFixedRight: Story = {
  name: 'dashboard · fixed rightBar',
  render: () => (
    <Layout
      variant="dashboard"
      slots={{
        header: <MockHeader />,
        sidebar: { children: <MockSidebar />, resizable: true, initialSize: 0.22 },
        main: { children: <MockMain />, resizable: true },
        rightBar: { children: <MockRightBar />, resizable: false, initialSize: 0.22 },
      }}
    />
  ),
};

/**
 * Holy-grail на CSS Grid: header / left | main | right / footer через
 * `grid-template-areas`. Tracks: `auto 1fr auto` по обеим осям.
 */
export const HolyGrail: Story = {
  name: 'holy-grail',
  render: () => (
    <Layout
      variant="holy-grail"
      slots={{
        header: <MockHeader />,
        left: <MockLeftBar />,
        main: <MockMain />,
        right: <MockRightBar />,
        footer: <MockFooter />,
      }}
    />
  ),
};

/**
 * Holy-grail с горизонтальным resize: только средняя строка (left/main/right)
 * становится `<Resizable orientation="horizontal">`. Header и footer остаются
 * фиксированными — они задаются JSX-формой без `resizable`.
 */
export const HolyGrailHorizontal: Story = {
  name: 'holy-grail · horizontal resize',
  render: () => (
    <Layout
      variant="holy-grail"
      slots={{
        header: <MockHeader />,
        left: { children: <MockLeftBar />, resizable: true, initialSize: 0.2, minSize: 0.12 },
        main: { children: <MockMain />, resizable: true },
        right: { children: <MockRightBar />, resizable: true, initialSize: 0.22, minSize: 0.15 },
        footer: <MockFooter />,
      }}
    />
  ),
};

/**
 * Holy-grail с вертикальным resize: header и footer заданы объектной формой
 * с `resizable: true`, средняя строка остаётся flex-разметкой с фиксированными
 * боковинами.
 */
export const HolyGrailVertical: Story = {
  name: 'holy-grail · vertical resize',
  render: () => (
    <Layout
      variant="holy-grail"
      slots={{
        header: { children: <MockHeader />, resizable: true, initialSize: 0.15, minSize: 0.08 },
        left: <MockLeftBar />,
        main: <MockMain />,
        right: <MockRightBar />,
        footer: { children: <MockFooter />, resizable: true, initialSize: 0.1, minSize: 0.06 },
      }}
    />
  ),
};

/**
 * Holy-grail с resize на обеих осях: nested Resizable — внешний vertical,
 * внутренний horizontal (для middle-row). Drag handles появляются и между
 * header/middle/footer, и между left/main/right.
 */
export const HolyGrailBothAxes: Story = {
  name: 'holy-grail · both axes',
  render: () => (
    <Layout
      variant="holy-grail"
      slots={{
        header: { children: <MockHeader />, resizable: true, initialSize: 0.12, minSize: 0.08 },
        left: { children: <MockLeftBar />, resizable: true, initialSize: 0.2, minSize: 0.12 },
        main: { children: <MockMain />, resizable: true },
        right: { children: <MockRightBar />, resizable: true, initialSize: 0.22, minSize: 0.15 },
        footer: { children: <MockFooter />, resizable: true, initialSize: 0.08, minSize: 0.05 },
      }}
    />
  ),
};
