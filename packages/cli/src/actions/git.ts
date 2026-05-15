import chalk from 'chalk';
import { execa } from 'execa';
import type { CommandAction } from '../commands/types';
import { type CliContext, listWorkspaceChildren } from '../context';
import { kit } from '../kit';

const padLabel = (s: string, w = 8): string => s + ' '.repeat(Math.max(0, w - s.length));

const BRANCH_TYPES: Array<{ value: string; label: string; hint: string }> = [
  { value: 'feat', label: 'feat', hint: 'новая фича' },
  { value: 'fix', label: 'fix', hint: 'багфикс' },
  { value: 'dev', label: 'dev', hint: 'долгоживущая dev-ветка пакета' },
  { value: 'chore', label: 'chore', hint: 'cleanup / housekeeping' },
  { value: 'refactor', label: 'refactor', hint: 'рефакторинг без поведенческих изменений' },
  { value: 'docs', label: 'docs', hint: 'документация' },
  { value: 'test', label: 'test', hint: 'тесты' },
];

/** Conventional Commits types — порядок по частоте использования. */
const COMMIT_TYPES: Array<{ value: string; label: string; hint: string }> = [
  { value: 'feat', label: chalk.green(padLabel('feat')), hint: 'новая функциональность' },
  { value: 'fix', label: chalk.yellow(padLabel('fix')), hint: 'исправление бага' },
  {
    value: 'refactor',
    label: chalk.cyan(padLabel('refactor')),
    hint: 'рефакторинг без изменения поведения',
  },
  { value: 'perf', label: chalk.magenta(padLabel('perf')), hint: 'оптимизация производительности' },
  { value: 'docs', label: chalk.blue(padLabel('docs')), hint: 'только документация' },
  { value: 'style', label: chalk.gray(padLabel('style')), hint: 'форматирование, без логики' },
  { value: 'test', label: chalk.greenBright(padLabel('test')), hint: 'добавление/правка тестов' },
  {
    value: 'build',
    label: chalk.blueBright(padLabel('build')),
    hint: 'сборка, зависимости (pnpm, vite, nx)',
  },
  { value: 'ci', label: chalk.cyanBright(padLabel('ci')), hint: 'CI/CD (GitHub Actions и т.п.)' },
  { value: 'chore', label: chalk.dim(padLabel('chore')), hint: 'рутина, не трогающая исходники' },
  { value: 'revert', label: chalk.red(padLabel('revert')), hint: 'отмена предыдущего коммита' },
  { value: 'wip', label: chalk.yellow.dim(padLabel('wip')), hint: 'work in progress (временный)' },
];

interface BranchInfo {
  name: string;
  current: boolean;
  upstream: string | null;
  ahead: number;
  behind: number;
  lastCommit: string;
}

const git = async (root: string, args: string[]): Promise<string> => {
  const { stdout } = await execa('git', args, { cwd: root });
  return stdout;
};

const gitInherit = async (root: string, args: string[]): Promise<void> => {
  await execa('git', args, { cwd: root, stdio: 'inherit' });
};

const currentBranch = async (root: string): Promise<string> =>
  (await git(root, ['rev-parse', '--abbrev-ref', 'HEAD'])).trim();

const scopeFromCtx = (ctx: CliContext): string | null => {
  if (ctx.type === 'app' || ctx.type === 'lib') return ctx.name ?? null;
  return null;
};

const parseTrack = (track: string): { ahead: number; behind: number } => {
  if (!track) return { ahead: 0, behind: 0 };
  const a = track.match(/ahead (\d+)/);
  const b = track.match(/behind (\d+)/);
  return { ahead: a ? Number(a[1]) : 0, behind: b ? Number(b[1]) : 0 };
};

