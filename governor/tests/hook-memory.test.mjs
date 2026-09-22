import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runHook, sandbox } from './helpers.mjs';

function withKg() {
  const s = sandbox();
  mkdirSync(join(s.cwd, '.claude/rules'), { recursive: true });
  writeFileSync(join(s.cwd, '.claude/knowledge_graph.json'), JSON.stringify({
    meta: { project: 'x' },
    files: { 'apps/api/src/main.ts': { lines: 10, symbols: ['bootstrap'] } },
    symbols: { bootstrap: { file: 'apps/api/src/main.ts' } }
  }));
  return s;
}
const kgOf = (s) => JSON.parse(readFileSync(join(s.cwd, '.claude/knowledge_graph.json'), 'utf8'));

function write(s, rel, content) {
  writeFileSync(join(s.cwd, rel), content);
  return runHook('post-tool-write.mjs', {
    ...s, hook_event_name: 'PostToolUse', tool_name: 'Write',
    tool_input: { file_path: join(s.cwd, rel), content }, tool_result: 'ok' });
}

test('writing an area rule appends a memories entry checked against the graph', () => {
  const s = withKg();
  write(s, '.claude/rules/api.md',
    '# Api rules\n\nThe entry point is `apps/api/src/main.ts`, symbol `bootstrap`, and `NotIndexed`.');
  const m = kgOf(s).memories;
  assert.equal(m.length, 1);
  assert.equal(m[0].scope, 'area');
  assert.equal(m[0].title, 'Api rules');
  assert.deepEqual(m[0].files, ['apps/api/src/main.ts']);
  assert.deepEqual(m[0].symbols, ['bootstrap']);
});

test('writing an ordinary source file indexes nothing', () => {
  const s = withKg();
  mkdirSync(join(s.cwd, 'src'), { recursive: true });
  write(s, 'src/app.js', 'const a = 1;');
  assert.equal(kgOf(s).memories, undefined);
});

test('the indexer never throws when there is no graph', () => {
  const s = sandbox();
  mkdirSync(join(s.cwd, '.claude/rules'), { recursive: true });
  assert.equal(write(s, '.claude/rules/api.md', '# x').code, 0);
});

test('rewriting the same memory replaces its entry', () => {
  const s = withKg();
  write(s, '.claude/rules/api.md', '# One\n');
  write(s, '.claude/rules/api.md', '# Two\n');
  const m = kgOf(s).memories;
  assert.equal(m.length, 1);
  assert.equal(m[0].title, 'Two');
});
