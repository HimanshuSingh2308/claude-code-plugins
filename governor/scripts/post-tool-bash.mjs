#!/usr/bin/env node
// Credits a handoff written by Bash (a heredoc, `cp`, `mv`, ...): the
// Write/Edit PostToolUse hook never sees it, so state.handoffWritten stays
// false and the cap gate keeps denying everything even after the handoff
// exists. Rescanning the handoff dir on every Bash call is cheap (one
// readdir) and fail-open, so it is simpler and more robust than trying to
// parse the command text for the handoff path.
import { safeMain } from './lib/io.mjs';
import { loadPolicy } from './lib/policy.mjs';
import { readState, updateState } from './lib/state.mjs';
import { handoffOnDisk } from './lib/paths.mjs';

await safeMain('post-tool-bash', async (input) => {
  if (input.tool_name !== 'Bash') return null;
  const state = readState(input);
  if (state.handoffWritten) return null;

  const policy = loadPolicy(input.cwd, input);
  const baseDir = state.lastRepoDir || input.cwd;
  if (handoffOnDisk(baseDir, policy.session.handoffPath, null)) {
    updateState(input, (s) => { s.handoffWritten = true; });
  }
  return null;
});
