import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sandbox } from './helpers.mjs';
import { defaults } from '../scripts/lib/policy.mjs';
import { loadKg, symbolsFor, memoriesFor, appendMemory } from '../scripts/lib/kg.mjs';

const KG = {
  meta: { project: 'x' },
  files: { 'src/game.js': { lines: 3000, symbols: ['start', 'tick'] } },
  symbols: { start: { file: 'src/game.js' }, tick: { file: 'src/game.js' } }
};

function withKg(kg = KG) {
  const s = sandbox();
  mkdirSync(join(s.cwd, '.claude'), { recursive: true });
  writeFileSync(join(s.cwd, '.claude', 'knowledge_graph.json'), JSON.stringify(kg));
  return s;
}
const read = (s) => JSON.parse(readFileSync(join(s.cwd, '.claude', 'knowledge_graph.json'), 'utf8'));

test('symbolsFor reads the file entry', () => {
  const s = withKg();
  assert.deepEqual(symbolsFor(loadKg(s.cwd, defaults()), 'src/game.js'), ['start', 'tick']);
});

test('appendMemory adds to meta-compatible graphs', () => {
  const s = withKg();
  const r = appendMemory(s.cwd, defaults(),
    { id: 'm1', scope: 'task', path: '.claude/memory/tasks/b/n.md', title: 'N',
      files: ['src/game.js'], symbols: ['tick'] }, s);
  assert.equal(r, 'ok');
  const kg = read(s);
  assert.equal(kg.memories.length, 1);
  assert.equal(kg.memories[0].id, 'm1');
  assert.ok(kg.memories[0].updatedAt);
  assert.deepEqual(Object.keys(kg.files), ['src/game.js']);
});

test('appending the same id replaces rather than duplicates', () => {
  const s = withKg();
  const e = { id: 'm1', scope: 'task', path: 'p', title: 'A', files: [], symbols: [] };
  appendMemory(s.cwd, defaults(), e, s);
  appendMemory(s.cwd, defaults(), { ...e, title: 'B' }, s);
  const kg = read(s);
  assert.equal(kg.memories.length, 1);
  assert.equal(kg.memories[0].title, 'B');
});

test('an unknown schemaVersion writes nothing and reports it', () => {
  const s = withKg({ ...KG, meta: { schemaVersion: '99' } });
  const before = readFileSync(join(s.cwd, '.claude', 'knowledge_graph.json'), 'utf8');
  assert.equal(appendMemory(s.cwd, defaults(), { id: 'm', path: 'p' }, s), 'unknown-schema');
  assert.equal(readFileSync(join(s.cwd, '.claude', 'knowledge_graph.json'), 'utf8'), before);
});

test('no graph at all is a skip, not a throw', () => {
  const s = sandbox();
  assert.equal(appendMemory(s.cwd, defaults(), { id: 'm', path: 'p' }, s), 'skipped');
});

test('memoriesFor finds entries attached to a file', () => {
  const s = withKg();
  appendMemory(s.cwd, defaults(),
    { id: 'm1', scope: 'area', path: '.claude/rules/web.md', title: 'Web rule',
      files: ['src/game.js'], symbols: [] }, s);
  const found = memoriesFor(loadKg(s.cwd, defaults()), 'src/game.js');
  assert.equal(found.length, 1);
  assert.equal(found[0].title, 'Web rule');
});
