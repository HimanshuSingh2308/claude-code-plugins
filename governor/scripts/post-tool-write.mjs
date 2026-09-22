#!/usr/bin/env node
import { safeMain } from './lib/io.mjs';
import { loadPolicy } from './lib/policy.mjs';
import { updateState } from './lib/state.mjs';
import { isUnderHandoff } from './lib/paths.mjs';

await safeMain('post-tool-write', async (input) => {
  if (input.tool_name !== 'Write' && input.tool_name !== 'Edit') return null;
  const ti = input.tool_input || {};
  const policy = loadPolicy(input.cwd, input);
  if (isUnderHandoff(ti.file_path, policy.session.handoffPath, input.cwd)) {
    updateState(input, (s) => { s.handoffWritten = true; });
  }
  return null;
});
