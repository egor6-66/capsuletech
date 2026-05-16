#!/usr/bin/env node
/* ============================================================================
 * scripts/release.mjs
 * ---------------------------------------------------------------------------
 * PURPOSE
 *   PROD-релиз группы пакетов во внешний реестр (npmjs / nexus / corporate).
 *   Стандартный nx release flow: bump версий → CHANGELOG → git commit → tag
 *   → publish. Push в remote — отдельным шагом руками или из CI.
 *
 * USAGE
 *   pnpm release:prod:cli -- --registry=https://registry.npmjs.org
 *   pnpm release:prod:web -- --registry=https://nexus.company.com/repo/npm/
 *   pnpm release:prod:cli -- minor --registry=https://registry.npmjs.org
 *   node scripts/release.mjs --group=cli --registry=<url>
 *
 * FLAGS
 *   --group=<name>       group из nx.json release.groups (cli|web_base) — обязательный
 *   --registry=<url>     внешний registry — обязательный
 *   --first-release      первый релиз группы (нет предыдущего git tag)
 *   --dry-run            прокинуть в nx release без реальных изменений
 *
 * POSITIONAL
 *   patch | minor | major | prerelease | <semver> — specifier для bump'а.
 *   Если не указан — bump по conventional-commits с последнего тега группы.
 *
 * ENV
 *   NPM_AUTH_TOKEN — bearer-token для --registry. Пишется во временный
 *     .npmrc на время publish, очищается в finally + on SIGINT.
 *
 * WHAT IT DOES
 *   1. pnpm -r build (две фазы, shared-vite сначала).
 *   2. `nx release <specifier> --group=<g> --skip-publish` → bump+changelog+commit+tag
 *      по nx.json: release.git.commit=true, tag=true, push=false.
 *   3. `nx release publish --group=<g> --registry=<url>`.
 *
 * NOT FOR
 *   - Локальная отладка в verdaccio без следов в git → release-local.mjs.
 *   - Push коммитов/тегов в origin — это вручную или CI после ревью.
 * ==========================================================================*/
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const rawArgs = process.argv.slice(2);
const positional = rawArgs.filter((a) => !a.startsWith('--'));
const args = new Map(
  rawArgs
    .filter((a) => a.startsWith('--'))
    .map((a) => {
      const [k, v] = a.replace(/^--/, '').split('=');
      return [k, v ?? true];
    }),
);

const groupArg = args.get('group');
const registryArg = args.get('registry');

if (!groupArg || groupArg === true) {
  console.error('[release] требуется --group=<name>. См. nx.json release.groups');
  process.exit(1);
}
if (!registryArg || registryArg === true) {
  console.error('[release] требуется --registry=<url>');
  console.error('  Пример: --registry=https://registry.npmjs.org');
  process.exit(1);
}

const registry = String(registryArg);
const groupFlag = ['--group', String(groupArg)];
const firstRelease = args.has('first-release') ? ['--first-release'] : [];
const dryRun = args.has('dry-run') ? ['--dry-run'] : [];

const run = (cmd) => {
  console.log(`\x1b[36m[release]\x1b[0m pnpm ${cmd.join(' ')}`);
  const r = spawnSync('pnpm', cmd, { stdio: 'inherit', shell: process.platform === 'win32' });
  return r.status ?? 1;
};

// Auth setup: NPM_AUTH_TOKEN → временный .npmrc, чистится по exit/SIGINT.
const setupAuth = () => {
  const token = process.env.NPM_AUTH_TOKEN;
  if (!token) return { cleanup: () => {} };

  const url = new URL(registry);
  const base = `//${url.host}${url.pathname.replace(/\/?$/, '/')}`;
  const npmrcPath = resolve('.npmrc');
  const backup = existsSync(npmrcPath) ? readFileSync(npmrcPath, 'utf8') : null;
  writeFileSync(npmrcPath, `${backup ?? ''}\n# release temp auth\n${base}:_authToken=${token}\n`);
  console.log(`\x1b[36m[release]\x1b[0m auth для ${url.host} → .npmrc`);

  const cleanup = () => {
    try {
      if (backup === null) unlinkSync(npmrcPath);
      else writeFileSync(npmrcPath, backup);
    } catch (e) {
      console.warn(`[release] не удалось восстановить .npmrc: ${e.message}`);
    }
  };
  process.on('exit', cleanup);
  process.on('SIGINT', () => { cleanup(); process.exit(130); });
  return { cleanup };
};

// Build (две фазы: shared-vite сначала, остальное потом).
const phases = [
  { name: 'shared-vite', filters: ['--filter', '@capsule/shared-vite'] },
  {
    name: 'shared-* (rest) + web-* + cli',
    filters: [
      '--filter', '@capsule/shared-*',
      '--filter', '!@capsule/shared-biome',
      '--filter', '!@capsule/shared-vite',
      '--filter', '@capsule/web-*',
      '--filter', '@capsule/cli',
    ],
  },
];
for (const phase of phases) {
  console.log(`\x1b[36m[release]\x1b[0m build phase: ${phase.name}`);
  const code = run(['-r', '--workspace-concurrency=4', ...phase.filters, 'run', 'build']);
  if (code !== 0) {
    console.error(`[release] build phase "${phase.name}" упала — публикация отменена`);
    process.exit(code);
  }
}

// nx release <specifier> --skip-publish → bump+changelog+commit+tag (по nx.json).
const versionStatus = run([
  'nx', 'release',
  ...positional,
  ...groupFlag,
  ...firstRelease,
  ...dryRun,
  '--skip-publish',
  '--verbose',
]);
if (versionStatus !== 0) process.exit(versionStatus);

// nx release publish --registry=<url>.
const auth = setupAuth();
let publishStatus = 1;
try {
  publishStatus = run([
    'nx', 'release', 'publish',
    ...groupFlag,
    ...firstRelease,
    ...dryRun,
    '--registry', registry,
    '--verbose',
  ]);
} finally {
  auth.cleanup();
}
process.exit(publishStatus);
