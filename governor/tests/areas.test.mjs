import test from 'node:test';
import assert from 'node:assert/strict';
import { defaults } from '../scripts/lib/policy.mjs';
import { areasFor } from '../scripts/lib/areas.mjs';

const P = defaults();

test('a game path resolves to a per-directory area alias', () => {
  assert.deepEqual(areasFor(P, ['apps/web-astro/public/games/tiny-tycoon-3d/game.js']),
    ['games/tiny-tycoon-3d']);
});

test('api and web paths resolve to their flat aliases', () => {
  assert.deepEqual(
    areasFor(P, ['apps/api/src/main.ts', 'apps/web-astro/src/pages/index.astro']).sort(),
    ['api', 'web']);
});

test('areas are deduplicated', () => {
  assert.deepEqual(areasFor(P, ['apps/api/a.ts', 'apps/api/b.ts']), ['api']);
});

test('an unmatched path yields no area', () => {
  assert.deepEqual(areasFor(P, ['README.md']), []);
});
