import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { runHook, sandbox, hookOut, ROOT } from './helpers.mjs';
import { readState } from '../scripts/lib/state.mjs';

const FIXTURE = join(ROOT, 'tests', 'fixtures', 'transcript-two-compactions.jsonl');

function submit(s, text, extra = {}) {
  return runHook('user-prompt.mjs', {
    ...s, hook_event_name: 'UserPromptSubmit', prompt: text, effort: { level: 'medium' }, ...extra
  });
}

test('injects one status line', () => {
  const o = hookOut(submit(sandbox(), 'hello'));
  assert.equal(o.hookEventName, 'UserPromptSubmit');
  assert.match(o.additionalContext,
    /governor: turns \d+ \| compactions \d+ \| profile \S+ \| effort \S+ \| rewrites \d+ \| denials \d+/);
});

test('counts turns and compactions from the transcript', () => {
  const o = hookOut(submit(sandbox(), 'hello', { transcript_path: FIXTURE }));
  assert.ok(o.additionalContext.includes('turns 4'));
  assert.ok(o.additionalContext.includes('compactions 2'));
});

test('a raiseFor keyword adds the effort recommendation', () => {
  const o = hookOut(submit(sandbox(), 'help me debug this crash', { effort: { level: 'low' } }));
  assert.ok(o.additionalContext.includes('/effort'));
});

test('override tokens are recorded for the session', () => {
  const s = sandbox();
  submit(s, 'go on !reads=off and !cap=off');
  assert.ok(hookOut(submit(s, 'next')).additionalContext.includes('overrides: reads, cap'));
});

test('the cap injects the handoff instruction and sets capReached', () => {
  const s = sandbox({ session: { maxTurns: 2, maxCompactions: 99 } });
  const o = hookOut(submit(s, 'keep going', { transcript_path: FIXTURE }));
  assert.ok(o.additionalContext.includes('handoff'));
  assert.ok(/docs\/handoffs\/\d{4}-\d{2}-\d{2}-[a-z0-9-]+\.md/.test(o.additionalContext));
  assert.ok(o.additionalContext.includes('templates/handoff.md'));
});

test('the compaction cap also trips', () => {
  const s = sandbox({ session: { maxCompactions: 2, maxTurns: 99999 } });
  assert.ok(hookOut(submit(s, 'keep going', { transcript_path: FIXTURE })).additionalContext.includes('handoff'));
});

test('!cap=off suppresses the handoff instruction', () => {
  const s = sandbox({ session: { maxTurns: 2 } });
  submit(s, 'noted !cap=off');
  assert.ok(!hookOut(submit(s, 'keep going', { transcript_path: FIXTURE }))
    .additionalContext.includes('write the handoff'));
});

test('cap=off without the bang also suppresses the handoff instruction', () => {
  const s = sandbox({ session: { maxTurns: 2 } });
  submit(s, 'governor cap=off');
  assert.ok(!hookOut(submit(s, 'keep going', { transcript_path: FIXTURE }))
    .additionalContext.includes('write the handoff'));
});

test('model= inside code is not mistaken for an override', () => {
  const s = sandbox();
  const o = hookOut(submit(s, 'the config has retryModel=opus in it'));
  assert.ok(!o.additionalContext.includes('overrides:'));
});

test('the cap trip records capReachedAt', () => {
  const s = sandbox({ session: { maxTurns: 2, maxCompactions: 99 } });
  submit(s, 'keep going', { transcript_path: FIXTURE });
  const st = readState(s);
  assert.equal(st.capReached, true);
  assert.ok(typeof st.capReachedAt === 'number' && st.capReachedAt > 0);
});

test('a handoff written to disk (e.g. a Bash heredoc) after the cap trips is credited on the' +
  ' next prompt - no more "write the handoff" line', () => {
  const s = sandbox({ session: { maxTurns: 2, maxCompactions: 99 } });
  const first = hookOut(submit(s, 'keep going', { transcript_path: FIXTURE }));
  assert.ok(first.additionalContext.includes('write the handoff'));

  // Written straight to disk, never through the Write/Edit PostToolUse hook -
  // and after capReachedAt, so the recency filter does not reject it as a
  // stale leftover from an unrelated past session.
  mkdirSync(join(s.cwd, 'docs/handoffs'), { recursive: true });
  writeFileSync(join(s.cwd, 'docs/handoffs/2026-09-22-preview-tt3d-all.md'), '# Handoff');

  const o = hookOut(submit(s, 'keep going', { transcript_path: FIXTURE }));
  assert.ok(!o.additionalContext.includes('write the handoff'), o.additionalContext);
  assert.equal(readState(s).handoffWritten, true);
});

test('a broken transcript path still returns a status line', () => {
  const o = hookOut(submit(sandbox(), 'hi', { transcript_path: '/nope/nope.jsonl' }));
  assert.ok(o.additionalContext.includes('turns 0'));
});
