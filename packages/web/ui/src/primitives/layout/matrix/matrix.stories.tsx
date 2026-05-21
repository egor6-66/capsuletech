import type { Meta, StoryObj } from 'storybook-solidjs-vite';

import { MockFooter, MockHeader, MockMain, MockRightBar, MockSidebar } from '../../_mocks';
import { Button } from '../../button';
import { Matrix } from './matrix';

/**
 * # Matrix stories
 *
 * **ВАЖНО** про `render`-форму. Storybook отправляет `args` между manager- и
 * preview-фреймами через `postMessage` (structured clone). Solid JSX-ноды
 * (HTMLElement / реактивные функции) этой сериализации не переживают — на
 * preview-стороне `args.slots.sidebar` превратится в `{}`. Поэтому **нельзя**
 * писать `args: { slots: { sidebar: <X/> } }` — слот придёт пустым.
 *
 * Решение: строим JSX внутри `render: (args) => <Matrix {...args} slots={...} />`
 * — там JSX-ноды конструируются непосредственно в preview iframe и до
 * сериализации не доходят.
 */
const meta = {
  title: 'Components/Matrix',
  component: Matrix,
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
} satisfies Meta<typeof Matrix>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Auto-centroid mode: only `main` is provided — no other slots.
 * Matrix renders flex items-center justify-center, no Resizable, no grid.
 */
export const OnlyMain: Story = {
  name: 'auto-centroid (only main)',
  render: () => (
    <Matrix
      slots={{
        main: { children: <Button>Centroid content</Button> },
      }}
    />
  ),
};

/**
 * Auto-centroid with animated main slot.
 */
export const OnlyMainAnimated: Story = {
  name: 'auto-centroid · animated',
  render: () => (
    <Matrix
      animated="fade"
      slots={{
        main: { children: <Button>Fade in on mount</Button> },
      }}
    />
  ),
};

/**
 * Grid mode: header + main + footer (two-row, one column).
 * No sidebar or rightBar — grid-template-areas has two columns omitted.
 */
export const HeaderMainFooter: Story = {
  name: 'header + main + footer',
  render: () => (
    <Matrix
      slots={{
        header: { children: <MockHeader /> },
        main: { children: <MockMain /> },
        footer: { children: <MockFooter /> },
      }}
    />
  ),
};

/**
 * Full grid: all 5 slots — header / sidebar | main | rightBar / footer.
 * CSS Grid with dynamic areas, no resize.
 */
export const FullGrid: Story = {
  name: 'full grid (all 5 slots)',
  render: () => (
    <Matrix
      slots={{
        header: { children: <MockHeader /> },
        sidebar: { children: <MockSidebar /> },
        main: { children: <MockMain /> },
        rightBar: { children: <MockRightBar /> },
        footer: { children: <MockFooter /> },
      }}
    />
  ),
};

/**
 * Grid: header + sidebar + main (no rightBar, no footer).
 */
export const HeaderSidebarMain: Story = {
  name: 'header + sidebar + main',
  render: () => (
    <Matrix
      slots={{
        header: { children: <MockHeader /> },
        sidebar: { children: <MockSidebar /> },
        main: { children: <MockMain /> },
      }}
    />
  ),
};

/**
 * Resizable sidebars: sidebar/main/rightBar opt-in to horizontal resize.
 * Header is fixed (non-resizable) — rendered outside Resizable group,
 * does NOT participate in fillInitialSizes (bug fix vs old variant API).
 */
export const ResizableSidebars: Story = {
  name: 'resizable · horizontal (sidebar + main + rightBar)',
  render: () => (
    <Matrix
      slots={{
        header: { children: <MockHeader /> },
        sidebar: { children: <MockSidebar />, resizable: true, initialSize: 0.2, minSize: 0.12 },
        main: { children: <MockMain />, resizable: true },
        rightBar: { children: <MockRightBar />, resizable: true, initialSize: 0.22, minSize: 0.15 },
      }}
    />
  ),
};

/**
 * Resizable vertical: header is fixed, footer opts-in to vertical resize.
 * The middle row (main only) is paired with footer in vertical Resizable.
 * Header stays fixed above the Resizable group — no fillInitialSizes allocation.
 */
export const ResizableVertical: Story = {
  name: 'resizable · vertical (fixed header + resizable footer)',
  render: () => (
    <Matrix
      slots={{
        header: { children: <MockHeader /> },
        main: { children: <MockMain /> },
        footer: { children: <MockFooter />, resizable: true, initialSize: 0.15, minSize: 0.08 },
      }}
    />
  ),
};

/**
 * Resizable everything: all 5 slots participate in resize.
 * Outer vertical Resizable (header / middle / footer), inner horizontal
 * Resizable for the middle row (sidebar / main / rightBar).
 */
export const ResizableEverything: Story = {
  name: 'resizable · all axes (full)',
  render: () => (
    <Matrix
      slots={{
        header: { children: <MockHeader />, resizable: true, initialSize: 0.12, minSize: 0.08 },
        sidebar: { children: <MockSidebar />, resizable: true, initialSize: 0.2, minSize: 0.12 },
        main: { children: <MockMain />, resizable: true },
        rightBar: { children: <MockRightBar />, resizable: true, initialSize: 0.22, minSize: 0.15 },
        footer: { children: <MockFooter />, resizable: true, initialSize: 0.1, minSize: 0.06 },
      }}
    />
  ),
};
