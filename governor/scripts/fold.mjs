#!/usr/bin/env node
// Deterministic half of /governor memory fold and /governor task fold.
// Without --apply it only proposes: it prints a JSON plan and touches nothing.
// With --apply it requires --approved <plan.json> and performs exactly that plan.
import {
  readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync, appendFileSync, rmSync, copyFileSync
} from 'node:fs';
import { join, basename } from 'node:path';
import { loadPolicy } from './lib/policy.mjs';
import { slug } from './lib/areas.mjs';

const SEED_ALIASES = {
  boatjam: 'boat-jam', tt3d: 'tiny-tycoon-3d', vb2: 'voidbreak-2',
  voidbreak2: 'voidbreak-2', dd: 'doodle-dash'
};

function argv() {
  const a = process.argv.slice(2);
  const out = { _: [] };
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith('--')) {
      const k = a[i].slice(2);
      out[k] = (a[i + 1] && !a[i + 1].startsWith('--')) ? a[++i] : true;
    } else out._.push(a[i]);
  }
  return out;
}

/** Every directory matching a single-* area glob is an area; flat globs are areas by alias. */
export function discoverAreas(cwd, policy) {
  const areas = [];
  for (const [pattern, alias] of Object.entries((policy.memory && policy.memory.areas) || {})) {
    if (pattern.includes('*') && String(alias).includes('{1}')) {
      const base = pattern.slice(0, pattern.indexOf('*')).replace(/\/$/, '');
      let entries = [];
      try { entries = readdirSync(join(cwd, base), { withFileTypes: true }); } catch { entries = []; }
      for (const e of entries) {
        if (!e.isDirectory()) continue;
        areas.push({ name: String(alias).replace('{1}', e.name), dir: `${base}/${e.name}`,
          glob: `${base}/${e.name}/**` });
      }
    } else {
      areas.push({ name: String(alias).replace(/\{\d+\}/g, ''),
        dir: pattern.replace(/\/?\*+$/, ''), glob: pattern });
    }
  }
  return areas;
}

export function aliasTable(areas) {
  const table = { ...SEED_ALIASES };
  for (const a of areas) {
    const dir = basename(a.dir);
    table[dir.replace(/-/g, '')] = dir;
    const initials = dir.split('-').map((w) => w[0]).join('');
    if (initials.length >= 2) table[initials] = dir;
    const numTail = dir.match(/^([a-z]+)-?([a-z]*)-?(\d+)$/);
    if (numTail) table[numTail[1].slice(0, 2) + numTail[3]] = dir;
  }
  return table;
}

const tokensOf = (file) => basename(file, '.md').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

export function rollupFor(file, area) {
  if (area) return `rollup_${area.replace(/\//g, '_')}.md`;
  const n = basename(file).toLowerCase();
  if (n.startsWith('feedback_')) return 'rollup_feedback.md';
  if (n.startsWith('reference_')) return 'rollup_reference.md';
  return 'rollup_project.md';
}

export function firstLine(body) {
  for (const l of String(body).split('\n')) {
    const t = l.trim();
    if (t && !t.startsWith('#')) return t.replace(/\s+/g, ' ').slice(0, 120);
  }
  return '';
}

