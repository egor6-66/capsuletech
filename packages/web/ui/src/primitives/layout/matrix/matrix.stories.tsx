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
      <div class="h-[600px] w-full overflow-hidden border border-dashed border-white/15">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Matrix>;

export default meta;
type Story = StoryObj<typeof meta>;

// ===========================================================================
// Preset='app-shell' stories — friendly API
// ===========================================================================

/**
 * Auto-centroid: preset='app-shell' with only `main`. Single cell, no chrome.
 */
export const OnlyMain: Story = {
  name: 'preset · auto-centroid (only main)',
  render: () => <Matrix preset="app-shell" slots={{ main: <Button>Centroid content</Button> }} />,
};

/**
 * Auto-centroid with animated main.
 */
export const OnlyMainAnimated: Story = {
  name: 'preset · auto-centroid · animated',
  render: () => (
    <Matrix
      preset="app-shell"
      animated="fade"
      slots={{ main: <Button>Fade in on mount</Button> }}
    />
  ),
};

/**
 * Header + main + footer. No sidebar/rightBar.
 *
 * Preset 'app-shell' always makes the middle row resizable; here middle row has
 * a single main cell so no horizontal handle appears, but footer-row is
 * resizable vertically (footer.height defaults to 0.3).
 */
export const HeaderMainFooter: Story = {
  name: 'preset · header + main + footer',
  render: () => (
    <Matrix
      preset="app-shell"
      slots={{
        header: <MockHeader />,
        main: <MockMain />,
        footer: <MockFooter />,
      }}
    />
  ),
};

/**
 * Full app-shell: header / sidebar | main | rightBar / footer.
 * Default sizes from preset: main=0.8, sidebar=0.2, rightBar=0.2, footer-height=0.3.
 */
export const FullAppShell: Story = {
  name: 'preset · full app-shell (all 5 slots)',
  render: () => (
    <Matrix
      preset="app-shell"
      slots={{
        header: <MockHeader />,
        sidebar: <MockSidebar />,
        main: <MockMain />,
        rightBar: <MockRightBar />,
        footer: <MockFooter />,
      }}
    />
  ),
};

/**
 * App-shell with size overrides via object-form SlotValue.
 */
export const AppShellWithOverrides: Story = {
  name: 'preset · app-shell with size overrides',
  render: () => (
    <Matrix
      preset="app-shell"
      slots={{
        header: <MockHeader />,
        sidebar: { children: <MockSidebar />, initialSize: 0.15, minSize: 0.1 },
        main: { children: <MockMain />, initialSize: 0.65, minSize: 0.3 },
        rightBar: { children: <MockRightBar />, initialSize: 0.2, minSize: 0.15 },
        footer: { children: <MockFooter />, initialSize: 0.2, minSize: 0.08 },
      }}
    />
  ),
};

/**
 * Sandbox-like layout: header + main (scrollable rows) + rightBar + footer.
 * Verifies:
 *   1. Scroll inside main (50 rows × 36px > panel height)
 *   2. No overlap on resize (drag handles work, footer/main don't overlap)
 *   3. Panel content clipped at panel boundary (overflow-hidden)
 */
export const InteractiveResize: Story = {
  name: 'preset · interactive (scroll + resize)',
  render: () => (
    <Matrix
      preset="app-shell"
      slots={{
        header: <MockHeader />,
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
          initialSize: 0.8,
          minSize: 0.3,
        },
        rightBar: { children: <MockRightBar />, initialSize: 0.2, minSize: 0.12 },
        footer: { children: <MockFooter />, initialSize: 0.3, minSize: 0.06 },
      }}
    />
  ),
};

// ===========================================================================
// Raw rows stories — escape-hatch API
// ===========================================================================

/**
 * Raw rows: two rows, no preset. First row has a single header cell, second
 * row has two resizable cells (left/right). Shows the generic engine without
 * preset semantics.
 */
export const RawRowsTwoColumns: Story = {
  name: 'rows · two columns + header',
  render: () => (
    <Matrix
      rows={[
        {
          id: 'top',
          height: 'auto',
          resizable: false,
          cells: [{ id: 'header', tag: 'header', children: <MockHeader /> }],
        },
        {
          id: 'middle',
          resizable: true,
          cells: [
            {
              id: 'left',
              tag: 'aside',
              children: <MockSidebar />,
              width: 0.3,
              resizable: true,
            },
            {
              id: 'right',
              tag: 'main',
              children: <MockMain />,
              width: 0.7,
              resizable: true,
            },
          ],
        },
      ]}
    />
  ),
};

/**
 * Raw rows: dashboard-grid pattern (3 rows × N cells of equal width).
 * Demonstrates use case "N widgets in arbitrary arrangement" — closes the gap
 * where 5-slot app-shell could not express grid-of-widgets layout.
 */
