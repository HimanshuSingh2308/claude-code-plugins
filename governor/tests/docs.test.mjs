import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './helpers.mjs';

test('the command file has frontmatter with a description and argument-hint', () => {
  const src = readFileSync(join(ROOT, 'commands', 'governor.md'), 'utf8');
  assert.ok(src.startsWith('---\n'));
  assert.match(src, /^description:/m);
  assert.match(src, /^argument-hint:/m);
  for (const sub of ['status', 'profile', 'memory fold', 'task fold', 'handoff']) {
    assert.ok(src.includes(sub), `missing subcommand ${sub}`);
  }
});

test('the command never tells the model to apply a fold without approval', () => {
  const src = readFileSync(join(ROOT, 'commands', 'governor.md'), 'utf8');
  assert.ok(src.includes('--approved'));
  assert.ok(/approv/i.test(src));
});

test('the skill has name and description frontmatter', () => {
  const src = readFileSync(join(ROOT, 'skills', 'governor-rules', 'SKILL.md'), 'utf8');
  assert.ok(src.startsWith('---\n'));
  assert.match(src, /^name: governor-rules$/m);
  assert.match(src, /^description:/m);
});

test('the README records the harness contract shapes the hooks rely on', () => {
  const src = readFileSync(join(ROOT, 'README.md'), 'utf8');
  for (const k of ['updatedInput', 'permissionDecision', 'additionalContext', 'systemMessage',
    'hookSpecificOutput', 'scratchpad_dir', 'transcript_path', 'compact_boundary']) {
    assert.ok(src.includes(k), `README does not record ${k}`);
  }
});

test('every hook script named in hooks.json exists', () => {
  const hooks = JSON.parse(readFileSync(join(ROOT, 'hooks', 'hooks.json'), 'utf8'));
  const cmds = JSON.stringify(hooks).match(/scripts\/[a-z-]+\.mjs/g) || [];
  assert.ok(cmds.length >= 8, `expected at least 8 registrations, found ${cmds.length}`);
  for (const c of cmds) assert.ok(existsSync(join(ROOT, c)), `${c} is registered but missing`);
});

test('every hook command is invoked through CLAUDE_PLUGIN_ROOT', () => {
  const raw = readFileSync(join(ROOT, 'hooks', 'hooks.json'), 'utf8');
  const hooks = JSON.parse(raw);
  for (const entries of Object.values(hooks.hooks)) {
    for (const e of entries) for (const h of e.hooks) {
      assert.ok(h.command.includes('${CLAUDE_PLUGIN_ROOT}'), h.command);
    }
  }
});