const listBranches = async (root: string): Promise<BranchInfo[]> => {
  const fmt =
    '%(refname:short)\t%(HEAD)\t%(upstream:short)\t%(upstream:track)\t%(committerdate:relative)\t%(contents:subject)';
  const stdout = await git(root, [
    'for-each-ref',
    `--format=${fmt}`,
    'refs/heads/',
    '--sort=-committerdate',
  ]);
  return stdout
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [name, head, upstream, track, date, subject] = line.split('\t');
      const { ahead, behind } = parseTrack(track ?? '');
      return {
        name,
        current: head === '*',
        upstream: upstream || null,
        ahead,
        behind,
        lastCommit: `${date} — ${subject ?? ''}`,
      };
    });
};

const matchesScope = (branch: string, scope: string): boolean => {
  const parts = branch.split('/');
  return parts.length >= 2 && parts[1] === scope;
};

const hasUpstream = async (root: string, branch: string): Promise<boolean> => {
  try {
    await git(root, ['rev-parse', '--abbrev-ref', `${branch}@{upstream}`]);
    return true;
  } catch {
    return false;
  }
};

const sanitizeSlug = (raw: string): string =>
  raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-_.]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

const pickScope = async (ctx: CliContext): Promise<string | null> => {
  if (!ctx.root) return null;
  const ctxScope = scopeFromCtx(ctx);
  if (ctxScope) {
    const useCtx = await kit.confirm(`Использовать scope «${ctxScope}» (текущий пакет)?`);
    if (useCtx) return ctxScope;
  }
  const apps = listWorkspaceChildren(ctx.root, 'apps').map((n) => `${n}`);
  const libs = listWorkspaceChildren(ctx.root, 'packages').map((n) => `${n}`);
  const options = [
    ...apps.map((n) => ({ value: n, label: n, hint: 'app' })),
    ...libs.map((n) => ({ value: n, label: n, hint: 'package' })),
    { value: '__custom__', label: '✏  Свой scope…' },
  ];
  const picked = await kit.select<string>('Scope:', options);
  if (picked === '__custom__') {
    const custom = (await kit.input('Свой scope (kebab-case):', 'my-scope')) as string;
    return sanitizeSlug(custom) || null;
  }
  return picked ?? null;
};

export const gitStatus: CommandAction = async (ctx) => {
  if (!ctx.root) return;
  const branch = await currentBranch(ctx.root);
  const status = await git(ctx.root, ['status', '--short', '--branch']);
  kit.note(status.trim() || '(рабочее дерево чистое)', `🌿 ${branch}`);
};

export const gitBranches: CommandAction = async (ctx, params) => {
  if (!ctx.root) return;
  const all = await listBranches(ctx.root);
  const scope = (params.scope as string | undefined) ?? scopeFromCtx(ctx) ?? null;
  const showAll = params.all === true;

  const filtered =
    scope && !showAll ? all.filter((b) => b.current || matchesScope(b.name, scope)) : all;

  if (filtered.length === 0) {
    kit.log.info(`Нет веток${scope ? ` под scope «${scope}»` : ''}.`);
    return;
  }

  kit.printTable(
    filtered.map((b) => ({
      cur: b.current ? '●' : '',
      branch: b.name,
      upstream: b.upstream ?? '—',
      ahead: b.ahead ? `+${b.ahead}` : '',
      behind: b.behind ? `-${b.behind}` : '',
      last: b.lastCommit,
    })),
  );

  if (scope && !showAll && filtered.length < all.length) {
    kit.log.info(`Показано ${filtered.length}/${all.length} (scope «${scope}»). Все ветки: --all.`);
  }
};

