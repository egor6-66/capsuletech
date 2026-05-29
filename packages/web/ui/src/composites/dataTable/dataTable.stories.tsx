import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { createSignal } from 'solid-js';

import { Input } from '../../primitives/input';
import { DataTable } from './dataTable';
import type { IColumn } from './interfaces';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

interface IUser {
  id: number;
  name: string;
  email: string;
  role: string;
  status: 'active' | 'inactive';
}

const USERS: IUser[] = [
  { id: 1, name: 'Alice Martin', email: 'alice@example.com', role: 'Admin', status: 'active' },
  { id: 2, name: 'Bob Chen', email: 'bob@example.com', role: 'Developer', status: 'active' },
  { id: 3, name: 'Carol Davis', email: 'carol@example.com', role: 'Designer', status: 'inactive' },
  { id: 4, name: 'Dan Lee', email: 'dan@example.com', role: 'Developer', status: 'active' },
  { id: 5, name: 'Eva Torres', email: 'eva@example.com', role: 'PM', status: 'active' },
  { id: 6, name: 'Frank Müller', email: 'frank@example.com', role: 'Developer', status: 'inactive' },
  { id: 7, name: 'Grace Kim', email: 'grace@example.com', role: 'Designer', status: 'active' },
  { id: 8, name: 'Hiro Tanaka', email: 'hiro@example.com', role: 'Admin', status: 'active' },
  { id: 9, name: 'Iris Novak', email: 'iris@example.com', role: 'PM', status: 'active' },
  { id: 10, name: 'Jake Osei', email: 'jake@example.com', role: 'Developer', status: 'active' },
  { id: 11, name: 'Kira Soto', email: 'kira@example.com', role: 'Designer', status: 'inactive' },
  { id: 12, name: 'Leo Brandt', email: 'leo@example.com', role: 'Admin', status: 'active' },
];

// Using typed IColumn<IUser> — `accessorKey` is constrained to keyof IUser
const columns: IColumn<IUser>[] = [
  { accessorKey: 'id', header: 'ID', size: 60 },
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'email', header: 'Email' },
  { accessorKey: 'role', header: 'Role' },
  { accessorKey: 'status', header: 'Status' },
];

const selectionColumns: IColumn<IUser>[] = [
  {
    id: 'select',
    header: ({ table }) => (
      <input
        type="checkbox"
        class="cursor-pointer"
        checked={table.getIsAllPageRowsSelected()}
        // @ts-expect-error — indeterminate is not in the standard TS typings for HTMLInputElement but is valid DOM
        indeterminate={table.getIsSomePageRowsSelected()}
        onChange={table.getToggleAllPageRowsSelectedHandler()}
      />
    ),
    cell: ({ row }) => (
      <input
        type="checkbox"
        class="cursor-pointer"
        checked={row.getIsSelected()}
        disabled={!row.getCanSelect()}
        onChange={row.getToggleSelectedHandler()}
      />
    ),
    size: 48,
  },
  ...columns,
];

// ---------------------------------------------------------------------------
// 1000-row fixture for infinite scroll demos
// ---------------------------------------------------------------------------

function makeLargeDataset(count: number): IUser[] {
  const roles = ['Admin', 'Developer', 'Designer', 'PM'] as const;
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    name: `User ${i + 1}`,
    email: `user${i + 1}@example.com`,
    role: roles[i % roles.length],
    status: i % 3 === 0 ? 'inactive' : 'active',
  }));
}

const LARGE_DATASET = makeLargeDataset(1000);

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

const meta = {
  title: 'Composites/DataTable',
  component: DataTable,
  tags: ['autodocs'],
  decorators: [
    (Story: () => import('solid-js').JSX.Element) => (
      <div class="overflow-auto p-4">
        {Story()}
      </div>
    ),
  ],
} satisfies Meta<typeof DataTable>;

export default meta;
type Story = StoryObj<typeof meta>;

// ---------------------------------------------------------------------------
// Basic — no features enabled
// ---------------------------------------------------------------------------

export const Basic: Story = {
  name: 'basic · no features',
  render: () => <DataTable data={USERS} columns={columns} />,
};

// ---------------------------------------------------------------------------
// WithSorting
// ---------------------------------------------------------------------------

export const WithSorting: Story = {
  name: 'with sorting',
  render: () => <DataTable data={USERS} columns={columns} sorting />,
};

// ---------------------------------------------------------------------------
// WithPagination — default pageSize 10
// ---------------------------------------------------------------------------

export const WithPagination: Story = {
  name: 'with pagination · default pageSize',
  render: () => <DataTable data={USERS} columns={columns} pagination />,
};

// ---------------------------------------------------------------------------
// WithPaginationCustomSize
// ---------------------------------------------------------------------------

export const WithPaginationCustomSize: Story = {
  name: 'with pagination · pageSize 3',
  render: () => <DataTable data={USERS} columns={columns} pagination={{ pageSize: 3 }} />,
};

// ---------------------------------------------------------------------------
// WithSelection — checkbox column must be included in columns
// ---------------------------------------------------------------------------

