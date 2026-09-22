import test from 'node:test';
import assert from 'node:assert/strict';
import { defaults, merge } from '../scripts/lib/policy.mjs';
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

test('when several keyword groups match, the highest tier wins: implement over verify', () => {
  // "verify" (rank in verify/review/gate) and "fix" (rank in implement/debug)
  // both match; keywords is object-ordered verify, review, lookup, debug,
  // implement, so a first-match-wins scan would have picked "verify". The
  // priority order must win instead.
  assert.equal(resolveTier(P, { subagent_type: 'custom', description: 'verify and fix the build' }).tier,
    'implement');
});

test('when several keyword groups match, the highest tier wins: debug over lookup', () => {
  assert.equal(
    resolveTier(P, { subagent_type: 'custom', description: 'find and diagnose the root cause' }).tier,
    'debug');
});

test('when several keyword groups match, the highest tier wins: verify over lookup', () => {
  assert.equal(resolveTier(P, { subagent_type: 'custom', description: 'find and audit the gate' }).tier,
    'verify');
});

test('an agentTypes glob match beats a keyword match on the same call', () => {
  // "*-builder" -> implement by agentTypes glob; the description matches the
  // "verify" keyword group, which must not override the glob.
  const res = resolveTier(P, { subagent_type: 'custom-builder', description: 'verify the gate' });
  assert.equal(res.tier, 'implement');
  assert.equal(res.model, 'opus');
});

test('an exact agentTypes match also beats a keyword match', () => {
  const res = resolveTier(P, { subagent_type: 'Explore', description: 'please verify the gate' });
  assert.equal(res.tier, 'lookup');
});

test('a custom tier not in TIER_PRIORITY still resolves, ranked below the known tiers', () => {
  const custom = merge(P, { keywords: { verify: ['verify'], triage: ['triage'] } });
  // Both "verify" (known, ranked) and "triage" (unknown, unranked) match;
  // the known tier wins because an unranked tier sorts last.
  assert.equal(resolveTier(custom, { subagent_type: 'custom', description: 'triage and verify' }).tier, 'verify');
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