export const gitSwitch: CommandAction = async (ctx) => {
  if (!ctx.root) return;
  const all = await listBranches(ctx.root);
  if (all.length === 0) {
    kit.log.warn('Локальных веток нет.');
    return;
  }
  const scope = scopeFromCtx(ctx);
  const scoped = scope ? all.filter((b) => matchesScope(b.name, scope)) : [];
  const others = scope ? all.filter((b) => !matchesScope(b.name, scope)) : all;

  const options = [
    ...(scoped.length
      ? scoped.map((b) => ({
          value: b.name,
          label: `${b.current ? '● ' : '  '}${b.name}`,
          hint: `[${scope}] ${b.lastCommit}`,
        }))
      : []),
    ...others.map((b) => ({
      value: b.name,
      label: `${b.current ? '● ' : '  '}${b.name}`,
      hint: b.lastCommit,
    })),
  ];

  const target = await kit.select<string>(
    scope ? `Ветка (сверху — scope «${scope}»):` : 'Ветка:',
    options,
  );
  if (!target) return;

  const current = await currentBranch(ctx.root);
  if (target === current) {
    kit.log.info('Уже на этой ветке.');
    return;
  }
  await gitInherit(ctx.root, ['switch', target]);
};

export const gitCreateBranch: CommandAction = async (ctx) => {
  if (!ctx.root) return;
  const type = await kit.select<string>('Тип ветки:', BRANCH_TYPES);
  if (!type) return;

  const scope = await pickScope(ctx);
  if (!scope) {
    kit.log.error('Scope обязателен.');
    return;
  }

  const rawSlug = (await kit.input(
    'Slug (kebab-case; пусто — без slug, тогда имя будет <type>/<scope>):',
    'auth-redirect',
  )) as string;
  const slug = sanitizeSlug(rawSlug);

  const name = slug ? `${type}/${scope}/${slug}` : `${type}/${scope}`;

  const ok = await kit.confirm(`Создать и переключиться на «${name}»?`);
  if (!ok) return;

  await gitInherit(ctx.root, ['switch', '-c', name]);
};

export const gitPull: CommandAction = async (ctx) => {
  if (!ctx.root) return;
  const branch = await currentBranch(ctx.root);
  if (!(await hasUpstream(ctx.root, branch))) {
    kit.log.warn(`У ветки ${branch} нет upstream — нечего pull'ить. Сначала push.`);
    return;
  }
  await gitInherit(ctx.root, ['pull', '--ff-only']);
};

export const gitPush: CommandAction = async (ctx) => {
  if (!ctx.root) return;
  const branch = await currentBranch(ctx.root);
  if (!(await hasUpstream(ctx.root, branch))) {
    const ok = await kit.confirm(
      `У ветки ${branch} нет upstream. Запушить с --set-upstream origin ${branch}?`,
    );
    if (!ok) return;
    await gitInherit(ctx.root, ['push', '--set-upstream', 'origin', branch]);
    return;
  }
  await gitInherit(ctx.root, ['push']);
};

export const gitSync: CommandAction = async (ctx) => {
  if (!ctx.root) return;
  const root = ctx.root;
  await kit.task('git fetch --all --prune', async () => git(root, ['fetch', '--all', '--prune']));
  const all = await listBranches(root);
  const tracked = all.filter((b) => b.upstream);
  const diverged = tracked.filter((b) => b.ahead > 0 || b.behind > 0);
  const untracked = all.filter((b) => !b.upstream);

  if (diverged.length === 0 && untracked.length === 0) {
    kit.log.info('✓ Все ветки в sync с upstream.');
    return;
  }
  if (diverged.length > 0) {
    kit.note('Ветки расходятся с upstream:', '🔄 Diverged');
    kit.printTable(
      diverged.map((b) => ({
        branch: b.name,
        upstream: b.upstream ?? '—',
        ahead: b.ahead ? `+${b.ahead}` : '',
        behind: b.behind ? `-${b.behind}` : '',
      })),
    );
  }
  if (untracked.length > 0) {
    kit.log.info(`Без upstream (${untracked.length}): ${untracked.map((b) => b.name).join(', ')}`);
  }
};

