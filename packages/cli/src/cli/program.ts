import { Command as Commander } from 'commander';
import type { Command } from '../commands';
import { staticCommands } from '../commands';
import { detect } from '../context';
import { kit } from '../kit';
import { runCommand } from './runner';

interface TreeNode {
  segment: string;
  command?: Command;
  children: Map<string, TreeNode>;
}

const buildTree = (cmds: Command[]): TreeNode => {
  const root: TreeNode = { segment: '', children: new Map() };
  for (const cmd of cmds) {
    const parts = cmd.id.split('.');
    let node = root;
    for (let i = 0; i < parts.length; i++) {
      const seg = parts[i];
      let child = node.children.get(seg);
      if (!child) {
        child = { segment: seg, children: new Map() };
        node.children.set(seg, child);
      }
      if (i === parts.length - 1) child.command = cmd;
      node = child;
    }
  }
  return root;
};

const attachCommand = (parent: Commander, node: TreeNode): void => {
  const cmd = node.command;
  const subCmd = parent.command(node.segment);

  if (cmd) {
    subCmd.description(cmd.description);
    const positional = (cmd.params ?? []).filter((p) => p.positional);
    for (const param of positional) {
      const sig = param.required ? `<${param.name}>` : `[${param.name}]`;
      subCmd.argument(sig, param.description);
    }
    subCmd.action(async (...args: unknown[]) => {
      // commander передаёт позиционные args + последний — сам объект Command.
      // Срежем хвост.
      const positionalValues = args.slice(0, positional.length);
      const params: Record<string, unknown> = {};
      positional.forEach((p, i) => {
        if (positionalValues[i] !== undefined) params[p.name] = positionalValues[i];
      });
      const ctx = detect();
      await runCommand(cmd, ctx, params);
    });
  } else {
    subCmd.description(`Группа команд: ${node.segment}`);
  }

  for (const child of node.children.values()) {
    attachCommand(subCmd, child);
  }
};

export const buildProgram = (): Commander => {
  const program = new Commander()
    .name('capsule')
    .description('Capsule CLI: scaffold, dev, nx и инфо про workspace')
    .helpOption('-h, --help', 'Показать справку')
    .addHelpText('after', '\nЗапусти без аргументов чтобы открыть интерактивное меню.');

  const tree = buildTree(staticCommands);
  for (const child of tree.children.values()) {
    attachCommand(program, child);
  }

  program.exitOverride((err) => {
    if (err.code === 'commander.helpDisplayed' || err.code === 'commander.help') return;
    kit.log.error(err.message);
    process.exit(err.exitCode ?? 1);
  });

  return program;
};
