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

/**
 * InteractiveResize — воспроизводит сценарий из sandbox `/workspace`:
 * фиксированный header + resizable main (длинный список) + resizable rightBar
 * + resizable footer. Проверяемые паттерны вручную:
 *
 *  1. **Scroll в main**: контент (30 строк × 36px ≈ 1080px) выходит за высоту
 *     Panel → должна появиться вертикальная полоса прокрутки внутри main.
 *
 *  2. **No overlap при resize**: тяни vertical handle (footer ↑) — footer
 *     должен расти, middle-row — уменьшаться, без наложения блоков.
 *
 *  3. **Horizontal resize**: тяни handle между main и rightBar — пропорции
 *     меняются, содержимое clip'ится без «вытекания».
 *
 * После фикса (overflow-hidden на ResizablePanel) оба паттерна работают корректно.
 */
export const InteractiveResize: Story = {
  name: 'resizable · interactive (scroll + no overlap)',
  render: () => (
    <Matrix
      slots={{
        header: { children: <MockHeader /> },
        main: {
          children: (
            <div class="h-full w-full overflow-auto">
              <div class="sticky top-0 border-b bg-card px-4 py-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Users — 30 rows · scroll me · drag handles
              </div>
              {Array.from({ length: 30 }, (_, i) => (
                <div class="flex items-center border-b px-4 py-2 text-sm hover:bg-muted/40">
                  <span class="w-12 font-mono text-muted-foreground">{i + 1}</span>
                  <span class="flex-1">User {i + 1}</span>
                  <span class="text-muted-foreground">user{i + 1}@example.com</span>
                </div>
              ))}
            </div>
          ),
          resizable: true,
          initialSize: 0.8,
          minSize: 0.3,
        },
        rightBar: {
          children: <MockRightBar />,
          resizable: true,
          initialSize: 0.2,
          minSize: 0.12,
        },
        footer: {
          children: <MockFooter />,
          resizable: true,
          initialSize: 0.3,
          minSize: 0.06,
        },
      }}
    />
  ),
};

/**
 * Regression: overflowing main content must NOT expand the corvu Panel past its
 * initialSize ratio. main.overflow-auto should scroll inside the panel; footer
 * should remain at ~30% height regardless of how many rows are in main.
 *
 * Before the fix (no `min-h-0` on ResizablePanel) the middle-row Panel grew to
 * content height and the footer Panel collapsed to min-content (~21 px).
 */
export const WithOverflowingMain: Story = {
  name: 'resizable · overflowing main (regression)',
  render: () => (
    <Matrix
      slots={{
        header: { children: <MockHeader /> },
        main: {
          children: (
            <div class="h-full w-full overflow-auto">
              {Array.from({ length: 50 }, (_, i) => (
                <div class="border-b px-4 py-2 text-sm">Row {i + 1} — placeholder content</div>
              ))}
            </div>
          ),
          resizable: true,
          initialSize: 0.7,
          minSize: 0.2,
        },
        rightBar: {
          children: <MockRightBar />,
          resizable: true,
          initialSize: 0.3,
          minSize: 0.15,
        },
        footer: {
          children: <MockFooter />,
          resizable: true,
          initialSize: 0.3,
          minSize: 0.08,
        },
      }}
    />
  ),
};