const pickCommitScope = async (ctx: CliContext): Promise<string | null> => {
  if (!ctx.root) return null;
  const ctxScope = scopeFromCtx(ctx);
  const apps = listWorkspaceChildren(ctx.root, 'apps');
  const libs = listWorkspaceChildren(ctx.root, 'packages');

  const options: Array<{ value: string; label: string; hint?: string }> = [
    { value: '__none__', label: '— (без scope)', hint: 'type: subject' },
  ];
  if (ctxScope) {
    options.push({ value: ctxScope, label: `★ ${ctxScope}`, hint: 'текущий пакет' });
  }
  for (const a of apps) {
    if (a === ctxScope) continue;
    options.push({ value: a, label: a, hint: 'app' });
  }
  for (const l of libs) {
    if (l === ctxScope) continue;
    options.push({ value: l, label: l, hint: 'package' });
  }
  options.push({ value: '__custom__', label: '✏  Свой scope…' });

  const picked = await kit.select<string>('Scope коммита:', options);
  if (!picked || picked === '__none__') return null;
  if (picked === '__custom__') {
    const custom = (await kit.input('Свой scope (kebab-case):', 'my-scope')) as string;
    return sanitizeSlug(custom) || null;
  }
  return picked;
};

export const gitCommit: CommandAction = async (ctx, params) => {
  if (!ctx.root) return;
  const dirty = (await git(ctx.root, ['status', '--porcelain'])).trim();
  if (!dirty) {
    kit.log.info('Нечего коммитить — рабочее дерево чистое.');
    return;
  }
  kit.note(dirty, '📋 Изменения');

  const rawMessage = ((params.message as string | undefined) ?? '').trim();
  let message: string;

  if (rawMessage) {
    // Передано через CLI (`capsule git commit "feat(cli): ..."`) — используем как есть.
    message = rawMessage;
  } else {
    const type = await kit.select<string>('Тип коммита (Conventional Commits):', COMMIT_TYPES);
    if (!type) return;

    const scope = await pickCommitScope(ctx);

    const subject = (
      (await kit.input(
        'Subject (короткое описание в повелительном наклонении):',
        type === 'wip' ? 'work in progress' : 'add new thing',
      )) as string
    ).trim();
    if (!subject) {
      kit.log.warn('Пустой subject — отменено.');
      return;
    }

    message = scope ? `${type}(${scope}): ${subject}` : `${type}: ${subject}`;
  }

  const ok = await kit.confirm(`Закоммитить ВСЕ изменения как «${message}»?`);
  if (!ok) return;

  await gitInherit(ctx.root, ['add', '-A']);
  await gitInherit(ctx.root, ['commit', '-m', message]);
};

export const gitLog: CommandAction = async (ctx) => {
  if (!ctx.root) return;
  await gitInherit(ctx.root, ['log', '--oneline', '--graph', '--decorate', '--all', '-n', '20']);
};

/**
 * Подтянуть свежий main в текущую feat-ветку через rebase.
 * Если на main → просто `pull --ff-only`.
 */
export const gitSyncMain: CommandAction = async (ctx) => {
  if (!ctx.root) return;
  const root = ctx.root;
  const branch = await currentBranch(root);

  const dirty = (await git(root, ['status', '--porcelain'])).trim();
  if (dirty) {
    kit.log.warn('Рабочее дерево грязное — сначала commit/stash, потом sync.');
    return;
  }

  await kit.task('git fetch origin --prune', async () =>
    git(root, ['fetch', 'origin', '--prune']),
  );

  if (branch === 'main') {
    kit.log.info('Текущая ветка — main. Делаю pull --ff-only.');
    await gitInherit(root, ['pull', '--ff-only']);
    return;
  }

  kit.note(
    `Сейчас на «${branch}». Rebase поверх свежего origin/main.\n` +
      `Если будут конфликты — git добавит маркеры в файлы, исправь и git rebase --continue.\n` +
      `Если запутаешься — git rebase --abort вернёт всё как было.`,
    '🔄 Sync с main',
  );
  const ok = await kit.confirm(`git rebase origin/main на ветке «${branch}»?`);
  if (!ok) return;

  await gitInherit(root, ['rebase', 'origin/main']);
};

/**
 * Удалить локальные ветки, уже смерженные в main (защищены main + текущая).
 */
