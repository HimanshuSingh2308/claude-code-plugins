import test from 'node:test';
import assert from 'node:assert/strict';
import { matchGlob } from '../scripts/lib/glob.mjs';

test('exact match', () => assert.equal(matchGlob('Explore', 'Explore'), true));
test('suffix star', () => assert.equal(matchGlob('*-reviewer', 'game-code-reviewer'), true));
test('prefix star', () => assert.equal(matchGlob('kg-*', 'kg-generator'), true));
test('no match', () => assert.equal(matchGlob('*-tester', 'game-builder'), false));
test('dots are literal', () => assert.equal(matchGlob('a.b', 'axb'), false));
test('double star crosses slashes', () =>
  assert.equal(matchGlob('apps/api/**', 'apps/api/src/main.ts'), true));
test('single star does not cross slashes', () =>
  assert.equal(matchGlob('apps/web/public/games/*', 'apps/web/public/games/tt3d/a.js'), false));
test('single star matches one segment', () =>
  assert.equal(matchGlob('apps/web/public/games/*', 'apps/web/public/games/tt3d'), true));
