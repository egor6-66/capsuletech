#!/usr/bin/env node
/* ============================================================================
 * scripts/release-local.mjs
 * ---------------------------------------------------------------------------
 * PURPOSE
 *   Локальный (dev) релиз группы пакетов в локальный Verdaccio.
 *   ZERO следов в git/worktree: package.json не бампается, коммитов и тегов
 *   нет, ничего не пушится. Используется для проверок workflow без шума.
 *
 * USAGE
 *   pnpm release:local:cli                       # группа cli из nx.json
 *   pnpm release:local:web                       # группа web_base из nx.json
 *   pnpm release:local:all                       # обе группы подряд
 *   node scripts/release-local.mjs --group=cli   # ручной вызов
 *
 * FLAGS
 *   --group=<name>     имя группы из nx.json release.groups (cli|web_base|all)
 *   --registry=<url>   override локального verdaccio (default http://localhost:4873)
 *   --no-build         пропустить pnpm build (использовать существующий dist/)
 *
 * WHAT IT DOES
 *   1. Читает release.groups из nx.json → список пакетов группы.
 *   2. Находит их package.json в packages/** (по полю "name").
 *   3. Snapshot всех package.json → in-memory. Бампит version в `<curr>-dev.<ts>`
 *      и переписывает workspace:* deps на актуальные dev-версии соседей.
 *      Уникальный timestamp обходит verdaccio version-immutable.
 *   4. Билдит пакеты через pnpm -r (три фазы: compliance → vite → rest).
 *   5. `pnpm publish` каждого с dev-версией. workspace:* мы уже переписали
 *      явно — в tarball уходят точные версии.
 *   6. Restore package.json из snapshot (через exit/SIGINT hooks) →
 *      worktree чистый, в git ничего не уйдёт.
 *
 * WHEN TO USE
 *   - Когда нужно протестировать `npm install @capsuletech/cli` из локального
 *     verdaccio без коммита release-меток в git.
 *   - При отладке templates / postinstall / TUI пользовательского flow.
 *
 * NOT FOR
 *   - Публикация в npmjs / nexus / любой внешний registry — это release.mjs.
 *   - Bump версий и changelog — это release.mjs (prod).
 * ==========================================================================*/
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

const args = new Map(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  }),
);

const REGISTRY =
  args.get('registry') && args.get('registry') !== true
    ? String(args.get('registry'))
    : process.env.NPM_REGISTRY_VERDACCIO || 'http://localhost:4873';
const TAG = args.get('tag') && args.get('tag') !== true ? String(args.get('tag')) : 'local';
const SHOULD_BUILD = !args.has('no-build');
const GROUP = args.get('group');

if (!GROUP || GROUP === true) {
  console.error('[release-local] требуется --group=<name>. См. nx.json release.groups');
  process.exit(1);
}

const log = (m) => console.log(`\x1b[36m[release-local]\x1b[0m ${m}`);
const warn = (m) => console.warn(`\x1b[33m[release-local]\x1b[0m ${m}`);
const fail = (m) => {
  console.error(`\x1b[31m[release-local]\x1b[0m ${m}`);
  process.exit(1);
};

// ---------------------------------------------------------------------------
// 1. Группы из nx.json
// ---------------------------------------------------------------------------
const nxJson = JSON.parse(readFileSync(join(repoRoot, 'nx.json'), 'utf8'));
const allGroups = nxJson.release?.groups ?? {};
const resolveGroupNames = (g) => {
  if (g === 'all') return Object.keys(allGroups);
  if (!allGroups[g])
    fail(
      `Группа "${g}" не найдена в nx.json. Доступно: ${Object.keys(allGroups).join(', ')} или all`,
    );
  return [g];
};
const targetGroupNames = resolveGroupNames(GROUP);
const targetPackages = new Set(targetGroupNames.flatMap((name) => allGroups[name].projects ?? []));
log(`Группы: ${targetGroupNames.join(', ')} → пакетов: ${targetPackages.size}`);

// ---------------------------------------------------------------------------
// 2. Найти package.json по имени в packages/**
// ---------------------------------------------------------------------------
const findCapsulePackages = (root) => {
  const found = new Map(); // pkg.name -> { dir, pkgPath, pkg }
  const SKIP = new Set(['node_modules', 'dist', '.git', '.nx', 'tmp']);
  const walk = (dir) => {
    const pkgPath = join(dir, 'package.json');
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
        if (typeof pkg.name === 'string') found.set(pkg.name, { dir, pkgPath, pkg });
      } catch {}
    }
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.isDirectory() && !SKIP.has(e.name)) walk(join(dir, e.name));
    }
  };
  walk(root);
  return found;
};

const all = findCapsulePackages(join(repoRoot, 'packages'));
const toPublish = [];
for (const name of targetPackages) {
  const hit = all.get(name);
  if (!hit) {
    warn(`Пакет "${name}" из группы не найден в packages/** — пропускаю`);
    continue;
  }
  if (hit.pkg.private) {
    warn(`Пакет "${name}" private — пропускаю`);
    continue;
  }
  toPublish.push(hit);
}
if (toPublish.length === 0) fail('Нечего публиковать — список пакетов пуст');
log(`К публикации: ${toPublish.map((p) => `${p.pkg.name}@${p.pkg.version}`).join(', ')}`);

