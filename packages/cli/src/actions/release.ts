import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { execa } from 'execa';
import type { CommandAction } from '../commands/types';
import { kit } from '../kit';

/**
 * Группы из nx.json → release.groups.
 * Если nx.json меняется — поправь и здесь.
 */
const GROUPS: Array<{ value: string; label: string; hint: string }> = [
  {
    value: 'cli',
    label: 'cli',
    hint: '@capsuletech/cli + shared-{file-manager, vite, compliance}',
  },
  { value: 'web_base', label: 'web_base', hint: '@capsuletech/web-* + shared-zod' },
  { value: 'all', label: 'all', hint: 'обе группы за один заход' },
];

const SPECIFIERS: Array<{ value: string; label: string; hint: string }> = [
  {
    value: '',
    label: 'auto',
    hint: 'по conventional-commits с прошлого тега (feat → minor, fix → patch, BREAKING → major)',
  },
  { value: 'patch', label: 'patch', hint: '1.2.3 → 1.2.4 (багфикс)' },
  { value: 'minor', label: 'minor', hint: '1.2.3 → 1.3.0 (новая фича)' },
  { value: 'major', label: 'major', hint: '1.2.3 → 2.0.0 (breaking change)' },
  { value: 'prerelease', label: 'prerelease', hint: '1.2.3 → 1.2.4-0 (alpha/beta-итерация)' },
];

const MODES: Array<{ value: string; label: string; hint: string }> = [
  {
    value: 'dry',
    label: '🔍 preview (dry-run)',
    hint: 'показать что бампнется, БЕЗ изменений и публикации',
  },
  {
    value: 'dev',
    label: '🧪 dev (verdaccio)',
    hint: 'локальный registry на :4873 — для проверки публикации',
  },
  {
    value: 'prod',
    label: '🚀 prod',
    hint: 'настоящий публичный/корпоративный registry — требует подтверждения',
  },
];

const releaseScriptPath = (root: string): string => resolve(root, 'scripts/release.mjs');

const ensureScriptExists = (root: string): boolean => {
  if (existsSync(releaseScriptPath(root))) return true;
  kit.log.error(
    'Не нашёл scripts/release.mjs — релизы привязаны к нему. Восстанови файл или скорректируй CLI.',
  );
  return false;
};

const runRelease = async (
  root: string,
  args: string[],
  { stdio = 'inherit' }: { stdio?: 'inherit' | 'pipe' } = {},
): Promise<number> => {
  try {
    const r = await execa('node', ['scripts/release.mjs', ...args], { cwd: root, stdio });
    return r.exitCode ?? 0;
  } catch (e: unknown) {
    const exitCode =
      typeof e === 'object' && e !== null && 'exitCode' in e
        ? (e as { exitCode?: number }).exitCode
        : 1;
    return exitCode ?? 1;
  }
};

/** capsule release plan — предпросмотр бампа без публикации. */
export const releasePlan: CommandAction = async (ctx) => {
  if (!ctx.root) return;
  if (!ensureScriptExists(ctx.root)) return;

  const group = await kit.select<string>('Группа для предпросмотра:', GROUPS);
  if (!group) return;

  const args = ['--dry-run'];
  if (group !== 'all') args.push(`--group=${group}`);

  kit.note(`node scripts/release.mjs ${args.join(' ')}`, '🔍 Dry-run');
  await runRelease(ctx.root, args);
};

/** capsule release — интерактивный релизный мастер. */
export const release: CommandAction = async (ctx) => {
  if (!ctx.root) return;
  if (!ensureScriptExists(ctx.root)) return;

  const dirty = (await execa('git', ['status', '--porcelain'], { cwd: ctx.root })).stdout.trim();
  if (dirty) {
    kit.log.warn('Рабочее дерево грязное — релизить нельзя. Сначала commit/stash.');
    kit.note(dirty, '📋 Незакоммиченное');
    return;
  }

  const { stdout: branch } = await execa('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
    cwd: ctx.root,
  });
  if (branch.trim() !== 'main') {
    const ok = await kit.confirm(
      `Сейчас на ветке «${branch.trim()}», а релизы обычно делают с main. Продолжить всё равно?`,
    );
    if (!ok) return;
  }

  const group = await kit.select<string>('Группа:', GROUPS);
  if (!group) return;

  const specifier = await kit.select<string>('Бамп версии:', SPECIFIERS);
  if (specifier === null || specifier === undefined) return;

  const mode = await kit.select<string>('Режим:', MODES);
  if (!mode) return;

  let registry: string | undefined;
  if (mode === 'prod') {
    const url = (await kit.input(
      'Registry URL (обязателен для prod):',
      'https://registry.npmjs.org',
    )) as string;
    if (!url?.trim()) {
      kit.log.error('Registry URL обязателен в prod-режиме.');
      return;
    }
    registry = url.trim();
  }

  const isFirst = await kit.confirm('Это ПЕРВЫЙ релиз группы (нет существующих git-тегов)?');

  const args: string[] = [];
  if (specifier) args.push(specifier);
  if (group !== 'all') args.push(`--group=${group}`);
  if (mode === 'dry') args.push('--dry-run');
  if (mode === 'prod') args.push('--mode=prod', `--registry=${registry}`);
  if (isFirst) args.push('--first-release');

  const summary = [
    `Группа:     ${group}`,
    `Бамп:       ${specifier || 'auto (по коммитам)'}`,
    `Режим:      ${mode === 'dry' ? 'dry-run' : mode === 'prod' ? `prod → ${registry}` : 'dev → verdaccio (localhost:4873)'}`,
    `First:      ${isFirst ? 'yes' : 'no'}`,
    '',
    `node scripts/release.mjs ${args.join(' ')}`,
  ].join('\n');
  kit.note(summary, '📦 Релиз');

  const confirmMessage =
    mode === 'prod' ? `ВНИМАНИЕ: prod-публикация в ${registry}. Подтвердить?` : 'Запустить релиз?';
  const ok = await kit.confirm(confirmMessage);
  if (!ok) return;

  const code = await runRelease(ctx.root, args);
  if (code !== 0) {
    kit.log.error(`Релиз завершился с кодом ${code}.`);
    return;
  }

  if (mode !== 'dry') {
    const pushTags = await kit.confirm('Запушить теги и main на origin (git push --follow-tags)?');
    if (pushTags) {
      await execa('git', ['push', '--follow-tags'], { cwd: ctx.root, stdio: 'inherit' });
    } else {
      kit.log.info('Теги не запушены. Когда соберёшься: git push origin main --follow-tags');
    }
  }
};
