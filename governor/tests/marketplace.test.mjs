import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './helpers.mjs';

const mp = JSON.parse(readFileSync(join(ROOT, '..', '.claude-plugin', 'marketplace.json'), 'utf8'));
const plugin = JSON.parse(readFileSync(join(ROOT, '.claude-plugin', 'plugin.json'), 'utf8'));

test('governor is registered', () => {
  const e = mp.plugins.find((p) => p.name === 'governor');
  assert.ok(e, 'no governor entry');
  assert.equal(e.source, './governor');
  assert.equal(e.version, '0.1.2');
  assert.equal(e.version, plugin.version);
  assert.ok(e.description && e.description.length > 20);
  assert.ok(e.author && e.author.name);
  assert.equal(e.category, 'productivity');
  assert.ok(Array.isArray(e.tags) && e.tags.length >= 3);
});

test('the marketplace metadata version was bumped past 1.1.0', () => {
  const [maj, min] = mp.metadata.version.split('.').map(Number);
  assert.ok(maj > 1 || min >= 2, `metadata.version is ${mp.metadata.version}`);
});
