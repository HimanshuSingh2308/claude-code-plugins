import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { sandbox, ROOT } from './helpers.mjs';
import { readState, writeState, freshState } from '../scripts/lib/state.mjs';

function run(args) {
  const r = spawnSync(process.execPath, [join(ROOT, 'scripts', 'override.mjs'), ...args], { encoding: 'utf8' });
  return { code: r.status, out: (r.stdout || '').trim(), err: r.stderr };
}

test('--cap off sets the cap override for the session', () => {
  const s = sandbox();
  // Create a state file first, as a hook normally would.
  writeInitialState(s);
  const r = run(['--cwd', s.cwd, '--scratchpad', s.scratchpad_dir, '--session', s.session_id, '--cap', 'off']);
  assert.equal(r.code, 0);
  assert.match(r.out, /cap=off/);
  assert.equal(readState(s).overrides.cap, true);
});

test('--cap on clears the cap override', () => {
  const s = sandbox();
  writeInitialState(s);
  run(['--cwd', s.cwd, '--scratchpad', s.scratchpad_dir, '--session', s.session_id, '--cap', 'off']);
  const r = run(['--cwd', s.cwd, '--scratchpad', s.scratchpad_dir, '--session', s.session_id, '--cap', 'on']);
  assert.equal(r.code, 0);
  assert.equal(readState(s).overrides.cap, false);
});

test('--reads off sets the reads override', () => {
  const s = sandbox();
  writeInitialState(s);
  run(['--cwd', s.cwd, '--scratchpad', s.scratchpad_dir, '--session', s.session_id, '--reads', 'off']);
  assert.equal(readState(s).overrides.reads, true);
});

test('both --cap and --reads can be set in one call', () => {
  const s = sandbox();
  writeInitialState(s);
  const r = run([
    '--cwd', s.cwd, '--scratchpad', s.scratchpad_dir, '--session', s.session_id,
    '--cap', 'off', '--reads', 'off'
  ]);
  assert.match(r.out, /cap=off/);
  assert.match(r.out, /reads=off/);
  const st = readState(s);
  assert.equal(st.overrides.cap, true);
  assert.equal(st.overrides.reads, true);
});

test('no --cap or --reads reports nothing to change', () => {
  const s = sandbox();
  writeInitialState(s);
  const r = run(['--cwd', s.cwd, '--scratchpad', s.scratchpad_dir, '--session', s.session_id]);
  assert.match(r.out, /nothing to change/);
});

test('an invalid value is rejected without touching state', () => {
  const s = sandbox();
  writeInitialState(s);
  const r = run(['--cwd', s.cwd, '--scratchpad', s.scratchpad_dir, '--session', s.session_id, '--cap', 'maybe']);
  assert.match(r.out, /must be "off" or "on"/);
  assert.equal(readState(s).overrides.cap, false);
});

test('self-locating: works with only --scratchpad, no --session, like status.mjs', () => {
  const s = sandbox();
  writeInitialState(s);
  const r = run(['--cwd', s.cwd, '--scratchpad', s.scratchpad_dir, '--cap', 'off']);
  assert.equal(r.code, 0);
  assert.equal(readState(s).overrides.cap, true);
});

test('an explicit --session always wins, even for a session with no state file yet', () => {
  // Matches status.mjs's contract: an explicit --session is used as-is.
  // writeState() creates the file on demand, so this still succeeds.
  const s = sandbox();
  const r = run(['--cwd', s.cwd, '--scratchpad', s.scratchpad_dir, '--session', 'nope-not-real', '--cap', 'off']);
  assert.equal(r.code, 0);
  assert.equal(readState({ session_id: 'nope-not-real', scratchpad_dir: s.scratchpad_dir }).overrides.cap, true);
});

test('nothing found anywhere reports plainly when no session id can be derived', () => {
  const cwd = sandbox().cwd;
  const emptyTmp = sandbox().scratchpad_dir;  // an unrelated, empty directory
  const r = spawnSync(process.execPath, [join(ROOT, 'scripts', 'override.mjs'), '--cwd', cwd, '--cap', 'off'],
    { encoding: 'utf8', env: { ...process.env, TMPDIR: emptyTmp } });
  assert.equal(r.status, 0);
  assert.match(r.stdout, /no session state file found/);
});

function writeInitialState(s) {
  // Mirrors what a hook would have done already this session.
  writeState(s, freshState(s));
}
