import test from 'node:test';
import assert from 'node:assert/strict';
import { defaults } from '../scripts/lib/policy.mjs';
import { extractRefs, isMemoryPath, titleOf, memoryId } from '../scripts/lib/extract.mjs';

test('backticked paths become files', () => {
  const r = extractRefs('The bug is in `apps/api/src/main.ts` and `src/game.js`.');
  assert.deepEqual(r.files, ['apps/api/src/main.ts', 'src/game.js']);
});

test('CamelCase and snake_case tokens become symbols', () => {
  const r = extractRefs('`AchievementsController` calls `unlock_achievement` once.');
  assert.ok(r.symbols.includes('AchievementsController'));
  assert.ok(r.symbols.includes('unlock_achievement'));
});

test('a backticked path is not also a symbol', () => {
  assert.deepEqual(extractRefs('`apps/api/main.ts`').symbols, []);
});

test('isMemoryPath classifies the three scopes', () => {
  const P = defaults();
  assert.equal(isMemoryPath('.claude/rules/api.md', P), 'area');
  assert.equal(isMemoryPath('.claude/memory/tasks/feat-x/note.md', P), 'task');
  assert.equal(isMemoryPath('.claude/memory/archive/old.md', P), 'project');
  assert.equal(isMemoryPath('src/app.js', P), null);
});

test('the title is the first heading, else the file name', () => {
  assert.equal(titleOf('# Boat Jam pier grant\n\nbody', 'x.md'), 'Boat Jam pier grant');
  assert.equal(titleOf('no heading', '.claude/rules/api.md'), 'api');
});

test('the id is stable for a path and distinct between paths', () => {
  assert.equal(memoryId('.claude/rules/api.md'), memoryId('.claude/rules/api.md'));
  assert.notEqual(memoryId('.claude/rules/api.md'), memoryId('.claude/rules/web.md'));
});
