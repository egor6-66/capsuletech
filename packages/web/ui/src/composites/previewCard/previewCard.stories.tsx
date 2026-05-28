import type { Meta, StoryObj } from 'storybook-solidjs-vite';

import { Card } from '../../primitives/card';
import { PreviewCard } from './previewCard';
import type { IPreviewCardField } from './interfaces';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

interface IIncident {
  id: number;
  title: string;
  description: string;
  applicant: { name: string; phone: string };
  status: 'open' | 'in-progress' | 'closed';
  priority: 'low' | 'medium' | 'high';
  createdAt: string;
  resolvedAt: string | null;
}

const INCIDENT: IIncident = {
  id: 1047,
  title: 'Fire alarm triggered — floor 3',
  description:
    'Automatic smoke detector activated at 14:32. Fire brigade dispatched. No casualties reported. Building evacuated per protocol.',
  applicant: { name: 'Maria Petrova', phone: '+7 (495) 123-45-67' },
  status: 'in-progress',
  priority: 'high',
  createdAt: '2024-03-15T14:32:00Z',
  resolvedAt: null,
};

const BASE_FIELDS: IPreviewCardField<IIncident>[] = [
  { accessorKey: 'id', header: 'ID' },
  { accessorKey: 'title', header: 'Title' },
  { accessorKey: 'status', header: 'Status' },
];

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

const meta = {
  title: 'Composites/PreviewCard',
  component: PreviewCard,
  tags: ['autodocs'],
  decorators: [
    (Story: () => import('solid-js').JSX.Element) => (
      <div class="max-w-sm p-4">
        {Story()}
      </div>
    ),
  ],
} satisfies Meta<typeof PreviewCard>;

export default meta;
type Story = StoryObj<typeof meta>;

// ---------------------------------------------------------------------------
// Default — minimal: 3 fields, data present
// ---------------------------------------------------------------------------

export const Default: Story = {
  name: 'default · 3 fields',
  render: () => (
    <PreviewCard
      data={INCIDENT}
      fields={BASE_FIELDS}
    />
  ),
};

// ---------------------------------------------------------------------------
// WithFormatter — custom cell for date + applicant name via accessorFn
// ---------------------------------------------------------------------------

const FORMATTED_FIELDS: IPreviewCardField<IIncident>[] = [
  { accessorKey: 'id', header: 'ID' },
  {
    id: 'applicantName',
    accessorFn: (row) => row.applicant.name,
    header: 'Applicant',
  },
  {
    id: 'applicantPhone',
    accessorFn: (row) => row.applicant.phone,
    header: 'Phone',
  },
  { accessorKey: 'priority', header: 'Priority' },
  {
    accessorKey: 'createdAt',
    header: 'Created',
    cell: ({ getValue }) =>
      new Date(String(getValue())).toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
  },
  {
    accessorKey: 'resolvedAt',
    header: 'Resolved',
    cell: ({ getValue }) => {
      const val = getValue();
      return val == null ? '—' : new Date(String(val)).toLocaleString('ru-RU');
    },
  },
];

export const WithFormatter: Story = {
  name: 'with formatter · date + nested accessorFn',
  render: () => (
    <PreviewCard
      data={INCIDENT}
      fields={FORMATTED_FIELDS}
    />
  ),
};

// ---------------------------------------------------------------------------
// Empty — data=null with emptyMessage
// ---------------------------------------------------------------------------

export const Empty: Story = {
  name: 'empty state · data=null',
  render: () => (
    <PreviewCard
      data={null}
      fields={BASE_FIELDS}
      emptyMessage="Выберите карточку"
    />
  ),
};

// ---------------------------------------------------------------------------
// EmptyUndefined — data=undefined (same visual, documents both nullish paths)
// ---------------------------------------------------------------------------

export const EmptyUndefined: Story = {
  name: 'empty state · data=undefined',
  render: () => (
    <PreviewCard
      data={undefined}
      fields={BASE_FIELDS}
      emptyMessage="No item selected"
    />
  ),
};

// ---------------------------------------------------------------------------
// LongValues — visual check for overflow behaviour on long strings
// ---------------------------------------------------------------------------

interface ILongItem {
  id: number;
  title: string;
  body: string;
}

const LONG_ITEM: ILongItem = {
  id: 9999,
  title:
    'A Very Long Title That Exceeds Normal Sidebar Width And May Wrap Onto Several Lines In A Real Application UI',
  body:
    'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.',
};

export const LongValues: Story = {
  name: 'long values · overflow visual check',
  render: () => (
    <PreviewCard
      data={LONG_ITEM}
      fields={[
        { accessorKey: 'id', header: 'ID' },
        { accessorKey: 'title', header: 'Title' },
        { accessorKey: 'body', header: 'Description' },
      ]}
    />
  ),
};

// ---------------------------------------------------------------------------
// WithCustomClass — outer class applied
// ---------------------------------------------------------------------------

export const WithCustomClass: Story = {
  name: 'with custom class · border + padding',
  render: () => (
    <PreviewCard
      data={INCIDENT}
      fields={BASE_FIELDS}
      class="rounded-lg border border-border bg-muted/30 p-4"
    />
  ),
};

// ---------------------------------------------------------------------------
// InsideCard — typical consumer usage: PreviewCard inside Card.Content
// ---------------------------------------------------------------------------

export const InsideCard: Story = {
  name: 'inside card · typical usage',
  render: () => (
    <Card>
      <Card.Header>
        <Card.Title>Incident #{INCIDENT.id}</Card.Title>
        <Card.Description>{INCIDENT.title}</Card.Description>
      </Card.Header>
      <Card.Content>
        <PreviewCard
          data={INCIDENT}
          fields={FORMATTED_FIELDS}
        />
      </Card.Content>
    </Card>
  ),
};
