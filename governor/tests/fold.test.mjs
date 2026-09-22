import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sandbox, ROOT } from './helpers.mjs';

function fold(args) {
  const r = spawnSync(process.execPath, [join(ROOT, 'scripts', 'fold.mjs'), ...args], { encoding: 'utf8' });
  const out = (r.stdout || '').trim();
  return { code: r.status, out, err: r.stderr, json: out.startsWith('{') ? JSON.parse(out) : null };
}

function fixtureMemory() {
  const s = sandbox({ memory: { areas: { 'games/*': 'games/{1}' } } });
  mkdirSync(join(s.cwd, 'games/tiny-tycoon-3d'), { recursive: true });
  mkdirSync(join(s.cwd, 'games/boat-jam'), { recursive: true });
  const mem = join(s.cwd, 'fixture-memory');
  mkdirSync(mem, { recursive: true });
  writeFileSync(join(mem, 'MEMORY.md'), '# Memory Index\n\n- [tt3d gate traps](reference_tt3d_gate_traps.md)\n');
  writeFileSync(join(mem, 'reference_tt3d_gate_traps.md'), '# TT3D gate traps\n\nSilent until the end.\n');
  writeFileSync(join(mem, 'project_boatjam_pier_grant.md'), '# Boat Jam pier grant\n\nThe row re-lays.\n');
    // A slug that matches no area name, so only the body path can place it.
  writeFileSync(join(mem, 'project_terminal_emergence.md'),
    '# Terminal emergence\n\nSee `games/boat-jam/main.js`.\n');
  writeFileSync(join(mem, 'feedback_no_em_dash.md'), '# No em dash\n\nNever.\n');
  return { s, mem };
}
const propose = (s, mem) => fold(['memory', '--cwd', s.cwd, '--memory-dir', mem]);
function approved(s, plan, name = 'plan.json') {
  const p = join(s.cwd, name);
  writeFileSync(p, JSON.stringify(plan));
  return p;
}

test('propose prints a plan and moves nothing', () => {
  const { s, mem } = fixtureMemory();
  const before = readdirSync(mem).sort();
  const r = propose(s, mem);
  assert.equal(r.code, 0, r.err);
  assert.ok(r.json.aliases);
  assert.ok(Array.isArray(r.json.assignments));
  assert.deepEqual(readdirSync(mem).sort(), before);
});

test('assignment by alias: tt3d maps to the tiny-tycoon-3d area', () => {
  const { s, mem } = fixtureMemory();
  const a = propose(s, mem).json.assignments.find((x) => x.file === 'reference_tt3d_gate_traps.md');
  assert.equal(a.area, 'games/tiny-tycoon-3d');
  assert.equal(a.reason, 'alias');
});

test('assignment by slug: boatjam maps to boat-jam', () => {
  const { s, mem } = fixtureMemory();
  const a = propose(s, mem).json.assignments.find((x) => x.file === 'project_boatjam_pier_grant.md');
  assert.equal(a.area, 'games/boat-jam');
});

test('assignment by a path in the body when the slug does not match', () => {
  const { s, mem } = fixtureMemory();
  const a = propose(s, mem).json.assignments.find((x) => x.file === 'project_terminal_emergence.md');
  assert.equal(a.area, 'games/boat-jam');
  assert.equal(a.reason, 'path');
});

test('feedback memories stay top level in the feedback rollup', () => {
  const { s, mem } = fixtureMemory();
  const a = propose(s, mem).json.assignments.find((x) => x.file === 'feedback_no_em_dash.md');
  assert.equal(a.area, null);
  assert.equal(a.rollup, 'rollup_feedback.md');
});

test('--apply without --approved refuses and moves nothing', () => {
  const { s, mem } = fixtureMemory();
  const before = readdirSync(mem).sort();
  const r = fold(['memory', '--cwd', s.cwd, '--memory-dir', mem, '--apply']);
  assert.notEqual(r.code, 0);
  assert.deepEqual(readdirSync(mem).sort(), before);
});

