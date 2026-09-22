#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { safeMain, sessionStart } from './lib/io.mjs';
import { loadPolicy } from './lib/policy.mjs';
import { readState, writeState } from './lib/state.mjs';
import { areasFor, gitBranch, slug, changedFiles } from './lib/areas.mjs';

await safeMain('session-start', async (input) => {
  const policy = loadPolicy(input.cwd, input);
  const state = readState(input);
  const cwd = input.cwd || '.';
  const branch = gitBranch(cwd);
  const areas = areasFor(policy, changedFiles(cwd));
  const effort = (input.effort && input.effort.level) || 'unknown';

  state.branch = branch; state.areas = areas; state.effort = effort;
  writeState(input, state);

  const lines = [`governor: branch ${branch || '(none)'} | profile ${state.profile}` +
    ` | effort ${effort} (policy default ${policy.effort.default})`];

  const taskDir = join(policy.memory.tasksDir, slug(branch));
  lines.push(existsSync(join(cwd, taskDir))
    ? `governor: task memory for this branch is ${taskDir}/ - read it before planning.`
    : `governor: task notes for this branch belong in ${taskDir}/ (not created yet).`);

  if (areas.length) {
    const rules = areas
      .map((a) => join(policy.memory.rulesDir, `${a.replace(/\//g, '-')}.md`))
      .filter((p) => existsSync(join(cwd, p)));
    lines.push(`governor: areas touched by this branch: ${areas.join(', ')}.` +
      (rules.length
        ? ` Rule files exist at ${rules.join(', ')}; they load on their own when a matching file is read.`
        : ' No area rule files exist yet.'));
  }

  if (effort !== 'unknown' && effort !== policy.effort.default) {
    lines.push(`governor: effort is ${effort}; the policy recommends ${policy.effort.default}.` +
      ' Effort is per session, set with /effort.');
  }

  return sessionStart({ additionalContext: lines.join('\n') });
});
