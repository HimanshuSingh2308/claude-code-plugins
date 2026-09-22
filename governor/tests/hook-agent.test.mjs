import test from 'node:test';
import assert from 'node:assert/strict';
import { runHook, sandbox, hookOut } from './helpers.mjs';
import { readState } from '../scripts/lib/state.mjs';

function call(tool_input, policy) {
  const s = sandbox(policy);
  return runHook('pre-tool-agent.mjs', {
    ...s, hook_event_name: 'PreToolUse',
    tool_name: 'Agent', tool_use_id: 'toolu_1', tool_input
  });
}

function callIn(s, tool_input) {
  return runHook('pre-tool-agent.mjs', {
    ...s, hook_event_name: 'PreToolUse', tool_name: 'Agent', tool_use_id: 'toolu_1', tool_input
  });
}

test('an Explore call with no model is rewritten to haiku', () => {
  const res = call({ subagent_type: 'Explore', description: 'look around', prompt: 'find X' });
  const o = hookOut(res);
  assert.equal(res.code, 0);
  assert.equal(o.hookEventName, 'PreToolUse');
  assert.equal(o.updatedInput.model, 'haiku');
  assert.ok(o.updatedInput.prompt.endsWith('governor: tier lookup -> haiku'));
  assert.equal(o.permissionDecision, undefined);
});

test('a call already on the tier model is left alone', () => {
  assert.equal(call({ subagent_type: 'Explore', model: 'haiku', prompt: 'find X' }).out, '');
});

test('an !model= override is honoured and nothing is rewritten', () => {
  assert.equal(call({ subagent_type: 'Explore', model: 'opus', prompt: 'find X !model=opus' }).out, '');
});

test('the harness block is replaced even when the model already matches', () => {
  const res = call({
    subagent_type: 'Explore', model: 'haiku',
    prompt: 'go\n<!-- harness-rules -->\nboilerplate\n<!-- /harness-rules -->\nend'
  }, { harnessSkill: 'tt3d-harness' });
  const o = hookOut(res);
  assert.ok(o.updatedInput.prompt.includes('Load the skill `tt3d-harness`'));
  assert.ok(!o.updatedInput.prompt.includes('boilerplate'));
});

test('respectExplicitModel (default true) keeps an explicit model even when the prompt' +
  ' matches a different tier\'s keywords', () => {
  const s = sandbox();
  const res = callIn(s, { subagent_type: 'custom', model: 'opus', description: 'verify the gate' });
  assert.equal(res.out, '', 'no rewrite, no output');
  assert.equal(readState(s).rewrites, 0);
});

test('respectExplicitModel: false restores the old rewrite-to-tier behaviour', () => {
  const s = sandbox({ respectExplicitModel: false });
  const res = callIn(s, { subagent_type: 'custom', model: 'opus', description: 'verify the gate' });
  const o = hookOut(res);
  assert.equal(o.updatedInput.model, 'sonnet');
  assert.ok(o.updatedInput.prompt.endsWith('governor: tier verify -> sonnet'));
  assert.equal(readState(s).rewrites, 1);
});

test('respectExplicitModel does not suppress the harness-block replacement', () => {
  const s = sandbox({ harnessSkill: 'tt3d-harness' });
  const res = callIn(s, {
    subagent_type: 'custom', model: 'opus', description: 'verify the gate',
    prompt: 'go\n<!-- harness-rules -->\nboilerplate\n<!-- /harness-rules -->\nend'
  });
  const o = hookOut(res);
  assert.ok(o.updatedInput.prompt.includes('Load the skill `tt3d-harness`'));
  assert.equal(o.updatedInput.model, 'opus', 'the explicit model passes through untouched, not rewritten to sonnet');
  assert.equal(readState(s).rewrites, 0);
});

test('an !model= override still wins even with an explicit call.model set', () => {
  const s = sandbox();
  const res = callIn(s, {
    subagent_type: 'custom', model: 'opus', description: 'verify the gate', prompt: 'go !model=haiku' });
  assert.equal(res.out, '', 'the override IS the explicit model already - nothing to rewrite');
});

test('a non Agent tool is ignored', () => {
  assert.equal(runHook('pre-tool-agent.mjs', {
    ...sandbox(), hook_event_name: 'PreToolUse', tool_name: 'Read', tool_input: { file_path: 'a' }
  }).out, '');
});

test('a malformed project policy fails open and still rewrites from defaults', () => {
  assert.equal(hookOut(call({ subagent_type: 'Explore', prompt: 'find X' }, '{ not json')).updatedInput.model, 'haiku');
});

test('empty stdin exits 0 with no output', () => {
  const res = runHook('pre-tool-agent.mjs', undefined);
  assert.equal(res.code, 0);
  assert.equal(res.out, '');
});
