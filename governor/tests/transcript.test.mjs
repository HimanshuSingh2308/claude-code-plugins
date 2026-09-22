import test from 'node:test';
import assert from 'node:assert/strict';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { countTranscript } from '../scripts/lib/transcript.mjs';

const F = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

test('counts two compactions and only main-chain assistant turns', () => {
  const r = countTranscript(join(F, 'transcript-two-compactions.jsonl'));
  assert.equal(r.compactions, 2);
  assert.equal(r.turns, 4);
});

test('a missing transcript counts zero and does not throw', () => {
  assert.deepEqual(countTranscript(join(F, 'nope.jsonl')), { turns: 0, compactions: 0 });
});

test('unparseable lines are skipped', () => {
  assert.equal(countTranscript(join(F, 'transcript-garbage.jsonl')).turns, 1);
});
