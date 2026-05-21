import { cn } from '@capsuletech/web-style';
import { splitProps } from 'solid-js';

import type { ITableProps } from './interfaces';
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from './parts';

const TableImpl = (props: ITableProps) => {
  const [local, others] = splitProps(props, ['class']);
  return (
    <div class="relative w-full overflow-auto">
      <table class={cn('w-full caption-bottom text-sm', local.class)} {...others} />
    </div>
  );
};

export const Table = Object.assign(TableImpl, {
  Header: TableHeader,
  Body: TableBody,
  Row: TableRow,
  Head: TableHead,
  Cell: TableCell,
});
