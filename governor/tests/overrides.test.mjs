import test from 'node:test';
import assert from 'node:assert/strict';
import { hasOverrideToken, findModelOverride } from '../scripts/lib/overrides.mjs';

test('hasOverrideToken matches the bang spelling', () => {
  assert.ok(hasOverrideToken('go on !cap=off now', '!cap=off'));
});

test('hasOverrideToken matches the bang-free spelling - the recommended one, since a leading', () => {
  // ! in the prompt box is Claude Code's run-a-shell-command shortcut.
  assert.ok(hasOverrideToken('governor cap=off', '!cap=off'));
  assert.ok(hasOverrideToken('cap=off', 'cap=off'));
});

test('hasOverrideToken requires a word boundary before the token', () => {
  assert.ok(!hasOverrideToken('handicap=off', 'cap=off'));
  assert.ok(!hasOverrideToken('nocap=off', 'cap=off'));
});

test('hasOverrideToken requires a word boundary after the token', () => {
  assert.ok(!hasOverrideToken('cap=offline', 'cap=off'));
});

test('hasOverrideToken matches at the very start of the prompt', () => {
  assert.ok(hasOverrideToken('cap=off please', 'cap=off'));
});

test('findModelOverride extracts the value, bang or no bang', () => {
  assert.equal(findModelOverride('go !model=opus now', '!model='), 'opus');
  assert.equal(findModelOverride('go model=opus now', '!model='), 'opus');
  assert.equal(findModelOverride('model=sonnet', 'model='), 'sonnet');
});

test('findModelOverride only matches model= at a word boundary, not inside code', () => {
  // No leading whitespace/start-of-prompt before "model=" here - e.g. it is
  // part of a longer identifier or a code fragment pasted into the prompt.
  assert.equal(findModelOverride('const xmodel=opus;', 'model='), null);
});

test('findModelOverride accepts an arbitrary lowercase model id, not only the four named ones', () => {
  assert.equal(findModelOverride('!model=claude-3-5-haiku', '!model='), 'claude-3-5-haiku');
});

test('findModelOverride returns null when there is no match', () => {
  assert.equal(findModelOverride('nothing to see here', '!model='), null);
});