// ---------------------------------------------------------------------------
// 3. Bump в `-dev.<timestamp>` суффикс + snapshot для отката.
//    Verdaccio запрещает overwrite published version (allow_replace игнорится
//    в 6.x), npm unpublish не сбрасывает in-memory state. Уникальная
//    -dev.<ts> версия — единственный надёжный способ. Восстановим
//    package.json в finally, чтобы в worktree не осталось следов.
// ---------------------------------------------------------------------------
const ts = new Date()
  .toISOString()
  .replace(/[-:T.Z]/g, '')
  .slice(0, 14);

// Снапшот ВСЕХ найденных пакетов (не только toPublish), чтобы при rewrite
// workspace:* deps правильно подставить новые -dev версии соседей.
const snapshot = new Map(); // pkgPath -> raw text
for (const { pkgPath } of all.values()) {
  snapshot.set(pkgPath, readFileSync(pkgPath, 'utf8'));
}

let _restored = false;
const restore = () => {
  if (_restored) return;
  _restored = true;
  for (const [path, raw] of snapshot) {
    try {
      writeFileSync(path, raw);
    } catch {}
  }
};
process.on('exit', restore);
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGBREAK']) {
  process.on(sig, () => {
    restore();
    process.exit(130);
  });
}
process.on('uncaughtException', (e) => {
  restore();
  console.error(e);
  process.exit(1);
});

// Новые dev-версии: <текущая без -dev.*> + -dev.<ts>
const newVersions = new Map(); // pkgName -> newVersion
for (const { pkg } of toPublish) {
  const base = (pkg.version || '0.0.1').replace(/-.*$/, '');
  newVersions.set(pkg.name, `${base}-dev.${ts}`);
}

const DEP_FIELDS = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];
const rewritePkgJson = ({ pkgPath, pkg }) => {
  const newVer = newVersions.get(pkg.name);
  if (newVer) pkg.version = newVer;
  // Заменяем workspace:* на актуальную dev-версию соседа из той же группы,
  // либо на текущую публичную (для пакетов вне toPublish).
  for (const field of DEP_FIELDS) {
    const deps = pkg[field];
    if (!deps) continue;
    for (const [name, range] of Object.entries(deps)) {
      if (typeof range === 'string' && range.startsWith('workspace:')) {
        const devVer = newVersions.get(name);
        if (devVer) deps[name] = devVer;
        else {
          const neighbor = all.get(name);
          if (neighbor) deps[name] = neighbor.pkg.version;
        }
      }
    }
  }
  writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
};
for (const entry of toPublish) rewritePkgJson(entry);
log(`bumped versions: ${[...newVersions.entries()].map(([n, v]) => `${n}@${v}`).join(', ')}`);

// ---------------------------------------------------------------------------
// 4. Билд (две фазы, shared-vite первым — у него нет рантайм-зависимости на
//    чужой dist, а остальные packages его dist реально дёргают через libConfig)
// ---------------------------------------------------------------------------
const run = (cmd, opts = {}) => {
  log(`> pnpm ${cmd.join(' ')}`);
  const r = spawnSync('pnpm', cmd, {
    cwd: repoRoot,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    ...opts,
  });
  return r.status ?? 1;
};

if (SHOULD_BUILD) {
  // 3 фазы строго последовательно: compliance → vite → rest.
  // pnpm не блокирует параллельные билды по topological order — на свежем CI
  // shared-vite стартует одновременно с shared-compliance и падает на резолве
  // compliance/main (dist ещё не создан).
  const phases = [
    { name: 'shared-compliance', filters: ['--filter', '@capsuletech/compliance'] },
    { name: 'shared-vite', filters: ['--filter', '@capsuletech/vite-builder'] },
    {
      name: 'shared-* (rest) + web-* + cli',
      filters: [
        '--filter',
        '@capsuletech/shared-*',
        '--filter',
        '!@capsuletech/compliance',
        '--filter',
        '!@capsuletech/biome-config',
        '--filter',
        '!@capsuletech/vite-builder',
        '--filter',
        '@capsuletech/web-*',
        '--filter',
        '@capsuletech/cli',
      ],
    },
  ];
  for (const phase of phases) {
    log(`build phase: ${phase.name}`);
    const code = run(['-r', '--workspace-concurrency=4', ...phase.filters, 'run', 'build']);
    if (code !== 0) fail(`build phase "${phase.name}" упала — публикация отменена`);
  }
} else {
  warn('--no-build: использую существующий dist/');
}

// ---------------------------------------------------------------------------
// 5. Publish в verdaccio. Версия берётся из package.json как есть.
//    workspace:* deps pnpm подставит в tarball автоматически — исходник не
//    модифицируется (pnpm применяет замену только при упаковке).
// ---------------------------------------------------------------------------
let failures = 0;
for (const { dir, pkg } of toPublish) {
  log(`publish ${pkg.name}@${pkg.version} → ${REGISTRY}`);
  const r = spawnSync(
    'pnpm',
    ['publish', '--no-git-checks', '--registry', REGISTRY, '--tag', TAG],
    {
      cwd: dir,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    },
  );
  if ((r.status ?? 1) !== 0) {
    failures++;
    warn(`✖ ${pkg.name}`);
  }
}

if (failures > 0)
  fail(`Завершено с ошибками: ${failures}/${toPublish.length} пакетов не опубликовано`);
log(`✓ Готово. Опубликовано ${toPublish.length} пакетов в ${REGISTRY} (tag=${TAG}).`);
