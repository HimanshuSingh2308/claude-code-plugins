import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { runHook, sandbox, hookOut, ROOT } from './helpers.mjs';

const FIXTURE = join(ROOT, 'tests', 'fixtures', 'transcript-two-compactions.jsonl');
const CAPPED = { session: { maxTurns: 2 }, enforce: { cap: true } };

const trip = (s) => runHook('user-prompt.mjs', {
  ...s, hook_event_name: 'UserPromptSubmit', prompt: 'go', transcript_path: FIXTURE });
const gate = (s, tool_name, tool_input) => runHook('pre-tool-cap.mjs', {
  ...s, hook_event_name: 'PreToolUse', tool_name, tool_input });

test('before the cap nothing is gated', () => {
  assert.equal(gate(sandbox(CAPPED), 'Bash', { command: 'npm test' }).out, '');
});

test('after the cap an ordinary call is denied', () => {
  const s = sandbox(CAPPED); trip(s);
  const o = hookOut(gate(s, 'Bash', { command: 'npm test' }));
  assert.equal(o.permissionDecision, 'deny');
  assert.ok(o.permissionDecisionReason.includes('handoff'));
});

test('a Write or Edit under handoffPath passes', () => {
  const s = sandbox(CAPPED); trip(s);
  assert.equal(gate(s, 'Write', { file_path: 'docs/handoffs/2026-09-22-main.md' }).out, '');
  assert.equal(gate(s, 'Edit', { file_path: join(s.cwd, 'docs/handoffs/x.md') }).out, '');
});

test('a Write elsewhere is denied', () => {
  const s = sandbox(CAPPED); trip(s);
  assert.equal(hookOut(gate(s, 'Write', { file_path: 'src/app.js' })).permissionDecision, 'deny');
});

test('read-only git, git add, git commit and any Read pass', () => {
  const s = sandbox(CAPPED); trip(s);
  for (const c of ['git status', 'git diff --stat', 'git log --oneline -5', 'git add -A', 'git commit -m "x"']) {
    assert.equal(gate(s, 'Bash', { command: c }).out, '', c);
  }
  assert.equal(gate(s, 'Read', { file_path: 'anything.js' }).out, '');
});

test('git push is still denied after the cap', () => {
  const s = sandbox(CAPPED); trip(s);
  assert.equal(hookOut(gate(s, 'Bash', { command: 'git push' })).permissionDecision, 'deny');
});

test('warn-only is the default: enforce.cap false never denies', () => {
  const s = sandbox({ session: { maxTurns: 2 } }); trip(s);
  assert.equal(gate(s, 'Bash', { command: 'npm test' }).out, '');
});

test('writing the handoff lifts the gate', () => {
  const s = sandbox(CAPPED); trip(s);
  runHook('post-tool-write.mjs', {
    ...s, hook_event_name: 'PostToolUse', tool_name: 'Write',
    tool_input: { file_path: 'docs/handoffs/2026-09-22-main.md', content: '# Handoff' }, tool_result: 'ok' });
  assert.equal(gate(s, 'Bash', { command: 'npm test' }).out, '');
});

test('!cap=off lifts the gate', () => {
  const s = sandbox(CAPPED);
  runHook('user-prompt.mjs', {
    ...s, hook_event_name: 'UserPromptSubmit', prompt: 'go !cap=off', transcript_path: FIXTURE });
  assert.equal(gate(s, 'Bash', { command: 'npm test' }).out, '');
});
