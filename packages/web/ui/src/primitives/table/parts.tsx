import { cn } from '@capsuletech/web-style';
import { splitProps } from 'solid-js';

import type {
  ITableBodyProps,
  ITableCellProps,
  ITableHeadProps,
  ITableHeaderProps,
  ITableRowProps,
} from './interfaces';

export const TableHeader = (props: ITableHeaderProps) => {
  const [local, others] = splitProps(props, ['class']);
  return <thead class={cn('[&_tr]:border-b', local.class)} {...others} />;
};

export const TableBody = (props: ITableBodyProps) => {
  const [local, others] = splitProps(props, ['class']);
  return <tbody class={cn('[&_tr:last-child]:border-0', local.class)} {...others} />;
};

export const TableRow = (props: ITableRowProps) => {
  const [local, others] = splitProps(props, ['class']);
  return (
    <tr
      class={cn(
        'border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted',
        local.class,
      )}
      {...others}
    />
  );
};

export const TableHead = (props: ITableHeadProps) => {
  const [local, others] = splitProps(props, ['class']);
  return (
    <th
      class={cn(
        'h-12 px-4 text-left align-middle font-medium text-muted-foreground',
        local.class,
      )}
      {...others}
    />
  );
};

export const TableCell = (props: ITableCellProps) => {
  const [local, others] = splitProps(props, ['class']);
  return <td class={cn('p-4 align-middle', local.class)} {...others} />;
};
