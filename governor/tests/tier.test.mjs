import test from 'node:test';
import assert from 'node:assert/strict';
import { defaults } from '../scripts/lib/policy.mjs';
import { resolveTier, replaceHarness } from '../scripts/lib/tier.mjs';

const P = defaults();

test('by agent type, exact', () => {
  assert.deepEqual(resolveTier(P, { subagent_type: 'Explore' }),
    { tier: 'lookup', model: 'haiku', override: false });
});

test('by agent type, glob', () => {
  assert.equal(resolveTier(P, { subagent_type: 'game-code-reviewer' }).tier, 'review');
  assert.equal(resolveTier(P, { subagent_type: 'kg-generator' }).model, 'haiku');
});

test('by keyword in the description when the type is unknown', () => {
  assert.equal(resolveTier(P, { subagent_type: 'custom', description: 'Verify the gate' }).tier, 'verify');
  assert.equal(resolveTier(P, { subagent_type: 'custom', description: 'find the caller' }).tier, 'lookup');
});

test('by keyword in the first 400 characters of the prompt only', () => {
  const pad = 'x'.repeat(420);
  assert.equal(resolveTier(P, { subagent_type: 'custom', prompt: 'please diagnose this' }).tier, 'debug');
  assert.equal(resolveTier(P, { subagent_type: 'custom', prompt: pad + ' diagnose' }).tier, 'implement');
});

test('unclassified falls back to the default tier, never downgraded', () => {
  assert.deepEqual(resolveTier(P, { subagent_type: 'custom', prompt: 'do the thing' }),
    { tier: 'implement', model: 'opus', override: false });
});

test('an !model= token wins over everything', () => {
  assert.deepEqual(resolveTier(P, { subagent_type: 'Explore', prompt: 'go !model=opus now' }),
    { tier: 'lookup', model: 'opus', override: true });
});

test('replaceHarness swaps the marked block for the skill line', () => {
  const p = 'a\n<!-- harness-rules -->\nlots\nof\nboilerplate\n<!-- /harness-rules -->\nb';
  const out = replaceHarness(p, { ...P, harnessSkill: 'tt3d-harness' });
  assert.equal(out, 'a\nLoad the skill `tt3d-harness` before any browser or gate work.\nb');
  assert.ok(!out.includes('boilerplate'));
});

test('replaceHarness without a configured skill uses the generic line', () => {
  assert.equal(replaceHarness('<!-- harness-rules -->x<!-- /harness-rules -->', P),
    'Load the skill named in governor.json harnessSkill before any browser or gate work.');
});

test('replaceHarness leaves an unmarked prompt untouched', () => {
  assert.equal(replaceHarness('plain', P), 'plain');
});