export const gitCleanMerged: CommandAction = async (ctx) => {
  if (!ctx.root) return;
  const root = ctx.root;
  const branch = await currentBranch(root);

  await kit.task('git fetch origin --prune', async () =>
    git(root, ['fetch', 'origin', '--prune']),
  );

  const merged = (await git(root, ['branch', '--merged', 'main']))
    .split('\n')
    .map((s) => s.replace(/^\*?\s+/, '').trim())
    .filter((b) => b && b !== 'main' && b !== branch);

  if (merged.length === 0) {
    kit.log.info('Нет локальных веток, смерженных в main.');
    return;
  }

  kit.note(merged.join('\n'), `🧹 К удалению (${merged.length})`);
  const ok = await kit.confirm('Удалить эти локальные ветки?');
  if (!ok) return;

  for (const b of merged) {
    try {
      await git(root, ['branch', '-d', b]);
      kit.log.info(`  ✓ deleted ${b}`);
    } catch (e) {
      kit.log.warn(`  ✗ skip ${b} (${(e as Error).message?.split('\n')[0] ?? 'error'})`);
    }
  }
};

const parseOriginRepo = (url: string): { owner: string; repo: string } | null => {
  // https://github.com/owner/repo.git | git@github.com:owner/repo.git
  const m = url.match(/github\.com[:/]([^/]+)\/([^/.]+)(?:\.git)?$/);
  if (!m) return null;
  return { owner: m[1], repo: m[2] };
};

/**
 * Открыть GitHub Create-PR в браузере для текущей ветки.
 * Если установлен `gh` — предлагает использовать его (создаёт PR прямо из CLI).
 */
export const gitPr: CommandAction = async (ctx) => {
  if (!ctx.root) return;
  const root = ctx.root;
  const branch = await currentBranch(root);

  if (branch === 'main') {
    kit.log.warn('Ты на main. PR делается с feature-ветки, не с main.');
    return;
  }

  if (!(await hasUpstream(root, branch))) {
    const push = await kit.confirm(
      `У ветки «${branch}» нет upstream — без push GitHub её не видит. Запушить сейчас?`,
    );
    if (!push) return;
    await gitInherit(root, ['push', '--set-upstream', 'origin', branch]);
  } else {
    // Подтянем свежак, чтобы PR-URL открылся с актуальным diff.
    const ahead = parseTrack(
      (
        await git(root, [
          'for-each-ref',
          '--format=%(upstream:track)',
          `refs/heads/${branch}`,
        ])
      ).trim(),
    ).ahead;
    if (ahead > 0) {
      const push = await kit.confirm(`Локальных коммитов впереди: ${ahead}. Запушить перед PR?`);
      if (push) await gitInherit(root, ['push']);
    }
  }

  const originUrl = (await git(root, ['remote', 'get-url', 'origin'])).trim();
  const repo = parseOriginRepo(originUrl);
  if (!repo) {
    kit.log.error(`Не разобрал origin URL: ${originUrl}`);
    return;
  }

  // Попробовать gh CLI — если есть, лучше создать PR через него.
  try {
    await execa('gh', ['--version'], { cwd: root });
    const useGh = await kit.confirm('Создать PR через gh CLI (без браузера)?');
    if (useGh) {
      await execa('gh', ['pr', 'create', '--fill', '--web'], { cwd: root, stdio: 'inherit' });
      return;
    }
  } catch {
    // gh не установлен — fallback на URL.
  }

  const url = `https://github.com/${repo.owner}/${repo.repo}/compare/main...${encodeURIComponent(branch)}?expand=1`;
  kit.note(url, '🔗 Open PR');

  // Кросс-платформенный «открой в браузере».
  const opener =
    process.platform === 'win32' ? 'start' : process.platform === 'darwin' ? 'open' : 'xdg-open';
  try {
    await execa(opener, [url], { cwd: root, shell: process.platform === 'win32' });
  } catch {
    kit.log.info('Не удалось открыть браузер автоматом — скопируй URL выше.');
  }
};
