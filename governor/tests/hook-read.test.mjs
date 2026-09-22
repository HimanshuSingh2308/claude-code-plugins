import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { runHook, sandbox, hookOut } from './helpers.mjs';

function bigFile(s, lines = 3000, name = 'big.js') {
  const p = join(s.cwd, name);
  writeFileSync(p, 'const x = 1;\n'.repeat(lines));
  return p;
}
const readPre = (s, file_path, extra = {}) => runHook('pre-tool-read.mjs', {
  ...s, hook_event_name: 'PreToolUse', tool_name: 'Read', tool_input: { file_path, ...extra } });
const readPost = (s, file_path, extra = {}) => runHook('post-tool-read.mjs', {
  ...s, hook_event_name: 'PostToolUse', tool_name: 'Read',
  tool_input: { file_path, ...extra }, tool_result: 'ok' });

test('the first two whole reads are silent', () => {
  const s = sandbox(); const f = bigFile(s);
  assert.equal(readPre(s, f).out, ''); readPost(s, f);
  assert.equal(readPre(s, f).out, ''); readPost(s, f);
});

test('the third whole read warns with additionalContext and does not deny', () => {
  const s = sandbox(); const f = bigFile(s);
  for (let i = 0; i < 2; i++) { readPre(s, f); readPost(s, f); }
  const o = hookOut(readPre(s, f));
  assert.equal(o.permissionDecision, undefined);
  assert.ok(o.additionalContext.includes('governor:'));
  assert.ok(o.additionalContext.includes('big.js'));
});

test('the fourth whole read denies a large file when enforce.reads is on', () => {
  const s = sandbox({ enforce: { reads: true } }); const f = bigFile(s);
  for (let i = 0; i < 3; i++) { readPre(s, f); readPost(s, f); }
  const o = hookOut(readPre(s, f));
  assert.equal(o.permissionDecision, 'deny');
  assert.ok(o.permissionDecisionReason.includes('read 3x in full'));
  assert.ok(o.permissionDecisionReason.includes('offset/limit'));
});

test('warn-only is the default: the fourth read warns instead of denying', () => {
  const s = sandbox(); const f = bigFile(s);
  for (let i = 0; i < 3; i++) { readPre(s, f); readPost(s, f); }
  const o = hookOut(readPre(s, f));
  assert.equal(o.permissionDecision, undefined);
  assert.ok(o.additionalContext.includes('read 3x in full'));
});

test('a file under largeFileLines is never denied', () => {
  const s = sandbox({ enforce: { reads: true } }); const f = bigFile(s, 10, 'small.js');
  for (let i = 0; i < 5; i++) { readPre(s, f); readPost(s, f); }
  assert.equal(hookOut(readPre(s, f)).permissionDecision, undefined);
});

test('reads with offset or limit always pass and are not counted', () => {
  const s = sandbox({ enforce: { reads: true } }); const f = bigFile(s);
  for (let i = 0; i < 6; i++) {
    assert.equal(readPre(s, f, { offset: 1, limit: 50 }).out, '');
    readPost(s, f, { offset: 1, limit: 50 });
  }
  assert.equal(readPre(s, f).out, '');
});

// un-skipped in Task 5, when user-prompt.mjs (which records the token) exists
test.skip('!reads=off disables denial for the session', () => {
  const s = sandbox({ enforce: { reads: true } }); const f = bigFile(s);
  runHook('user-prompt.mjs', { ...s, hook_event_name: 'UserPromptSubmit', prompt: 'carry on !reads=off' });
  for (let i = 0; i < 3; i++) { readPre(s, f); readPost(s, f); }
  assert.equal(hookOut(readPre(s, f)).permissionDecision, undefined);
});

test('the warning names knowledge graph symbols when a graph exists', () => {
  const s = sandbox(); const f = bigFile(s, 3000, 'game.js');
  mkdirSync(join(s.cwd, '.claude'), { recursive: true });
  writeFileSync(join(s.cwd, '.claude', 'knowledge_graph.json'), JSON.stringify({
    meta: { project: 'x' }, files: { 'game.js': { lines: 3000, symbols: ['start', 'tick'] } }, symbols: {}
  }));
  for (let i = 0; i < 2; i++) { readPre(s, f); readPost(s, f); }
  assert.ok(hookOut(readPre(s, f)).additionalContext.includes('start'));
});

test('a missing file does not throw', () => {
  const s = sandbox();
  assert.equal(readPre(s, join(s.cwd, 'gone.js')).code, 0);
});
