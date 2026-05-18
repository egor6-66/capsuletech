import { Table } from 'console-table-printer';

export const printTable = (data: unknown[]) => {
  const p = new Table();
  // @ts-expect-error
  p.addRows(data);
  p.printTable();
};
