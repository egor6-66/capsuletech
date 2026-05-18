import { execa } from 'execa';
import type { CommandAction } from '../commands/types';
import { kit } from '../kit';

type NxJsonProjects = string[] | Record<string, unknown>;

const runNx = async (root: string, args: string[]): Promise<string> => {
  const { stdout } = await execa('pnpm', ['exec', 'nx', ...args], { cwd: root });
  return stdout;
};

const parseProjects = (raw: string): string[] => {
  try {
    const data = JSON.parse(raw) as NxJsonProjects;
    if (Array.isArray(data)) return data.sort();
    return Object.keys(data).sort();
  } catch {
    return raw
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
      .sort();
  }
};

export const nxProjects: CommandAction = async (ctx) => {
  if (!ctx.root) return;
  const stdout = await kit.task('nx show projects', async () =>
    runNx(ctx.root!, ['show', 'projects', '--json']),
  );
  const projects = parseProjects(String(stdout));
  kit.printTable(projects.map((name) => ({ project: name })));
  kit.log.info(`Всего: ${projects.length}`);
};

export const nxAffected: CommandAction = async (ctx) => {
  if (!ctx.root) return;
  const stdout = await kit.task('nx affected projects (vs main)', async () =>
    runNx(ctx.root!, ['show', 'projects', '--affected', '--base=main', '--json']),
  );
  const projects = parseProjects(String(stdout));
  if (projects.length === 0) {
    kit.log.info('Нет затронутых проектов относительно main.');
    return;
  }
  kit.printTable(projects.map((name) => ({ affected: name })));
};

export const nxGraph: CommandAction = async (ctx) => {
  if (!ctx.root) return;
  kit.log.info('Открываю граф зависимостей в браузере (Ctrl+C чтобы закрыть)…');
  await execa('pnpm', ['exec', 'nx', 'graph'], { cwd: ctx.root, stdio: 'inherit' });
};

export const nxReport: CommandAction = async (ctx) => {
  if (!ctx.root) return;
  const stdout = await kit.task('nx report', async () => runNx(ctx.root!, ['report']));
  // eslint-disable-next-line no-console
  console.log(String(stdout));
};

export const nxReleaseTags: CommandAction = async (ctx) => {
  if (!ctx.root) return;
  const { stdout } = await execa('git', ['tag', '-l', '--sort=-creatordate'], {
    cwd: ctx.root,
  });
  const tags = stdout
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 20);
  if (tags.length === 0) {
    kit.log.info('Релизных тегов пока нет.');
    return;
  }
  kit.printTable(tags.map((tag) => ({ tag })));
};

export const nxRun: CommandAction = async (ctx, params) => {
  if (!ctx.root) return;
  const target = params.target as string | undefined;
  if (!target) {
    kit.log.error('Не указан target в формате <project>:<task>');
    return;
  }
  await execa('pnpm', ['exec', 'nx', 'run', target], { cwd: ctx.root, stdio: 'inherit' });
};
