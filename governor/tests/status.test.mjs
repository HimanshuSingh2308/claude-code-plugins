import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { sandbox, ROOT, runHook } from './helpers.mjs';

function status(s) {
  const r = spawnSync(process.execPath, [join(ROOT, 'scripts', 'status.mjs'),
    '--cwd', s.cwd, '--session', s.session_id, '--scratchpad', s.scratchpad_dir], { encoding: 'utf8' });
  return { code: r.status, err: r.stderr, json: JSON.parse(r.stdout) };
}

// Self-locating: no --session, only what the command text can hand status.mjs
// - --cwd and --scratchpad. Optionally overrides the child's TMPDIR so the
// os.tmpdir() fallback is exercised against a directory this test controls,
// not whatever the real machine's temp dir happens to hold.
function statusSelfLocating(cwd, scratchpad, { tmpdirOverride } = {}) {
  const args = [join(ROOT, 'scripts', 'status.mjs'), '--cwd', cwd];
  if (scratchpad) args.push('--scratchpad', scratchpad);
  const env = tmpdirOverride ? { ...process.env, TMPDIR: tmpdirOverride } : process.env;
  return spawnSync(process.execPath, args, { encoding: 'utf8', env });
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

test('reports capReachedAt once the cap trips, null before that', () => {
  const s = sandbox({ session: { maxTurns: 2, maxCompactions: 99 } });
  assert.equal(status(s).json.capReachedAt, null);
  runHook('user-prompt.mjs', {
    ...s, hook_event_name: 'UserPromptSubmit', prompt: 'go',
    transcript_path: join(ROOT, 'tests', 'fixtures', 'transcript-two-compactions.jsonl') });
  const j = status(s).json;
  assert.equal(j.capReached, true);
  assert.ok(typeof j.capReachedAt === 'number' && j.capReachedAt > 0);
});

test('reports handoffOnDisk when a handoff file exists, independent of handoffWritten', () => {
  const s = sandbox();
  assert.equal(status(s).json.handoffOnDisk, null);
  mkdirSync(join(s.cwd, 'docs/handoffs'), { recursive: true });
  writeFileSync(join(s.cwd, 'docs/handoffs/2026-09-22-x.md'), '# Handoff');
  const j = status(s).json;
  assert.ok(j.handoffOnDisk && j.handoffOnDisk.endsWith('2026-09-22-x.md'));
  assert.equal(j.handoffWritten, false, 'handoffOnDisk is a live disk check, separate from the state flag');
});

test('reports lastRepoDir once a Read or Write has recorded one', () => {
  const s = sandbox();
  assert.equal(status(s).json.lastRepoDir, null);
  execFileSync('git', ['init', '-q'], { cwd: s.cwd });
  mkdirSync(join(s.cwd, 'src'), { recursive: true });
  writeFileSync(join(s.cwd, 'src/app.js'), 'const a = 1;');
  runHook('post-tool-write.mjs', {
    ...s, hook_event_name: 'PostToolUse', tool_name: 'Write',
    tool_input: { file_path: join(s.cwd, 'src/app.js'), content: 'const a = 1;' }, tool_result: 'ok' });
  const j = status(s).json;
  assert.ok(j.lastRepoDir, 'lastRepoDir should be recorded');
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

test('self-locating: derives the session id from the scratchpad path\'s parent directory', () => {
  // Interactive-session layout measured on CLI 2.1.280: <root>/<session_id>/scratchpad.
  const cwd = mkdtempSync(join(tmpdir(), 'gov-cwd-'));
  const root = mkdtempSync(join(tmpdir(), 'gov-root-'));
  const sessionId = 'a0d1f9a1-ebc0-4e00-8b12-aeb2197e921e';
  const scratchpad = join(root, sessionId, 'scratchpad');
  mkdirSync(scratchpad, { recursive: true });

  runHook('user-prompt.mjs', {
    cwd, session_id: sessionId, scratchpad_dir: scratchpad,
    hook_event_name: 'UserPromptSubmit', prompt: 'go',
    transcript_path: join(ROOT, 'tests', 'fixtures', 'transcript-two-compactions.jsonl') });

  // Only --cwd and --scratchpad: what commands/governor.md now passes, no --session.
  const r = statusSelfLocating(cwd, scratchpad);
  assert.equal(r.status, 0, r.stderr);
  const j = JSON.parse(r.stdout);
  assert.equal(j.sessionId, sessionId);
  assert.equal(j.turns, 4);
  assert.equal(j.compactions, 2);
});

test('self-locating: falls back to the newest governor-*.json in the scratchpad dir', () => {
  // A scratchpad directory that does not follow the <root>/<session_id>/scratchpad
  // shape, so deriving the id from its parent directory name will not match any
  // real state file. status.mjs should still find the (only) state file present.
  const cwd = mkdtempSync(join(tmpdir(), 'gov-cwd-'));
  const scratchpad = mkdtempSync(join(tmpdir(), 'gov-oddly-shaped-'));
  const sessionId = 'unrelated-session-id';

  runHook('user-prompt.mjs', {
    cwd, session_id: sessionId, scratchpad_dir: scratchpad,
    hook_event_name: 'UserPromptSubmit', prompt: 'go',
    transcript_path: join(ROOT, 'tests', 'fixtures', 'transcript-two-compactions.jsonl') });

  const r = statusSelfLocating(cwd, scratchpad);
  assert.equal(r.status, 0, r.stderr);
  const j = JSON.parse(r.stdout);
  assert.equal(j.sessionId, sessionId);
  assert.equal(j.turns, 4);
});

test('self-locating: prints a clear line instead of a zero state when nothing is found', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'gov-cwd-'));
  const emptyScratchpad = mkdtempSync(join(tmpdir(), 'gov-empty-scratch-'));
  const emptyTmp = mkdtempSync(join(tmpdir(), 'gov-empty-tmp-'));

  const r = statusSelfLocating(cwd, emptyScratchpad, { tmpdirOverride: emptyTmp });
  assert.equal(r.status, 0, r.stderr);
  assert.ok(r.stdout.includes('no session state file found'), r.stdout);
  assert.throws(() => JSON.parse(r.stdout), 'the no-state line is not JSON, so a caller cannot mistake it for real zeros');
});
