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

test('enforce.cap is true by default since 0.1.1: no explicit policy still denies after the cap', () => {
  const s = sandbox({ session: { maxTurns: 2 } }); trip(s);
  const o = hookOut(gate(s, 'Bash', { command: 'npm test' }));
  assert.equal(o.permissionDecision, 'deny');
  assert.ok(o.permissionDecisionReason.includes('handoff'));
});

test('enforce.cap: false in a project policy still disables the gate', () => {
  const s = sandbox({ session: { maxTurns: 2 }, enforce: { cap: false } }); trip(s);
  assert.equal(gate(s, 'Bash', { command: 'npm test' }).out, '');
});

test('a session already over the cap before install is not gated until the handoff prompt has fired once', () => {
  // Simulates upgrading to 0.1.1 mid-session: the transcript already has 2
  // compactions (>= the default maxCompactions), so the cap condition is true
  // as soon as any UserPromptSubmit is processed under the new default. Until
  // that happens, capReached is still false (there is no session state yet)
  // and tool calls must not be silently blocked.
  const s = sandbox();  // no policy file: pure default.json, enforce.cap true

  // Before any UserPromptSubmit event, state.capReached is false: not gated.
  assert.equal(gate(s, 'Bash', { command: 'npm test' }).out, '');

  // The qualifying UserPromptSubmit: turns/compactions already over the cap,
  // so this is the one that shows the handoff prompt and flips capReached.
  const trippedOut = trip(s).out;
  assert.ok(trippedOut.includes('governor: session cap reached'), trippedOut);
  assert.ok(trippedOut.includes('write the handoff'), trippedOut);

  // Only now, after that prompt has been shown once, are non-allowlisted
  // tools denied.
  const o = hookOut(gate(s, 'Bash', { command: 'npm test' }));
  assert.equal(o.permissionDecision, 'deny');
  // The allowlist still works under the new default: Read, safe Bash and a
  // handoff-path Write/Edit all still pass so the session can finish the handoff.
  assert.equal(gate(s, 'Read', { file_path: 'anything.js' }).out, '');
  assert.equal(gate(s, 'Bash', { command: 'git status' }).out, '');
  assert.equal(gate(s, 'Write', { file_path: 'docs/handoffs/2026-09-22-main.md' }).out, '');
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