export const WithSelection: Story = {
  name: 'with selection',
  render: () => <DataTable data={USERS} columns={selectionColumns} selection />,
};

// ---------------------------------------------------------------------------
// WithToolbar — global filter input
// ---------------------------------------------------------------------------

export const WithToolbar: Story = {
  name: 'with toolbar · global filter',
  render: () => {
    const [filter, setFilter] = createSignal('');
    return (
      <DataTable
        data={USERS.filter((u) =>
          !filter() ||
          u.name.toLowerCase().includes(filter().toLowerCase()) ||
          u.email.toLowerCase().includes(filter().toLowerCase()),
        )}
        columns={columns}
        toolbar={
          <Input
            placeholder="Filter by name or email…"
            value={filter()}
            onInput={(e) => setFilter((e.target as HTMLInputElement).value)}
          />
        }
      />
    );
  },
};

// ---------------------------------------------------------------------------
// Full — all features combined (pagination, no infinite)
// ---------------------------------------------------------------------------

export const Full: Story = {
  name: 'full · sorting + pagination + selection',
  render: () => (
    <DataTable
      data={USERS}
      columns={selectionColumns}
      sorting
      pagination={{ pageSize: 5 }}
      selection
    />
  ),
};

// ---------------------------------------------------------------------------
// EmptyState — data: []
// ---------------------------------------------------------------------------

export const EmptyState: Story = {
  name: 'empty state · data: []',
  render: () => <DataTable data={[]} columns={columns} emptyMessage="No users found." />,
};

// ---------------------------------------------------------------------------
// EmptyStateDefault — no emptyMessage
// ---------------------------------------------------------------------------

export const EmptyStateDefault: Story = {
  name: 'empty state · default message',
  render: () => <DataTable data={[]} columns={columns} />,
};

// ---------------------------------------------------------------------------
// WithInfinite — 1000 rows, virtual scroll
// ---------------------------------------------------------------------------

export const WithInfinite: Story = {
  name: 'infinite scroll · 1000 rows',
  render: () => (
    <DataTable
      data={LARGE_DATASET}
      columns={columns}
      sorting
      infinite
    />
  ),
};

// ---------------------------------------------------------------------------
// WithInfiniteCustomHeight — tuned itemHeight
// ---------------------------------------------------------------------------

export const WithInfiniteCustomHeight: Story = {
  name: 'infinite scroll · custom itemHeight 48',
  render: () => (
    <DataTable
      data={LARGE_DATASET}
      columns={columns}
      infinite={{ itemHeight: 48, overscan: 10 }}
    />
  ),
};

// ---------------------------------------------------------------------------
// WithInfiniteLoading — server-side load-more pattern
// ---------------------------------------------------------------------------

export const WithInfiniteLoading: Story = {
  name: 'infinite scroll · onLoadMore callback',
  render: () => {
    const PAGE = 50;
    const [rows, setRows] = createSignal<IUser[]>(makeLargeDataset(PAGE));
    const [loading, setLoading] = createSignal(false);
    const [page, setPage] = createSignal(1);

    const handleLoadMore = () => {
      if (loading() || rows().length >= 500) return;
      setLoading(true);
      // Simulate async fetch with setTimeout
      setTimeout(() => {
        const nextPage = page() + 1;
        setPage(nextPage);
        setRows((prev) => [
          ...prev,
          ...makeLargeDataset(PAGE).map((u) => ({
            ...u,
            id: u.id + (nextPage - 1) * PAGE,
            name: `User ${u.id + (nextPage - 1) * PAGE}`,
            email: `user${u.id + (nextPage - 1) * PAGE}@example.com`,
          })),
        ]);
        setLoading(false);
      }, 800);
    };

    return (
      <div>
        <p class="mb-2 text-sm text-muted-foreground">
          {rows().length} rows loaded{loading() ? ' · loading more…' : ''}
        </p>
        <DataTable
          data={rows()}
          columns={columns}
          infinite={{ threshold: 10 }}
          onLoadMore={handleLoadMore}
        />
      </div>
    );
  },
};

// ---------------------------------------------------------------------------
// WithItemMeta — itemMeta/itemPayload for HCA event-binding (cursor-pointer affordance)
// ---------------------------------------------------------------------------

export const WithItemMeta: Story = {
  name: 'with itemMeta · HCA event-binding affordance',
  render: () => (
    <DataTable
      data={USERS}
      columns={columns}
      itemMeta={(row) => ({ tags: ['user', 'row'], id: row.id })}
      itemPayload={(row) => ({ userId: row.id, userName: row.name, userRole: row.role })}
    />
  ),
};

// ---------------------------------------------------------------------------
// WithItemMetaInfinite — same pattern but with virtual scroll
// ---------------------------------------------------------------------------

export const WithItemMetaInfinite: Story = {
  name: 'with itemMeta · infinite scroll',
  render: () => (
    <DataTable
      data={LARGE_DATASET}
      columns={columns}
      infinite
      itemMeta={(row) => ({ tags: ['user', 'row'], id: row.id })}
      itemPayload={(row) => ({ userId: row.id, userName: row.name })}
    />
  ),
};
