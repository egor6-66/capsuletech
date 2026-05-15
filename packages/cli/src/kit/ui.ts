import * as p from '@clack/prompts';
import chalk from 'chalk';
import { inkConfirm, inkInput, inkSelect, type SelectOption } from './prompts';

export const ui = {
  intro: (title: string) => p.intro(chalk.bgCyan.black(` ${title} `)),
  outro: (message: string) => p.outro(chalk.green(message)),

  select: async <T>(message: string, options: SelectOption<T>[]) => {
    const res = await inkSelect(message, options);
    if (res === null) ui.cancel();
    return res as T;
  },

  confirm: async (message: string) => {
    const res = await inkConfirm(message);
    if (res === null) ui.cancel();
    return res as boolean;
  },

  input: async (message: string, placeholder?: string, validate?: (v: string) => string) => {
    const res = await inkInput(message, placeholder, validate);
    if (res === null) ui.cancel();
    return res as string;
  },

  note: (message: string, title?: string) => p.note(message, title),
  divider: () => console.log(chalk.dim('──────────────────────────────────────────')),

  log: p.log,
  spinner: p.spinner,

  cancel: (msg = 'Операция отменена') => {
    p.cancel(chalk.yellow(msg));
    process.exit(0);
  },
};