export function assign(file, body, areas, table) {
  if (basename(file).toLowerCase().startsWith('feedback_')) return { area: null, reason: 'feedback' };
  const toks = tokensOf(file);
  for (const a of areas) {
    const dir = basename(a.dir);
    if (toks.includes(dir.replace(/-/g, ''))) return { area: a.name, reason: 'alias' };
    for (const t of toks) if (table[t] === dir) return { area: a.name, reason: 'alias' };
    if (toks.join('-').includes(dir)) return { area: a.name, reason: 'slug' };
  }
  for (const m of String(body).matchAll(/`([^`\n]+)`/g)) {
    const p = m[1].trim();
    for (const a of areas) if (p.startsWith(a.dir + '/') || p === a.dir) return { area: a.name, reason: 'path' };
  }
  return { area: null, reason: 'unmatched' };
}

function ruleFileFor(policy, area) {
  return join(policy.memory.rulesDir, `${area.replace(/\//g, '-')}.md`);
}

export function proposeMemory(cwd, memDir, policy) {
  const areas = discoverAreas(cwd, policy);
  const table = aliasTable(areas);
  const files = readdirSync(memDir).filter((f) => f.endsWith('.md') && f !== 'MEMORY.md'
    && !f.startsWith('rollup_'));
  const assignments = [];
  const rollups = {};
  const rules = {};
  for (const file of files.sort()) {
    const body = readFileSync(join(memDir, file), 'utf8');
    const { area, reason } = assign(file, body, areas, table);
    const rollup = rollupFor(file, area);
    assignments.push({ file, slug: basename(file, '.md'), area, rollup, reason, hook: firstLine(body) });
    (rollups[rollup] = rollups[rollup] || []).push(file);
    if (area) {
      const a = areas.find((x) => x.name === area);
      rules[area] = { path: ruleFileFor(policy, area), glob: a ? a.glob : `${area}/**`, members: [] };
    }
  }
  for (const a of assignments) if (a.area) rules[a.area].members.push(a.file);

  const budget = (policy.memory && policy.memory.indexBudgetBytes) || 8192;
  let index = '# Memory Index\n\nRollups (each lists its member files; every [[name]] still resolves):\n\n';
  for (const [name, members] of Object.entries(rollups).sort()) {
    const line = `- [${basename(name, '.md').replace(/^rollup_/, '').replace(/_/g, ' ')}](${name}) - ${members.length} memories\n`;
    if (Buffer.byteLength(index + line) > budget) break;
    index += line;
  }
  return { aliases: table, assignments, rollups, rules, index, memDir };
}

export function applyMemory(cwd, memDir, plan, policy) {
  const wrote = [];
  for (const [name, members] of Object.entries(plan.rollups || {})) {
    const title = basename(name, '.md').replace(/^rollup_/, '').replace(/[_/]/g, ' ');
    let body = `# ${title}\n\nMembers (originals are never deleted):\n\n`;
    for (const f of members) {
      const a = (plan.assignments || []).find((x) => x.file === f) || {};
      body += `- [[${basename(f, '.md')}]] - ${a.hook || ''}\n`;
    }
    writeFileSync(join(memDir, name), body);
    wrote.push(join(memDir, name));
  }
  for (const [area, rule] of Object.entries(plan.rules || {})) {
    const abs = join(cwd, rule.path);
    mkdirSync(join(cwd, policy.memory.rulesDir), { recursive: true });
    const members = (rule.members || []).map((f) => {
      const a = (plan.assignments || []).find((x) => x.file === f) || {};
      return `- [[${basename(f, '.md')}]] - ${a.hook || ''}`;
    }).join('\n');
    if (existsSync(abs)) {
      appendFileSync(abs, `\n## governor fold ${new Date().toISOString().slice(0, 10)}\n\n${members}\n`);
    } else {
      writeFileSync(abs, `---\npaths: ${rule.glob}\n---\n\n# ${area}\n\n${members}\n`);
    }
    wrote.push(abs);
  }
  if (plan.index) { writeFileSync(join(memDir, 'MEMORY.md'), plan.index); wrote.push(join(memDir, 'MEMORY.md')); }

  const gi = join(cwd, '.gitignore');
  const line = `${String(policy.memory.tasksDir).replace(/\/$/, '')}/`;
  let current = '';
  try { current = readFileSync(gi, 'utf8'); } catch { current = ''; }
  if (!current.split('\n').some((l) => l.trim() === line)) {
    writeFileSync(gi, current + (current && !current.endsWith('\n') ? '\n' : '') + line + '\n');
    wrote.push(gi);
  }
  return { wrote, movedOriginals: [] };
}

export function proposeTask(cwd, branch, policy) {
  const dir = join(cwd, policy.memory.tasksDir, slug(branch));
  const areas = discoverAreas(cwd, policy);
  const table = aliasTable(areas);
  let files = [];
  try { files = readdirSync(dir).filter((f) => f.endsWith('.md')); } catch { files = []; }
  const notes = files.sort().map((file) => {
    const body = readFileSync(join(dir, file), 'utf8');
    const { area } = assign(file, body, areas, table);
    return { file, title: (/^#\s+(.+)$/m.exec(body) || [, basename(file, '.md')])[1].trim(),
      proposed: area || 'rollup_project.md', keep: true };
  });
  return { branch, slug: slug(branch), dir: join(policy.memory.tasksDir, slug(branch)), notes };
}

export function applyTask(cwd, branch, plan, policy) {
  const dir = join(cwd, policy.memory.tasksDir, plan.slug || slug(branch));
  const archive = join(cwd, policy.memory.archiveDir, plan.slug || slug(branch));
  mkdirSync(archive, { recursive: true });
  const folded = [], archived = [];
  for (const note of plan.notes || []) {
    const src = join(dir, note.file);
    if (!existsSync(src)) continue;
    const body = readFileSync(src, 'utf8');
    if (note.keep && note.proposed && !String(note.proposed).startsWith('rollup_')) {
      const rulePath = join(cwd, policy.memory.rulesDir, `${String(note.proposed).replace(/\//g, '-')}.md`);
      mkdirSync(join(cwd, policy.memory.rulesDir), { recursive: true });
      const section = `\n## ${note.title}\n\n${body.replace(/^#\s+.*\n/, '')}\n`;
      if (existsSync(rulePath)) appendFileSync(rulePath, section);
      else writeFileSync(rulePath, `---\npaths: ${note.proposed}/**\n---\n\n# ${note.proposed}\n${section}`);
      folded.push(rulePath);
    }
    copyFileSync(src, join(archive, note.file));
    rmSync(src);
    archived.push(join(archive, note.file));
  }
  return { folded, archived };
}

const args = argv();
const mode = args._[0];
const cwd = args.cwd || process.cwd();
const policy = loadPolicy(cwd);

if (args.apply && !args.approved) {
  process.stderr.write('governor fold: --apply requires --approved <plan.json>; nothing was moved\n');
  process.exit(2);
}

try {
  if (mode === 'memory') {
    const memDir = args['memory-dir'];
    if (!memDir) { process.stderr.write('governor fold: --memory-dir is required\n'); process.exit(2); }
    if (!args.apply) {
      process.stdout.write(JSON.stringify(proposeMemory(cwd, memDir, policy), null, 2));
    } else {
      const plan = JSON.parse(readFileSync(args.approved, 'utf8'));
      process.stdout.write(JSON.stringify(applyMemory(cwd, memDir, plan, policy), null, 2));
    }
  } else if (mode === 'task') {
    const branch = args.branch;
    if (!branch) { process.stderr.write('governor fold: --branch is required\n'); process.exit(2); }
    if (!args.apply) {
      process.stdout.write(JSON.stringify(proposeTask(cwd, branch, policy), null, 2));
    } else {
      const plan = JSON.parse(readFileSync(args.approved, 'utf8'));
      process.stdout.write(JSON.stringify(applyTask(cwd, branch, plan, policy), null, 2));
    }
  } else {
    process.stderr.write('usage: fold.mjs <memory|task> --cwd <dir> [--memory-dir <dir>|--branch <name>] [--apply --approved <plan.json>]\n');
    process.exit(2);
  }
} catch (err) {
  process.stderr.write(`governor fold: ${err.message}\n`);
  process.exit(1);
}