export const RawRowsDashboard: Story = {
  name: 'rows · dashboard-grid (2-1-3)',
  render: () => {
    const tile = (label: string) => (
      <div class="flex h-full w-full items-center justify-center border bg-card text-sm">
        {label}
      </div>
    );
    return (
      <Matrix
        rows={[
          {
            id: 'row-1',
            resizable: true,
            cells: [
              { id: 'a', children: tile('A'), width: 0.5, resizable: true },
              { id: 'b', children: tile('B'), width: 0.5, resizable: true },
            ],
          },
          {
            id: 'row-2',
            resizable: true,
            cells: [{ id: 'c', children: tile('C (full)') }],
          },
          {
            id: 'row-3',
            resizable: true,
            cells: [
              { id: 'd', children: tile('D'), width: 0.33, resizable: true },
              { id: 'e', children: tile('E'), width: 0.33, resizable: true },
              { id: 'f', children: tile('F'), width: 0.34, resizable: true },
            ],
          },
        ]}
      />
    );
  },
};

// ===========================================================================
// Swap-mode DnD stories (Phase 1.2)
// ===========================================================================

/**
 * Swap mode controlled: layoutMode='edit' forced from outside, sidebar and
 * rightBar are in the same swapGroup ('aside') — drag one onto the other to
 * swap their contents. main is NOT draggable so it cannot be moved.
 *
 * Open the actions panel to watch onLayoutChange events fire.
 */
export const SwapModeControlled: Story = {
  name: 'preset · swap mode (controlled, layoutMode=edit)',
  argTypes: {
    onLayoutChange: { action: 'layoutChange' },
  },
  render: (args) => (
    <Matrix
      layoutMode="edit"
      dndMode="swap"
      onLayoutChange={(e) => args.onLayoutChange?.(e)}
      preset="app-shell"
      slots={{
        header: <MockHeader />,
        sidebar: { children: <MockSidebar />, draggable: true, initialSize: 0.2 },
        main: <MockMain />,
        rightBar: { children: <MockRightBar />, draggable: true, initialSize: 0.2 },
        footer: { children: <MockFooter />, initialSize: 0.3 },
      }}
    />
  ),
};

/**
 * Swap mode uncontrolled: no layoutMode prop. An EditBadge appears in the
 * top-right corner — click it to enter edit mode, then drag sidebar↔rightBar.
 * Click "✓ Done" to exit edit mode.
 */
export const SwapModeUncontrolled: Story = {
  name: 'preset · swap mode (uncontrolled, badge toggle)',
  argTypes: {
    onLayoutChange: { action: 'layoutChange' },
  },
  render: (args) => (
    <Matrix
      onLayoutChange={(e) => args.onLayoutChange?.(e)}
      preset="app-shell"
      slots={{
        header: <MockHeader />,
        sidebar: { children: <MockSidebar />, draggable: true, initialSize: 0.2 },
        main: <MockMain />,
        rightBar: { children: <MockRightBar />, draggable: true, initialSize: 0.2 },
        footer: { children: <MockFooter />, draggable: true, initialSize: 0.3 },
      }}
    />
  ),
};

/**
 * Swap mode raw rows: 4 tiles in two rows, all in the same swapGroup so any
 * tile can be swapped with any other. Demonstrates rows-of-cells swap UX
 * without preset semantics.
 */
export const SwapModeRawRows: Story = {
  name: 'rows · swap mode (4 tiles, single swapGroup)',
  argTypes: {
    onLayoutChange: { action: 'layoutChange' },
  },
  render: (args) => {
    const tile = (label: string, bg: string) => (
      <div
        class="flex h-full w-full items-center justify-center text-lg font-bold text-foreground"
        style={{ background: bg }}
      >
        {label}
      </div>
    );
    return (
      <Matrix
        layoutMode="edit"
        dndMode="swap"
        onLayoutChange={(e) => args.onLayoutChange?.(e)}
        rows={[
          {
            id: 'row-1',
            resizable: true,
            cells: [
              {
                id: 'a',
                children: tile('A', 'rgba(99, 102, 241, 0.18)'),
                width: 0.5,
                resizable: true,
                draggable: true,
                swapGroup: 'tiles',
              },
              {
                id: 'b',
                children: tile('B', 'rgba(34, 197, 94, 0.18)'),
                width: 0.5,
                resizable: true,
                draggable: true,
                swapGroup: 'tiles',
              },
            ],
          },
          {
            id: 'row-2',
            resizable: true,
            cells: [
              {
                id: 'c',
                children: tile('C', 'rgba(244, 114, 182, 0.18)'),
                width: 0.5,
                resizable: true,
                draggable: true,
                swapGroup: 'tiles',
              },
              {
                id: 'd',
                children: tile('D', 'rgba(251, 146, 60, 0.18)'),
                width: 0.5,
                resizable: true,
                draggable: true,
                swapGroup: 'tiles',
              },
            ],
          },
        ]}
      />
    );
  },
};
