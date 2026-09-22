import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { runHook, sandbox, hookOut, ROOT } from './helpers.mjs';

const FIXTURE = join(ROOT, 'tests', 'fixtures', 'transcript-two-compactions.jsonl');

function repo(policy) {
  const s = sandbox(policy);
  const git = (...a) => execFileSync('git', a, { cwd: s.cwd, stdio: 'ignore' });
  git('init', '-b', 'main');
  git('config', 'user.email', 't@t'); git('config', 'user.name', 't');
  writeFileSync(join(s.cwd, 'README.md'), 'x');
  git('add', '-A'); git('commit', '-m', 'init');
  git('checkout', '-b', 'feat/tt3d-art');
  mkdirSync(join(s.cwd, 'apps/api/src'), { recursive: true });
  writeFileSync(join(s.cwd, 'apps/api/src/main.ts'), 'x');
  git('add', '-A'); git('commit', '-m', 'api');
  return s;
}

test('SessionStart reports branch, task memory pointer, profile and effort', () => {
  const o = hookOut(runHook('session-start.mjs', {
    ...repo(), hook_event_name: 'SessionStart', reason: 'startup',
    model: 'claude-opus-5', effort: { level: 'medium' } }));
  assert.equal(o.hookEventName, 'SessionStart');
  assert.ok(o.additionalContext.includes('feat/tt3d-art'));
  assert.ok(o.additionalContext.includes('.claude/memory/tasks/feat-tt3d-art'));
  assert.ok(o.additionalContext.includes('profile default'));
  assert.ok(o.additionalContext.includes('effort medium'));
});

test('SessionStart names the touched areas and only the rule files that exist', () => {
  const s = repo();
  mkdirSync(join(s.cwd, '.claude/rules'), { recursive: true });
  writeFileSync(join(s.cwd, '.claude/rules/api.md'), '---\npaths: apps/api/**\n---\nrule');
  const o = hookOut(runHook('session-start.mjs', {
    ...s, hook_event_name: 'SessionStart', reason: 'startup', effort: { level: 'high' } }));
  assert.ok(o.additionalContext.includes('.claude/rules/api.md'));
  assert.ok(!o.additionalContext.includes('.claude/rules/web.md'));
});

test('SessionStart outside a git repo still returns context', () => {
  const o = hookOut(runHook('session-start.mjs', {
    ...sandbox(), hook_event_name: 'SessionStart', reason: 'startup' }));
  assert.ok(o.additionalContext.includes('governor'));
});

test('PreCompact stores the status for the next turn', () => {
  const s = sandbox();
  assert.equal(runHook('pre-compact.mjs', {
    ...s, hook_event_name: 'PreCompact', reason: 'auto', transcript_path: FIXTURE }).code, 0);
  const o = hookOut(runHook('user-prompt.mjs', {
    ...s, hook_event_name: 'UserPromptSubmit', prompt: 'next', effort: { level: 'medium' } }));
  assert.ok(o.additionalContext.includes('before compaction'));
});

test('the pending status is surfaced once, not every turn', () => {
  const s = sandbox();
  runHook('pre-compact.mjs', { ...s, hook_event_name: 'PreCompact', reason: 'auto', transcript_path: FIXTURE });
  runHook('user-prompt.mjs', { ...s, hook_event_name: 'UserPromptSubmit', prompt: 'a' });
  const second = hookOut(runHook('user-prompt.mjs', { ...s, hook_event_name: 'UserPromptSubmit', prompt: 'b' }));
  assert.ok(!second.additionalContext.includes('before compaction'));
});