test('--apply with an approved plan writes rollups and rule files but deletes nothing', () => {
  const { s, mem } = fixtureMemory();
  const p = approved(s, propose(s, mem).json);
  const r = fold(['memory', '--cwd', s.cwd, '--memory-dir', mem, '--apply', '--approved', p]);
  assert.equal(r.code, 0, r.err);
  assert.ok(existsSync(join(mem, 'rollup_feedback.md')));
  assert.ok(existsSync(join(s.cwd, '.claude/rules/games-tiny-tycoon-3d.md')));
  assert.ok(existsSync(join(mem, 'reference_tt3d_gate_traps.md')));
  const idx = readFileSync(join(mem, 'MEMORY.md'), 'utf8');
  assert.ok(idx.includes('rollup_feedback.md'));
  assert.ok(Buffer.byteLength(idx) <= 8192);
});

test('a rollup lists its members as resolvable wiki links', () => {
  const { s, mem } = fixtureMemory();
  const p = approved(s, propose(s, mem).json);
  fold(['memory', '--cwd', s.cwd, '--memory-dir', mem, '--apply', '--approved', p]);
  const roll = readFileSync(join(mem, 'rollup_feedback.md'), 'utf8');
  assert.ok(roll.includes('[[feedback_no_em_dash]]'));
  assert.ok(roll.includes('Never.'));
});

test('the rule file carries a paths frontmatter derived from the area glob', () => {
  const { s, mem } = fixtureMemory();
  const p = approved(s, propose(s, mem).json);
  fold(['memory', '--cwd', s.cwd, '--memory-dir', mem, '--apply', '--approved', p]);
  const rule = readFileSync(join(s.cwd, '.claude/rules/games-tiny-tycoon-3d.md'), 'utf8');
  assert.ok(rule.startsWith('---\n'));
  assert.ok(rule.includes('paths:'));
  assert.ok(rule.includes('games/tiny-tycoon-3d/**'));
});

test('the fold adds the tasks dir to .gitignore once', () => {
  const { s, mem } = fixtureMemory();
  const p = approved(s, propose(s, mem).json);
  fold(['memory', '--cwd', s.cwd, '--memory-dir', mem, '--apply', '--approved', p]);
  fold(['memory', '--cwd', s.cwd, '--memory-dir', mem, '--apply', '--approved', p]);
  const gi = readFileSync(join(s.cwd, '.gitignore'), 'utf8');
  assert.equal(gi.split('\n').filter((l) => l.trim() === '.claude/memory/tasks/').length, 1);
});

test('task fold lists a branch note set and proposes a disposition', () => {
  const { s } = fixtureMemory();
  mkdirSync(join(s.cwd, '.claude/memory/tasks/feat-x'), { recursive: true });
  writeFileSync(join(s.cwd, '.claude/memory/tasks/feat-x/note.md'), '# Note\n\n`games/boat-jam/main.js`\n');
  const r = fold(['task', '--cwd', s.cwd, '--branch', 'feat/x']);
  assert.equal(r.code, 0, r.err);
  assert.equal(r.json.notes.length, 1);
  assert.equal(r.json.notes[0].proposed, 'games/boat-jam');
  assert.ok(existsSync(join(s.cwd, '.claude/memory/tasks/feat-x/note.md')));
});

test('task fold --apply archives the notes not kept', () => {
  const { s } = fixtureMemory();
  mkdirSync(join(s.cwd, '.claude/memory/tasks/feat-x'), { recursive: true });
  writeFileSync(join(s.cwd, '.claude/memory/tasks/feat-x/note.md'), '# Note\n');
  const plan = fold(['task', '--cwd', s.cwd, '--branch', 'feat/x']).json;
  plan.notes[0].keep = false;
  const p = approved(s, plan, 'taskplan.json');
  const r = fold(['task', '--cwd', s.cwd, '--branch', 'feat/x', '--apply', '--approved', p]);
  assert.equal(r.code, 0, r.err);
  assert.ok(existsSync(join(s.cwd, '.claude/memory/archive/feat-x/note.md')));
  assert.ok(!existsSync(join(s.cwd, '.claude/memory/tasks/feat-x/note.md')));
});

test('task fold --apply without --approved refuses', () => {
  const { s } = fixtureMemory();
  mkdirSync(join(s.cwd, '.claude/memory/tasks/feat-x'), { recursive: true });
  writeFileSync(join(s.cwd, '.claude/memory/tasks/feat-x/note.md'), '# Note\n');
  assert.notEqual(fold(['task', '--cwd', s.cwd, '--branch', 'feat/x', '--apply']).code, 0);
  assert.ok(existsSync(join(s.cwd, '.claude/memory/tasks/feat-x/note.md')));
});
