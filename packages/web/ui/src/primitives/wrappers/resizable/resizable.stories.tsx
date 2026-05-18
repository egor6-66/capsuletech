import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { MockBlock, MockHeader, MockMain, MockRightBar, MockSidebar } from '../../_mocks';
import { Layout } from '../../layout';
import { Resizable } from './resizable';

/**
 * Stories построены через `render: (args) => …`, потому что Solid JSX-ноды,
 * положенные напрямую в `args.items[].children`, не переживают сериализацию
 * postMessage между Storybook manager и preview iframe — на preview-стороне
 * приходит `{}`, и Resizable рендерит пустые панели.
 */
const meta = {
  title: 'Wrappers/Resizable',
  component: Resizable,
  tags: ['autodocs'],
  argTypes: {
    orientation: { control: 'inline-radio', options: ['horizontal', 'vertical'] },
    withHandle: { control: 'boolean' },
  },
  args: {
    orientation: 'horizontal',
    withHandle: true,
  },
  decorators: [
    (Story) => (
      <div class="h-[520px] w-full border border-dashed border-white/15 overflow-hidden">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Resizable>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Horizontal: Story = {
  name: 'horizontal · sidebar + main',
  render: (args) => (
    <Resizable
      {...args}
      items={[
        { children: <MockSidebar />, resizable: true, initialSize: 0.25, minSize: 0.15 },
        { children: <MockMain />, resizable: true },
      ]}
    />
  ),
};

export const Vertical: Story = {
  name: 'vertical · header + main',
  args: { orientation: 'vertical' },
  render: (args) => (
    <Resizable
      {...args}
      items={[
        { children: <MockHeader />, resizable: true, initialSize: 0.15, minSize: 0.08 },
        { children: <MockMain />, resizable: true },
      ]}
    />
  ),
};

export const ThreePanels: Story = {
  name: 'horizontal · sidebar + main + inspector',
  render: (args) => (
    <Resizable
      {...args}
      items={[
        { children: <MockSidebar />, resizable: true, initialSize: 0.22, minSize: 0.12 },
        { children: <MockMain />, resizable: true },
        { children: <MockRightBar />, resizable: true, initialSize: 0.22, minSize: 0.15 },
      ]}
    />
  ),
};

export const FixedRightPanel: Story = {
  name: 'fixed inspector · resizable:false',
  render: (args) => (
    <Resizable
      {...args}
      items={[
        { children: <MockSidebar />, resizable: true, initialSize: 0.22 },
        { children: <MockMain />, resizable: true },
        { children: <MockRightBar />, resizable: false, initialSize: 0.22 },
      ]}
    />
  ),
};

export const WithMinMaxConstraints: Story = {
  name: 'min/max constraints',
  render: (args) => (
    <Resizable
      {...args}
      items={[
        {
          children: <MockBlock label="20–40%" tone="b" />,
          resizable: true,
          initialSize: 0.3,
          minSize: 0.2,
          maxSize: 0.4,
        },
        { children: <MockBlock label="flex" />, resizable: true },
      ]}
    />
  ),
};

export const NoGripHandle: Story = {
  name: 'no grip · withHandle:false',
  args: { withHandle: false },
  render: (args) => (
    <Resizable
      {...args}
      items={[
        { children: <MockBlock label="left" tone="a" />, resizable: true, initialSize: 0.4 },
        { children: <MockBlock label="right" tone="c" />, resizable: true },
      ]}
    />
  ),
};

/**
 * Интеграция с `<Layout variant="dashboard">`: если хоть один horizontal-слот
 * задан как объект `{children, resizable: true}` — Layout пакует sidebar/main/
 * rightBar в горизонтальный `<Resizable>`, header остаётся над группой.
 */
export const LayoutDashboardIntegration: StoryObj = {
  name: 'integrated · Layout dashboard',
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
