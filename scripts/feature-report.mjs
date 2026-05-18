#!/usr/bin/env node
/* ============================================================================
 * scripts/feature-report.mjs
 * ---------------------------------------------------------------------------
 * PURPOSE
 *   Парсит Claude Code session-логи и считает расход токенов/USD по фиче.
 *
 * USAGE
 *   pnpm report:list                    # перечислить маркеры в текущих логах
 *   pnpm report <feature-slug>          # сгенерить reports/<slug>.md
 *   pnpm report:all                     # все маркированные фичи в reports/
 *
 * MARKERS
 *   Главный assistant ставит в своих текстовых ответах:
 *     <<feature: slug>>                 — старт
 *     <</feature>>                      — конец
 *
 * INPUTS
 *   Логи: ~/.claude/projects/<encoded-cwd>/*.jsonl
 *     - encoded-cwd: путь к репе с заменой '\\' и '/' и ':' на '-'
 *     - один .jsonl на сессию, в каждой строке JSON-event
 *     - assistant turns содержат message.usage:
 *         input_tokens, output_tokens,
 *         cache_creation_input_tokens, cache_read_input_tokens
 *
 * PRICING
 *   USD за миллион токенов, см. константу PRICES ниже. При смене тарифов —
 *   править руками (по состоянию 2026-05).
 * ==========================================================================*/
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, join, resolve } from 'node:path';

const PRICES = {
  // Opus 4.x
  'claude-opus-4': { in: 15, out: 75, cacheWrite: 18.75, cacheRead: 1.5 },
  // Sonnet 4.x
  'claude-sonnet-4': { in: 3, out: 15, cacheWrite: 3.75, cacheRead: 0.3 },
  // Haiku 4.x
  'claude-haiku-4': { in: 0.8, out: 4, cacheWrite: 1.0, cacheRead: 0.08 },
};

const matchModel = (id) => {
  if (!id) return null;
  if (id.includes('opus')) return PRICES['claude-opus-4'];
  if (id.includes('sonnet')) return PRICES['claude-sonnet-4'];
  if (id.includes('haiku')) return PRICES['claude-haiku-4'];
  return null;
};

const encodePath = (p) => p.replace(/[:\\/]/g, '-').replace(/^-+/, '');

const repoRoot = resolve(process.cwd());
const projectsDir = join(homedir(), '.claude', 'projects', encodePath(repoRoot));

if (!existsSync(projectsDir)) {
  console.error(`[report] не найден projects-каталог: ${projectsDir}`);
  process.exit(1);
}

const sessions = readdirSync(projectsDir)
  .filter((f) => f.endsWith('.jsonl'))
  .map((f) => join(projectsDir, f));

/**
 * Парсит все .jsonl и возвращает плоский список turn-events с usage,
 * model, текстом ответа и timestamp.
 */
const collectTurns = () => {
  const turns = [];
  for (const file of sessions) {
    const lines = readFileSync(file, 'utf8').split('\n').filter(Boolean);
    for (const line of lines) {
      let evt;
      try {
        evt = JSON.parse(line);
      } catch {
        continue;
      }
      if (evt.type !== 'assistant' && evt.type !== 'agent_assistant') continue;
      const msg = evt.message || {};
      const usage = msg.usage || {};
      const text = (msg.content || [])
        .filter((c) => c.type === 'text')
        .map((c) => c.text)
        .join('\n');
      const agentCalls = (msg.content || []).filter(
        (c) => c.type === 'tool_use' && c.name === 'Agent',
      ).length;
      turns.push({
        sessionId: basename(file, '.jsonl'),
        ts: evt.timestamp || msg.created_at || null,
        model: msg.model || null,
        isAgent: evt.type === 'agent_assistant' || evt.parent_agent_id != null,
        agentType: evt.subagent_type || null,
        text,
        agentCalls,
        usage: {
          input: usage.input_tokens || 0,
          output: usage.output_tokens || 0,
          cacheWrite: usage.cache_creation_input_tokens || 0,
          cacheRead: usage.cache_read_input_tokens || 0,
        },
      });
    }
  }
  return turns.sort((a, b) => (a.ts || '').localeCompare(b.ts || ''));
};

const FEATURE_START = /<<\s*feature\s*:\s*([a-z0-9_-]+)\s*>>/i;
const FEATURE_END = /<<\s*\/\s*feature\s*>>/i;

/**
 * Сегментирует turns на фичи. Если в одном turn'е и старт и конец — turn попадает в обе.
 * Возвращает Map<slug, { turns, opened, closed }>.
 */
const segmentFeatures = (turns) => {
  const features = new Map();
  let active = null;
  for (const t of turns) {
    const startMatch = t.text.match(FEATURE_START);
    const endMatch = t.text.match(FEATURE_END);
    if (startMatch) {
      const slug = startMatch[1];
      if (!features.has(slug)) features.set(slug, { slug, turns: [], opened: t.ts, closed: null });
      active = slug;
    }
    if (active) {
      features.get(active).turns.push(t);
    }
    if (endMatch && active) {
      features.get(active).closed = t.ts;
      active = null;
    }
  }
  return features;
};

const costOf = (turn) => {
  const p = matchModel(turn.model);
  if (!p) return 0;
  return (
    (turn.usage.input * p.in) / 1e6 +
    (turn.usage.output * p.out) / 1e6 +
    (turn.usage.cacheWrite * p.cacheWrite) / 1e6 +
    (turn.usage.cacheRead * p.cacheRead) / 1e6
  );
};

