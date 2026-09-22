import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readState, updateState, statePath } from '../scripts/lib/state.mjs';

function input() {
  return { session_id: 's1', scratchpad_dir: mkdtempSync(join(tmpdir(), 'gov-state-')) };
}

test('a fresh state has zeroed counters', () => {
  const s = readState(input());
  assert.equal(s.turns, 0);
  assert.equal(s.rewrites, 0);
  assert.deepEqual(s.overrides, { model: false, reads: false, cap: false });
});

test('updateState persists and reads back', () => {
  const i = input();
  updateState(i, (s) => { s.rewrites += 1; s.reads['a.js'] = { full: 2, partial: 0 }; });
  const s = readState(i);
  assert.equal(s.rewrites, 1);
  assert.equal(s.reads['a.js'].full, 2);
});

test('the state path is namespaced by session id', () => {
  assert.ok(statePath(input()).endsWith('governor-s1.json'));
});

test('a corrupt state file is replaced, not thrown', () => {
  const i = input();
  updateState(i, (s) => { s.turns = 3; });
  writeFileSync(statePath(i), '{{{');
  assert.equal(readState(i).turns, 0);
});
