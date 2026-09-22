import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { runHook, sandbox } from './helpers.mjs';
import { readState, updateState } from '../scripts/lib/state.mjs';

function bash(s, command) {
  return runHook('post-tool-bash.mjs', {
    ...s, hook_event_name: 'PostToolUse', tool_name: 'Bash',
    tool_input: { command }, tool_result: 'ok'
  });
}

test('a non-Bash tool is ignored', () => {
  assert.equal(runHook('post-tool-bash.mjs', {
    ...sandbox(), hook_event_name: 'PostToolUse', tool_name: 'Write',
    tool_input: { file_path: 'a' }, tool_result: 'ok'
  }).out, '');
});

test('credits a handoff written straight to disk by a Bash heredoc', () => {
  const s = sandbox();
  mkdirSync(join(s.cwd, 'docs/handoffs'), { recursive: true });
  writeFileSync(join(s.cwd, 'docs/handoffs/2026-09-22-preview-tt3d-all.md'), '# Handoff');

  assert.equal(bash(s, 'cat > docs/handoffs/2026-09-22-preview-tt3d-all.md <<EOF\n# Handoff\nEOF').out, '');
  assert.equal(readState(s).handoffWritten, true);
});

test('does nothing when no handoff exists on disk', () => {
  const s = sandbox();
  bash(s, 'npm test');
  assert.equal(readState(s).handoffWritten, false);
});

test('is a no-op once handoffWritten is already true - never scans the filesystem again', () => {
  const s = sandbox();
  updateState(s, (st) => { st.handoffWritten = true; });
  assert.equal(bash(s, 'anything').out, '');
  assert.equal(readState(s).handoffWritten, true);
});

test('prefers lastRepoDir over cwd when looking for the handoff dir', () => {
  const s = sandbox();
  const repo = mkdirSync(join(s.cwd, 'repo'), { recursive: true }) || join(s.cwd, 'repo');
  execFileSync('git', ['init', '-q'], { cwd: repo });
  mkdirSync(join(repo, 'docs/handoffs'), { recursive: true });
  writeFileSync(join(repo, 'docs/handoffs/2026-09-22-main.md'), '# Handoff');
  updateState(s, (st) => { st.lastRepoDir = repo; });

  assert.equal(bash(s, 'anything').out, '');
  assert.equal(readState(s).handoffWritten, true);
});

test('empty stdin exits 0 with no output', () => {
  const res = runHook('post-tool-bash.mjs', undefined);
  assert.equal(res.code, 0);
  assert.equal(res.out, '');
});