const buildReport = (feature) => {
  const totals = {
    input: 0,
    output: 0,
    cacheWrite: 0,
    cacheRead: 0,
    cost: 0,
    turns: feature.turns.length,
    mainTurns: 0,
    agentTurns: 0,
    agentInvocations: 0,
  };
  const byAgent = new Map();
  const byModel = new Map();

  for (const t of feature.turns) {
    totals.input += t.usage.input;
    totals.output += t.usage.output;
    totals.cacheWrite += t.usage.cacheWrite;
    totals.cacheRead += t.usage.cacheRead;
    totals.cost += costOf(t);
    totals.agentInvocations += t.agentCalls;
    if (t.isAgent) {
      totals.agentTurns += 1;
      const key = t.agentType || '(unknown agent)';
      const cur = byAgent.get(key) || { turns: 0, cost: 0, output: 0 };
      cur.turns += 1;
      cur.cost += costOf(t);
      cur.output += t.usage.output;
      byAgent.set(key, cur);
    } else {
      totals.mainTurns += 1;
    }

    const mKey = t.model || '(unknown model)';
    const cur = byModel.get(mKey) || { turns: 0, cost: 0, input: 0, output: 0 };
    cur.turns += 1;
    cur.cost += costOf(t);
    cur.input += t.usage.input;
    cur.output += t.usage.output;
    byModel.set(mKey, cur);
  }

  const fmt = (n) => n.toLocaleString('en-US');
  const fmtUsd = (n) => `$${n.toFixed(4)}`;

  const lines = [];
  lines.push(`# Feature report: ${feature.slug}`);
  lines.push('');
  lines.push(`- **Started:** ${feature.opened || 'n/a'}`);
  lines.push(`- **Closed:** ${feature.closed || '(не закрыто)'}`);
  lines.push(
    `- **Total turns:** ${totals.turns} (main: ${totals.mainTurns}, subagent: ${totals.agentTurns})`,
  );
  lines.push(`- **Agent invocations:** ${totals.agentInvocations}`);
  lines.push('');
  lines.push('## Tokens');
  lines.push('');
  lines.push('| Type | Count |');
  lines.push('|---|---|');
  lines.push(`| Input | ${fmt(totals.input)} |`);
  lines.push(`| Output | ${fmt(totals.output)} |`);
  lines.push(`| Cache write | ${fmt(totals.cacheWrite)} |`);
  lines.push(`| Cache read | ${fmt(totals.cacheRead)} |`);
  lines.push(`| **Total cost** | **${fmtUsd(totals.cost)}** |`);
  lines.push('');
  lines.push('## By model');
  lines.push('');
  lines.push('| Model | Turns | Input | Output | Cost |');
  lines.push('|---|---|---|---|---|');
  for (const [m, v] of byModel) {
    lines.push(`| ${m} | ${v.turns} | ${fmt(v.input)} | ${fmt(v.output)} | ${fmtUsd(v.cost)} |`);
  }
  lines.push('');
  if (byAgent.size) {
    lines.push('## By subagent');
    lines.push('');
    lines.push('| Agent | Turns | Output tokens | Cost |');
    lines.push('|---|---|---|---|');
    for (const [a, v] of byAgent) {
      lines.push(`| ${a} | ${v.turns} | ${fmt(v.output)} | ${fmtUsd(v.cost)} |`);
    }
    lines.push('');
  }
  lines.push('## Notes');
  lines.push('');
  lines.push(
    '- Цены — приблизительные (Opus/Sonnet/Haiku 4.x), править в `scripts/feature-report.mjs` → `PRICES`.',
  );
  lines.push(
    '- Cache-read дешевле обычного input в ~10 раз — большой `cacheRead` без `cacheWrite` означает, что мы возвращались к закэшированному контексту (хорошо).',
  );
  lines.push(
    '- Если subagent-turns = 0, но цена высокая — фича делалась main assistant без делегирования.',
  );

  return lines.join('\n');
};

// === main ===
const args = process.argv.slice(2);
const cmd = args[0];

const turns = collectTurns();
const features = segmentFeatures(turns);

if (!cmd || cmd === '--help' || cmd === '-h') {
  console.log('Usage:');
  console.log('  node scripts/feature-report.mjs list           — все маркированные фичи');
  console.log('  node scripts/feature-report.mjs <slug>         — сгенерить reports/<slug>.md');
  console.log('  node scripts/feature-report.mjs all            — все фичи в reports/');
  process.exit(0);
}

if (cmd === 'list') {
  if (!features.size) {
    console.log('Нет маркеров <<feature: ...>> в логах.');
    process.exit(0);
  }
  for (const [slug, f] of features) {
    const status = f.closed ? 'closed' : 'open';
    console.log(
      `  ${slug}  [${status}]  turns=${f.turns.length}  ${f.opened ?? ''} → ${f.closed ?? ''}`,
    );
  }
  process.exit(0);
}

const reportsDir = resolve(repoRoot, 'reports');
if (!existsSync(reportsDir)) mkdirSync(reportsDir, { recursive: true });

const writeOne = (slug) => {
  const f = features.get(slug);
  if (!f) {
    console.error(`[report] фича '${slug}' не найдена. pnpm report list — список доступных.`);
    return false;
  }
  const out = join(reportsDir, `${slug}.md`);
  writeFileSync(out, `${buildReport(f)}\n`);
  console.log(`✓ ${out}`);
  return true;
};

if (cmd === 'all') {
  for (const slug of features.keys()) writeOne(slug);
  process.exit(0);
}

const ok = writeOne(cmd);
process.exit(ok ? 0 : 1);
