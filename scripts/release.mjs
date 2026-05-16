#!/usr/bin/env node
/* ============================================================================
 * scripts/release.mjs
 * ---------------------------------------------------------------------------
 * PURPOSE
 *   PROD-релиз группы пакетов во внешний реестр. Вызывается ИЗ CI
 *   (GitHub Actions / GitLab CI), не локально — см. .github/workflows/release.yml
 *   и .gitlab-ci.yml. Стандартный nx release flow:
 *   bump версий → CHANGELOG → git commit → tag → publish → git push.
 *
 * USAGE (CI only)
 *   node scripts/release.mjs --group=cli --registry=npm
 *   node scripts/release.mjs --group=cli --registry=github minor
 *   node scripts/release.mjs --group=web_base --registry=gitlab --first-release
 *
 * FLAGS
 *   --group=<name|all>   group из nx.json release.groups (или all) — обязательный
 *   --registry=<key|url> npm (default) | nexus | github | gitlab | <full-url>
 *   --first-release      первый релиз группы (нет предыдущего git tag)
 *   --dry-run            прокинуть в nx release без реальных изменений
 *   --no-push            не пушить коммит и теги после публикации (для отладки)
 *
 * POSITIONAL
 *   patch | minor | major | prerelease | <semver> — specifier для bump'а.
 *   Если не указан — bump по conventional-commits с последнего тега группы.
 *
 * REGISTRY KEYS
 *   npm        → NPM_REGISTRY_NPM env (default https://registry.npmjs.org)
 *   nexus      → NEXUS_REGISTRY env (обязательно)
 *   github     → https://npm.pkg.github.com (GitHub Packages)
 *   gitlab     → GITLAB_REGISTRY env (обязательно, типа https://gitlab.com/api/v4/projects/<id>/packages/npm/)
 *   <url>      → используется как есть
 *
 * AUTH ENV
 *   NPM_TOKEN                          → bearer-token для npm
 *   NEXUS_TOKEN                        → bearer-token для nexus (приоритетно)
 *   NEXUS_USERNAME + NEXUS_PASSWORD    → basic-auth fallback для nexus
 *   GITHUB_TOKEN                       → bearer-token для GitHub Packages (в Actions встроенный)
 *   GITLAB_TOKEN                       → bearer-token для GitLab (CI_JOB_TOKEN или PAT с write:packages)
 *   Записывается во временный .npmrc, очищается в finally + on SIGINT.
 *
 * WHAT IT DOES
 *   1. pnpm -r build (две фазы, shared-vite сначала).
 *   2. `nx release <specifier> --group=<g> --skip-publish` → bump+changelog+commit+tag
 *      по nx.json: release.git.commit=true, tag=true, push=false.
 *   3. `nx release publish --group=<g> --registry=<url>`.
 *   4. `git push --follow-tags` — публикует коммит + теги в origin (если не --no-push).
 *
 * NOT FOR
 *   - Локальный запуск с лэптопа — для этого release-local.mjs (verdaccio).
 *   - Изменение релизного флоу — это nx.json release.* конфиг.
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

const REGISTRIES = {
  npm: process.env.NPM_REGISTRY_NPM || 'https://registry.npmjs.org',
  nexus: process.env.NEXUS_REGISTRY,
  github: 'https://npm.pkg.github.com',
  gitlab: process.env.GITLAB_REGISTRY,
};
const registryKey = !registryArg || registryArg === true ? 'npm' : String(registryArg);
const registry = REGISTRIES[registryKey] ?? registryKey; // если не известный ключ — трактуем как URL
if (registryKey === 'nexus' && !registry) {
  console.error('[release] --registry=nexus, но NEXUS_REGISTRY env не задана');
  process.exit(1);
}
if (registryKey === 'gitlab' && !registry) {
  console.error('[release] --registry=gitlab, но GITLAB_REGISTRY env не задана');
  console.error('  Пример: GITLAB_REGISTRY=https://gitlab.com/api/v4/projects/<id>/packages/npm/');
  process.exit(1);
}

const groupFlag = ['--group', String(groupArg)];
const firstRelease = args.has('first-release') ? ['--first-release'] : [];
const dryRun = args.has('dry-run') ? ['--dry-run'] : [];
const skipPush = args.has('no-push') || args.has('dry-run');

const run = (cmd) => {
  console.log(`\x1b[36m[release]\x1b[0m pnpm ${cmd.join(' ')}`);
  const r = spawnSync('pnpm', cmd, { stdio: 'inherit', shell: process.platform === 'win32' });
  return r.status ?? 1;
};

// Scope для override @capsuletech:registry в .npmrc — у corner-case'а высокий
// приоритет: если корневой .npmrc проекта (используется для dev в verdaccio)
// содержит `@capsuletech:registry=http://localhost:4873/`, npm/pnpm берут эту
// строку для scoped пакетов И ИГНОРИРУЮТ `--registry` флаг при publish.
// Поэтому дописываем правильный scope в конец .npmrc на время publish
// (last-wins внутри одного файла) и восстанавливаем в cleanup.
const SCOPE = '@capsuletech';

// Auth setup: пишем во временный .npmrc, чистится по exit/SIGINT.
//   nexus:  NEXUS_TOKEN (предпочтительно) или NEXUS_USERNAME+PASSWORD
//   npm:    NPM_TOKEN
//   github: GITHUB_TOKEN
//   gitlab: GITLAB_TOKEN
//   url:    нет auth (явный URL — конфиг через .npmrc внешне)
const setupAuth = () => {
  let token, username, password;
  if (registryKey === 'nexus') {
    token = process.env.NEXUS_TOKEN;
    username = process.env.NEXUS_USERNAME;
    password = process.env.NEXUS_PASSWORD;
  } else if (registryKey === 'npm') {
    token = process.env.NPM_TOKEN;
  } else if (registryKey === 'github') {
    token = process.env.GITHUB_TOKEN;
  } else if (registryKey === 'gitlab') {
    token = process.env.GITLAB_TOKEN;
  }

  const url = new URL(registry);
  const base = `//${url.host}${url.pathname.replace(/\/?$/, '/')}`;
  // Override scope-registry всегда (даже без token) — иначе корневой .npmrc
  // с verdaccio-строкой ломает publish во внешний реестр.
  const lines = [`${SCOPE}:registry=${registry}`];
  if (token) {
    lines.push(`${base}:_authToken=${token}`);
  } else if (username && password) {
    lines.push(
      `${base}:_auth=${Buffer.from(`${username}:${password}`).toString('base64')}`,
      `${base}:always-auth=true`,
    );
  }

  const npmrcPath = resolve('.npmrc');
  const backup = existsSync(npmrcPath) ? readFileSync(npmrcPath, 'utf8') : null;
  writeFileSync(
    npmrcPath,
    `${backup ?? ''}\n# release temp auth (registry=${registryKey})\n${lines.join('\n')}\n`,
  );
  console.log(`\x1b[36m[release]\x1b[0m ${SCOPE}:registry → ${url.host} (auth=${token ? 'token' : username ? 'basic' : 'none'})`);

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

// Build phases (3 шт., строго последовательно — pnpm `...<pkg>...` фильтр
// и `-r run` сами по себе НЕ гарантируют topological blocking, и параллельный
// concurrency=4 запускает пакеты одновременно, что ломает resolve на чистом CI):
//   0. shared-compliance — vite.config из ../vite/src/defines/libConfig.ts
//      (импортит src, не dist — поэтому compliance собирается без vite/dist).
//   1. shared-vite — его vite.config бандлит compliance внутрь, для чего
//      esbuild externalize-deps плагин резолвит compliance/main → dist/index.mjs.
//      После phase 0 dist уже есть → резолв проходит.
//   2. Все остальные shared-* (кроме compliance/vite/biome) + web-* + cli —
//      используют готовый shared-vite/dist через libConfig.
const phases = [
  { name: 'shared-compliance', filters: ['--filter', '@capsuletech/shared-compliance'] },
  { name: 'shared-vite', filters: ['--filter', '@capsuletech/shared-vite'] },
  {
    name: 'shared-* (rest) + web-* + cli',
    filters: [
      '--filter', '@capsuletech/shared-*',
      '--filter', '!@capsuletech/shared-biome',
      '--filter', '!@capsuletech/shared-vite',
      '--filter', '!@capsuletech/shared-compliance',
      '--filter', '@capsuletech/web-*',
      '--filter', '@capsuletech/cli',
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
if (publishStatus !== 0) process.exit(publishStatus);

// git push --follow-tags. nx.json держит push:false чтобы можно было откатить
// при сбое publish — теперь publish успешен, пушим осознанно. В CI обычно нужно.
if (!skipPush) {
  console.log(`\x1b[36m[release]\x1b[0m git push --follow-tags`);
  const r = spawnSync('git', ['push', '--follow-tags'], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if ((r.status ?? 1) !== 0) {
    console.error('[release] git push провалился — коммит/теги остались локально');
    process.exit(r.status ?? 1);
  }
}
process.exit(0);
