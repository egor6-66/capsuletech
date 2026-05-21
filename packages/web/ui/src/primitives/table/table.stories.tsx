import {
  type ColumnDef,
  createSolidTable,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
} from '@tanstack/solid-table';
import { type Meta, type StoryObj } from 'storybook-solidjs-vite';
import { createSignal } from 'solid-js';

import { Button } from '../button';
import { Table } from '.';

// ---------------------------------------------------------------------------
// Shared data / columns
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
];

const baseColumns: ColumnDef<IUser>[] = [
  { accessorKey: 'id', header: 'ID', size: 60 },
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'email', header: 'Email' },
  { accessorKey: 'role', header: 'Role' },
  { accessorKey: 'status', header: 'Status' },
];

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

const meta = {
  title: 'Components/Table',
  component: Table,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div class="overflow-auto p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Table>;

export default meta;
type Story = StoryObj<typeof meta>;

// ---------------------------------------------------------------------------
// Basic — Table primitives as pure semantic wrappers
// ---------------------------------------------------------------------------

export const Basic: Story = {
  name: 'basic · semantic wrappers',
  render: () => {
    const table = createSolidTable({
      get data() {
        return USERS;
      },
      columns: baseColumns,
      getCoreRowModel: getCoreRowModel(),
    });

    return (
      <Table>
        <Table.Header>
          {table.getHeaderGroups().map((hg) => (
            <Table.Row>
              {hg.headers.map((header) => (
                <Table.Head>
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </Table.Head>
              ))}
            </Table.Row>
          ))}
        </Table.Header>
        <Table.Body>
          {table.getRowModel().rows.map((row) => (
            <Table.Row>
              {row.getVisibleCells().map((cell) => (
                <Table.Cell>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </Table.Cell>
              ))}
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
    );
  },
};

// ---------------------------------------------------------------------------
// Sorting — getSortedRowModel + sortingState signal
// ---------------------------------------------------------------------------

export const WithSorting: Story = {
  name: 'with sorting · getSortedRowModel',
  render: () => {
    const [sorting, setSorting] = createSignal<
      import('@tanstack/solid-table').SortingState
    >([]);

    const sortableColumns: ColumnDef<IUser>[] = baseColumns.map((col) => ({
      ...col,
      enableSorting: true,
    }));

    const table = createSolidTable({
      get data() {
        return USERS;
      },
      columns: sortableColumns,
      state: {
        get sorting() {
          return sorting();
        },
      },
      onSortingChange: setSorting,
      getCoreRowModel: getCoreRowModel(),
      getSortedRowModel: getSortedRowModel(),
    });

    return (
      <div class="flex flex-col gap-2">
        <p class="text-muted-foreground text-xs">Click a header to sort by that column.</p>
        <Table>
          <Table.Header>
            {table.getHeaderGroups().map((hg) => (
              <Table.Row>
                {hg.headers.map((header) => (
                  <Table.Head
                    class="cursor-pointer select-none"
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <span class="inline-flex items-center gap-1">
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getIsSorted() === 'asc'
                        ? ' ↑'
                        : header.column.getIsSorted() === 'desc'
                          ? ' ↓'
                          : null}
                    </span>
                  </Table.Head>
                ))}
              </Table.Row>
            ))}
          </Table.Header>
          <Table.Body>
            {table.getRowModel().rows.map((row) => (
              <Table.Row>
                {row.getVisibleCells().map((cell) => (
                  <Table.Cell>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </Table.Cell>
                ))}
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      </div>
    );
  },
};

// ---------------------------------------------------------------------------
// Pagination — getPaginationRowModel + manual prev/next
// ---------------------------------------------------------------------------

export const WithPagination: Story = {
  name: 'with pagination · getPaginationRowModel',
  render: () => {
    const [pagination, setPagination] = createSignal<
      import('@tanstack/solid-table').PaginationState
    >({ pageIndex: 0, pageSize: 3 });

    const table = createSolidTable({
      get data() {
        return USERS;
      },
      columns: baseColumns,
      state: {
        get pagination() {
          return pagination();
        },
      },
      onPaginationChange: setPagination,
      getCoreRowModel: getCoreRowModel(),
      getPaginationRowModel: getPaginationRowModel(),
      manualPagination: false,
    });

    return (
      <div class="flex flex-col gap-3">
        <Table>
          <Table.Header>
            {table.getHeaderGroups().map((hg) => (
              <Table.Row>
                {hg.headers.map((header) => (
                  <Table.Head>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </Table.Head>
                ))}
              </Table.Row>
            ))}
          </Table.Header>
          <Table.Body>
            {table.getRowModel().rows.map((row) => (
              <Table.Row>
                {row.getVisibleCells().map((cell) => (
                  <Table.Cell>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </Table.Cell>
                ))}
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
        <div class="flex items-center justify-between text-sm">
          <span class="text-muted-foreground">
            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
          </span>
          <div class="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={!table.getCanPreviousPage()}
              onClick={() => table.previousPage()}
            >
              Previous
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!table.getCanNextPage()}
              onClick={() => table.nextPage()}
            >
              Next
            </Button>
          </div>
        </div>
      </div>
    );
  },
};

// ---------------------------------------------------------------------------
// Row selection — checkbox column + getFilteredSelectedRowModel
// ---------------------------------------------------------------------------

export const WithRowSelection: Story = {
  name: 'with row selection · getFilteredSelectedRowModel',
  render: () => {
    const [rowSelection, setRowSelection] = createSignal<
      import('@tanstack/solid-table').RowSelectionState
    >({});

    const selectionColumns: ColumnDef<IUser>[] = [
      {
        id: 'select',
        header: ({ table }) => (
          <input
            type="checkbox"
            class="cursor-pointer"
            checked={table.getIsAllPageRowsSelected()}
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
      ...baseColumns,
    ];

    const table = createSolidTable({
      get data() {
        return USERS;
      },
      columns: selectionColumns,
      state: {
        get rowSelection() {
          return rowSelection();
        },
      },
      onRowSelectionChange: setRowSelection,
      getCoreRowModel: getCoreRowModel(),
      getFilteredRowModel: getFilteredRowModel(),
      enableRowSelection: true,
    });

    const selectedCount = () =>
      Object.keys(rowSelection()).length;

    return (
      <div class="flex flex-col gap-3">
        <Table>
          <Table.Header>
            {table.getHeaderGroups().map((hg) => (
              <Table.Row>
                {hg.headers.map((header) => (
                  <Table.Head>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </Table.Head>
                ))}
              </Table.Row>
            ))}
          </Table.Header>
          <Table.Body>
            {table.getRowModel().rows.map((row) => (
              <Table.Row data-state={row.getIsSelected() ? 'selected' : undefined}>
                {row.getVisibleCells().map((cell) => (
                  <Table.Cell>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </Table.Cell>
                ))}
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
        <p class="text-muted-foreground text-xs">
          {selectedCount()} of {USERS.length} row(s) selected.
        </p>
      </div>
    );
  },
};
