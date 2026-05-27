import type { Meta, StoryObj } from 'storybook-solidjs-vite';

import { Typography } from './typography';

const meta = {
  title: 'Components/Typography',
  component: Typography,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['h1', 'h2', 'p', 'blockquote', 'code', 'lead', 'muted'],
    },
    color: {
      control: 'inline-radio',
      options: ['default', 'muted', 'primary', 'destructive'],
    },
  },
  args: { variant: 'p', color: 'default' },
  decorators: [
    (Story) => (
      <div class="max-w-xl p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Typography>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => <Typography {...args}>The quick brown fox jumps over the lazy dog.</Typography>,
};

export const H1: Story = {
  args: { variant: 'h1' },
  render: (args) => <Typography {...args}>Capsule Framework</Typography>,
};

export const H2: Story = {
  args: { variant: 'h2' },
  render: (args) => <Typography {...args}>Hyper-Controlled Architecture</Typography>,
};

export const Lead: Story = {
  args: { variant: 'lead' },
  render: (args) => (
    <Typography {...args}>
      UI is a Shadow — interface is a typed projection of logic. All power lives in the Controller.
    </Typography>
  ),
};

export const Blockquote: Story = {
  args: { variant: 'blockquote' },
  render: (args) => (
    <Typography {...args}>
      "No upward imports, no horizontal imports, stateless Entities."
    </Typography>
  ),
};

export const Code: Story = {
  args: { variant: 'code' },
  render: (args) => <Typography {...args}>npm install @capsuletech/web-ui</Typography>,
};

export const Muted: Story = {
  args: { variant: 'muted' },
  render: (args) => <Typography {...args}>Hint text — use for helper messages and secondary annotations.</Typography>,
};

export const Showcase: Story = {
  name: 'showcase · all variants',
  render: () => (
    <div class="flex flex-col gap-3">
      <Typography variant="h1">H1 — page title</Typography>
      <Typography variant="h2">H2 — section heading</Typography>
      <Typography variant="lead">
        Lead paragraph — usually muted, larger size, intro to the section.
      </Typography>
      <Typography variant="p">
        Regular body text. Set <Typography variant="code">color="muted"</Typography> for secondary
        copy.
      </Typography>
      <Typography variant="p" color="muted">
        Muted body — for hints and metadata.
      </Typography>
      <Typography variant="p" color="primary">
        Primary-coloured callout.
      </Typography>
      <Typography variant="p" color="destructive">
        Destructive-coloured warning.
      </Typography>
      <Typography variant="blockquote">A wise quote in italic with a left border.</Typography>
      <Typography variant="muted">Muted hint — helper text, secondary annotations, timestamps.</Typography>
    </div>
  ),
};
