import type { Meta, StoryObj } from 'storybook-solidjs-vite';

import { MockBlock } from '../_mocks';
import { Flex } from './flex';

const meta = {
  title: 'Components/Flex',
  component: Flex,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
} satisfies Meta<typeof Flex>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Row: Story = {
  name: 'direction: row',
  render: () => (
    <Flex gap={2} class="h-24">
      <MockBlock label="A" />
      <MockBlock label="B" tone="b" />
      <MockBlock label="C" tone="c" />
    </Flex>
  ),
};

export const Column: Story = {
  name: 'direction: col',
  render: () => (
    <Flex direction="col" gap={2} class="h-64 w-48">
      <MockBlock label="A" />
      <MockBlock label="B" tone="b" />
      <MockBlock label="C" tone="c" />
    </Flex>
  ),
};

export const Centered: Story = {
  name: 'align/justify: center',
  render: () => (
    <Flex
      align="center"
      justify="center"
      gap={4}
      class="h-40 w-full border border-dashed border-white/15"
    >
      <MockBlock label="centered" tone="b" />
    </Flex>
  ),
};

export const Between: Story = {
  name: 'justify: between',
  render: () => (
    <Flex justify="between" align="center" class="h-16 w-full">
      <MockBlock label="left" tone="b" />
      <MockBlock label="middle" />
      <MockBlock label="right" tone="c" />
    </Flex>
  ),
};

export const Wrap: Story = {
  name: 'wrap',
  render: () => (
    <Flex wrap="wrap" gap={2} class="w-96">
      <MockBlock label="1" />
      <MockBlock label="2" tone="b" />
      <MockBlock label="3" tone="c" />
      <MockBlock label="4" />
      <MockBlock label="5" tone="b" />
      <MockBlock label="6" tone="c" />
    </Flex>
  ),
};
