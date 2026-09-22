import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { sandbox, ROOT, runHook } from './helpers.mjs';

function status(s) {
  const r = spawnSync(process.execPath, [join(ROOT, 'scripts', 'status.mjs'),
    '--cwd', s.cwd, '--session', s.session_id, '--scratchpad', s.scratchpad_dir], { encoding: 'utf8' });
  return { code: r.status, err: r.stderr, json: JSON.parse(r.stdout) };
}

test('reports the session counters', () => {
  const s = sandbox();
  runHook('user-prompt.mjs', {
    ...s, hook_event_name: 'UserPromptSubmit', prompt: 'go !cap=off',
    transcript_path: join(ROOT, 'tests', 'fixtures', 'transcript-two-compactions.jsonl') });
  const j = status(s).json;
  assert.equal(j.turns, 4);
  assert.equal(j.compactions, 2);
  assert.equal(j.overrides.cap, true);
  assert.equal(j.profile, 'default');
});

test('reports orphan memories whose files are gone', () => {
  const s = sandbox();
  mkdirSync(join(s.cwd, '.claude'), { recursive: true });
  writeFileSync(join(s.cwd, '.claude/knowledge_graph.json'), JSON.stringify({
    meta: { project: 'x' }, files: {}, symbols: {},
    memories: [
      { id: 'a', path: '.claude/rules/gone.md', title: 'Gone', files: [] },
      { id: 'b', path: '.claude/rules/here.md', title: 'Here', files: ['missing.js'] }
    ]
  }));
  mkdirSync(join(s.cwd, '.claude/rules'), { recursive: true });
  writeFileSync(join(s.cwd, '.claude/rules/here.md', ), '# Here');
  const j = status(s).json;
  assert.deepEqual(j.orphanMemories.map((m) => m.id).sort(), ['a', 'b']);
});

test('a session with no state still reports zeros', () => {
  const j = status(sandbox()).json;
  assert.equal(j.turns, 0);
  assert.deepEqual(j.orphanMemories, []);
});
