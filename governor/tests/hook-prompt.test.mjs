import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { runHook, sandbox, hookOut, ROOT } from './helpers.mjs';

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

test('a broken transcript path still returns a status line', () => {
  const o = hookOut(submit(sandbox(), 'hi', { transcript_path: '/nope/nope.jsonl' }));
  assert.ok(o.additionalContext.includes('turns 0'));
});
