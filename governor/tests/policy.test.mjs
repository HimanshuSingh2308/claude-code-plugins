import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadPolicy } from '../scripts/lib/policy.mjs';

function project(json) {
  const dir = mkdtempSync(join(tmpdir(), 'gov-policy-'));
  mkdirSync(join(dir, '.claude'), { recursive: true });
  if (json !== null) writeFileSync(join(dir, '.claude', 'governor.json'), json);
  return dir;
}

test('no project file yields defaults', () => {
  const p = loadPolicy(project(null));
  assert.equal(p.tiers.explore, 'haiku');
  assert.equal(p.defaultTier, 'implement');
  assert.equal(p.enforce.reads, false);
  assert.equal(p.enforce.cap, true);
});

test('a three line project file merges over defaults', () => {
  const p = loadPolicy(project('{"tiers":{"explore":"sonnet"},"harnessSkill":"tt3d-harness"}'));
  assert.equal(p.tiers.explore, 'sonnet');
  assert.equal(p.tiers.implement, 'opus');
  assert.equal(p.harnessSkill, 'tt3d-harness');
  assert.equal(p.reads.wholeFileLimit, 3);
});

test('arrays replace rather than concatenate', () => {
  const p = loadPolicy(project('{"effort":{"raiseFor":["debug"]}}'));
  assert.deepEqual(p.effort.raiseFor, ['debug']);
  assert.equal(p.effort.default, 'medium');
});

test('malformed project policy fails open to defaults', () => {
  const p = loadPolicy(project('{ this is not json'));
  assert.equal(p.defaultTier, 'implement');
});
