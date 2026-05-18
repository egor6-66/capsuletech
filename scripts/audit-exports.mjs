#!/usr/bin/env node
/**
 * audit-exports.mjs
 * ─────────────────
 * Прогон `publint` + `@arethetypeswrong/cli` по всем publishable пакетам
 * монорепо. Запускается перед релизом — ловит рассинхрон между `package.json:
 * exports`, реальным `dist/`-layout и `.d.ts` declarations.
 *
 * Поводы возникновения:
 *  - Поменялся entry или layout сборки → exports field остался старым.
 *  - `shared-lib-config` поменял output naming → у части пакетов битый types.
 *  - `.d.ts` импорт без `.js`-расширения → node16-esm не резолвит, bundler OK.
 *
 * Запуск:  pnpm audit:exports         — все пакеты
 *          pnpm audit:exports web-core — только match'ащиеся по подстроке
 *
 * Поведение:
 *  1. Находим publishable @capsuletech/* пакеты (не private, есть `dist/`).
 *  2. Для каждого: `pnpm pack` → `attw <tarball>` + `publint <pkg-dir>`.
 *  3. Печатаем компактный summary, exit code = 1 если у любого критическая
 *     проблема (publint error, attw 💀).
 */
import { execSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(process.cwd());
const ARG_FILTER = process.argv[2] ?? '';

const findPackages = (dir) => {
  const out = [];
  const walk = (d) => {
    if (!existsSync(d)) return;
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      if (entry.name === 'node_modules' || entry.name === 'dist') continue;
      const sub = join(d, entry.name);
      const pkgPath = join(sub, 'package.json');
      if (existsSync(pkgPath)) {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
        if (pkg.private) continue;
        if (!pkg.name?.startsWith('@capsuletech/')) continue;
        out.push({ name: pkg.name, dir: sub, version: pkg.version });
        continue;
      }
      walk(sub);
    }
  };
  walk(dir);
  return out;
};

const all = findPackages(join(ROOT, 'packages'));
const targets = ARG_FILTER
  ? all.filter((p) => p.name.includes(ARG_FILTER) || p.dir.includes(ARG_FILTER))
  : all;

if (targets.length === 0) {
  console.error(`No publishable packages matched filter "${ARG_FILTER}".`);
  process.exit(1);
}

console.log(
  `Auditing ${targets.length} package(s):\n${targets.map((p) => `  - ${p.name}`).join('\n')}\n`,
);

let hadCritical = false;

const run = (cmd, cwd) => {
  try {
    const out = execSync(cmd, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { ok: true, output: out };
  } catch (e) {
    return { ok: false, output: `${e.stdout ?? ''}${e.stderr ?? ''}` || e.message };
  }
};

for (const pkg of targets) {
  console.log(`\n══ ${pkg.name}@${pkg.version} ══`);

  // Config-only пакеты (биом-конфиг и т.п.) не имеют build-step. Если в
  // package.json нет `scripts.build` — это нормально, пропускаем.
  const pkgJson = JSON.parse(readFileSync(join(pkg.dir, 'package.json'), 'utf8'));
  const hasBuildScript = Boolean(pkgJson.scripts?.build);

  if (!existsSync(join(pkg.dir, 'dist'))) {
    if (!hasBuildScript) {
      console.log('  ⚪ skip — config-only package (no build script)');
      continue;
    }
    console.log('  ⚠ dist/ missing — run `pnpm --filter ' + pkg.name + ' build` first');
    hadCritical = true;
    continue;
  }

  // publint — без --strict (warnings ≠ блокер). Полный output печатаем,
  // если есть хоть что-то.
  const publint = run(`pnpm exec publint`, pkg.dir);
  const ANSI_RE = new RegExp(String.fromCharCode(27) + '[[0-9;]*m', 'g');
  const stripAnsi = (s) => s.replace(ANSI_RE, '');
  const clean = stripAnsi(publint.output);
  const hasErrors = /^Errors:/m.test(clean);
  const hasWarnings = /^Warnings:/m.test(clean);
  console.log(
    '  publint:',
    hasErrors ? '❌ errors' : hasWarnings ? '⚠ warnings (non-blocking)' : '✅ clean',
  );
  if (hasErrors || hasWarnings) {
    const body = clean
      .split('\n')
      .filter((l) => l.trim())
      .map((l) => '    ' + l)
      .join('\n');
    console.log(body);
  }
  if (hasErrors) hadCritical = true;

  // attw — pack first
  const packResult = run('pnpm pack --silent', pkg.dir);
  if (!packResult.ok) {
    console.log('  attw: ❌ pnpm pack failed');
    hadCritical = true;
    continue;
  }
  const tgz = readdirSync(pkg.dir).find((f) => f.endsWith('.tgz'));
  if (!tgz) {
    console.log('  attw: ❌ no .tgz produced');
    hadCritical = true;
    continue;
  }
  try {
    // -f json: стабильный машинный формат. Текстовый output меняется между
    // версиями attw (раньше был list, теперь table), парсить ASCII-таблицу —
    // источник ложных срабатываний (см. историю с lib-builder).
    const attw = run(`pnpm exec attw -f json ${tgz}`, pkg.dir);
    let bundlerOk = false;
    let hasNonBundlerProblems = false;
    let parseError = null;
    try {
      const data = JSON.parse(attw.output);
      const entrypoints = data?.analysis?.entrypoints ?? {};
      // CSS-only subpath'ы (target = '*.css' или '*.css/*') не имеют types и
      // не должны попадать в attw-проверку: bundler знает что .css — assets.
      // Эвристика: смотрим в package.json exports, target в виде строки или
      // в "default" заканчивается на `.css`.
      const isCssEntry = (subpath) => {
        const e = pkgJson.exports?.[subpath];
        if (!e) return false;
        const target = typeof e === 'string' ? e : e.default;
        return typeof target === 'string' && /\.css(\/|$|\*)/.test(target);
      };
      // bundler-резолюция должна быть успешной для каждого NON-CSS subpath.
      bundlerOk = Object.entries(entrypoints).every(([sub, ep]) => {
        if (isCssEntry(sub)) return true;
        const r = ep?.resolutions?.bundler;
        return r && (!r.visibleProblems || r.visibleProblems.length === 0);
      });
      // Non-bundler problems = проблемы в node10/node16-cjs/node16-esm.
      // Сейчас не блокируют (Vite-only консьюмеры), но флагнём для будущего публичного релиза.
      hasNonBundlerProblems = Object.values(entrypoints).some((ep) => {
        const res = ep?.resolutions ?? {};
        return Object.entries(res).some(
          ([kind, r]) => kind !== 'bundler' && r?.visibleProblems?.length > 0,
        );
      });
    } catch (e) {
      parseError = e;
    }
    if (parseError) {
      console.log('  attw: ❌ JSON parse failed:', parseError.message);
      hadCritical = true;
    } else {
      console.log('  attw bundler:', bundlerOk ? '✅' : '❌');
      if (!bundlerOk) hadCritical = true;
      if (hasNonBundlerProblems) {
        console.log(
          '    (node16/node10 has problems — non-blocking for Vite, but flag for future)',
        );
      }
    }
  } finally {
    rmSync(join(pkg.dir, tgz), { force: true });
  }
}

console.log(
  hadCritical
    ? '\n❌ Audit failed — critical issues for bundler consumers.\n'
    : '\n✅ Audit passed for bundler consumers.\n',
);
process.exit(hadCritical ? 1 : 0);
