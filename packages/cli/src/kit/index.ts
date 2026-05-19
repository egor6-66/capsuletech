import chalk from 'chalk';
import { shell } from './shell';
import { printTable } from './table';
import { ui } from './ui';

export const kit = {
  ...ui,
  ...shell,
  printTable,
  chalk,
};
