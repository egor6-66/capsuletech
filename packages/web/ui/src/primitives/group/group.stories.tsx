import type { Meta, StoryObj } from 'storybook-solidjs-vite';

import { Button } from '../button';
import { Group } from '.';

// ---------------------------------------------------------------------------
// Shared items for batch stories
// ---------------------------------------------------------------------------

interface IItem {
  label: string;
  variant?: 'default' | 'outline' | 'ghost';
  tags?: string[];
}

const ALL_ITEMS: IItem[] = [
  { label: 'Edit', variant: 'outline', tags: ['main'] },
  { label: 'Copy', variant: 'outline', tags: ['main'] },
  { label: 'Delete', variant: 'outline', tags: ['danger'] },
];

const itemProps = (it: IItem) => ({ children: it.label, variant: it.variant });

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

const meta = {
  title: 'Components/Group',
  component: Group,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof Group>;

export default meta;
type Story = StoryObj<typeof meta>;

// ---------------------------------------------------------------------------
// Wrapper mode — horizontal (default)
// ---------------------------------------------------------------------------

export const WrapperHorizontal: Story = {
  render: () => (
    <Group orientation="horizontal" gap={2}>
      <Button variant="outline">First</Button>
      <Button variant="outline">Second</Button>
      <Button variant="outline">Third</Button>
    </Group>
  ),
};

// ---------------------------------------------------------------------------
// Wrapper mode — vertical
// ---------------------------------------------------------------------------

export const WrapperVertical: Story = {
  render: () => (
    <Group orientation="vertical" gap={2}>
      <Button variant="outline" class="w-32">Top</Button>
      <Button variant="outline" class="w-32">Middle</Button>
      <Button variant="outline" class="w-32">Bottom</Button>
    </Group>
  ),
};

// ---------------------------------------------------------------------------
// Attached segmented — horizontal (seamless join)
// ---------------------------------------------------------------------------

export const AttachedHorizontal: Story = {
  render: () => (
    <div class="flex flex-col gap-4 items-start">
      {/* 2 items */}
      <Group variant="attached" orientation="horizontal">
        <Button variant="outline">Left</Button>
        <Button variant="outline">Right</Button>
      </Group>
      {/* 3 items */}
      <Group variant="attached" orientation="horizontal">
        <Button variant="outline">Left</Button>
        <Button variant="outline">Center</Button>
        <Button variant="outline">Right</Button>
      </Group>
      {/* 4 items */}
      <Group variant="attached" orientation="horizontal">
        <Button variant="outline">Day</Button>
        <Button variant="outline">Week</Button>
        <Button variant="outline">Month</Button>
        <Button variant="outline">Year</Button>
      </Group>
    </div>
  ),
};

// ---------------------------------------------------------------------------
// Attached segmented — vertical (seamless join)
// ---------------------------------------------------------------------------

export const AttachedVertical: Story = {
  render: () => (
    <div class="flex flex-row gap-6 items-start">
      {/* 2 items */}
      <Group variant="attached" orientation="vertical">
        <Button variant="outline" class="w-28">Top</Button>
        <Button variant="outline" class="w-28">Bottom</Button>
      </Group>
      {/* 3 items */}
      <Group variant="attached" orientation="vertical">
        <Button variant="outline" class="w-28">Top</Button>
        <Button variant="outline" class="w-28">Middle</Button>
        <Button variant="outline" class="w-28">Bottom</Button>
      </Group>
    </div>
  ),
};

// ---------------------------------------------------------------------------
// Attached batch mode — auto-separators
// ---------------------------------------------------------------------------

export const AttachedBatch: Story = {
  render: () => (
    <div class="flex flex-col gap-4 items-start">
      <Group
        variant="attached"
        orientation="horizontal"
        data={ALL_ITEMS}
        itemAs={Button}
        itemProps={itemProps}
      />
      <Group
        variant="attached"
        orientation="vertical"
        data={ALL_ITEMS}
        itemAs={Button}
        itemProps={(it: IItem) => ({ ...itemProps(it), class: 'w-28' })}
      />
    </div>
  ),
};

// ---------------------------------------------------------------------------
// Attached batch — horizontal separators must be VISIBLE (regression guard)
// Each 1px vertical divider between buttons must be rendered as w-px h-auto self-stretch.
// Before fix: CVA orientation names were swapped → separator had w-auto h-px → invisible.
// ---------------------------------------------------------------------------

export const HorizontalAttachedWithVisibleSeparators: Story = {
  render: () => (
    <div class="flex flex-col gap-4 items-start">
      {/* Batch path: separators are auto-inserted by Group internals */}
      <Group
        variant="attached"
        orientation="horizontal"
        data={ALL_ITEMS}
        itemAs={Button}
        itemProps={itemProps}
      />
      {/* Wrapper path: explicit Group.Separator orientation="vertical" */}
      <Group variant="attached" orientation="horizontal">
        <Button variant="outline">Left</Button>
        <Group.Separator orientation="vertical" />
        <Button variant="outline">Center</Button>
        <Group.Separator orientation="vertical" />
        <Button variant="outline">Right</Button>
      </Group>
    </div>
  ),
};

// ---------------------------------------------------------------------------
// With built-in Separator
// ---------------------------------------------------------------------------

export const WithSeparator: Story = {
  render: () => (
    <Group orientation="horizontal" gap={2}>
      <Button variant="ghost">File</Button>
      <Group.Separator />
      <Button variant="ghost">Edit</Button>
      <Button variant="ghost">View</Button>
      <Group.Separator />
      <Button variant="ghost">Help</Button>
    </Group>
  ),
};

// ---------------------------------------------------------------------------
// Batch mode — all items
// ---------------------------------------------------------------------------

export const BatchMode: Story = {
  render: () => (
    <Group
      data={ALL_ITEMS}
      itemAs={Button}
      itemProps={itemProps}
      orientation="horizontal"
      gap={2}
    />
  ),
};

// ---------------------------------------------------------------------------
// Batch mode — tag filter (only 'main' items)
// ---------------------------------------------------------------------------

export const BatchWithTagFilter: Story = {
  render: () => (
    <Group
      data={ALL_ITEMS}
      itemAs={Button}
      itemProps={itemProps}
      tags={['main']}
      orientation="horizontal"
      gap={2}
    />
  ),
};

// ---------------------------------------------------------------------------
// Resizable items (batch + corvu)
// ---------------------------------------------------------------------------

export const ResizableItems: Story = {
  render: () => (
    <div class="h-40 w-[480px] rounded border border-border overflow-hidden">
      <Group
        orientation="horizontal"
        resizable
        withHandle
        data={[
          { label: 'Panel A' },
          { label: 'Panel B' },
          { label: 'Panel C' },
        ]}
        as={(p: { label: string }) => (
          <div class="flex h-full items-center justify-center bg-muted/40 text-sm font-medium">
            {p.label}
          </div>
        )}
        itemProps={(it: { label: string }) => ({ label: it.label })}
        class="h-full w-full"
      />
    </div>
  ),
};
