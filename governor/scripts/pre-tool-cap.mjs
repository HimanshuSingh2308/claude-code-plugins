#!/usr/bin/env node
import { safeMain, pre } from './lib/io.mjs';
import { loadPolicy } from './lib/policy.mjs';
import { readState, updateState } from './lib/state.mjs';
import { isSafeBash, isUnderHandoff, handoffOnDisk } from './lib/paths.mjs';

await safeMain('pre-tool-cap', async (input) => {
  const policy = loadPolicy(input.cwd, input);
  if (!(policy.enforce && policy.enforce.cap === true)) return null;
  const state = readState(input);
  if (!state.capReached || state.overrides.cap) return null;

  let handoffDone = state.handoffWritten;
  if (!handoffDone) {
    // A handoff can exist on disk without state.handoffWritten ever being
    // set - a Bash heredoc, or a write from before the plugin loaded. Check
    // the filesystem itself before denying everything.
    const baseDir = state.lastRepoDir || input.cwd;
    if (handoffOnDisk(baseDir, policy.session.handoffPath, state.capReachedAt)) {
      handoffDone = true;
      updateState(input, (s) => { s.handoffWritten = true; });
    }
  }
  if (handoffDone) return null;

  const tool = input.tool_name;
  const ti = input.tool_input || {};
  if (tool === 'Read' || tool === 'Glob' || tool === 'Grep') return null;
  if ((tool === 'Write' || tool === 'Edit')
      && isUnderHandoff(ti.file_path, policy.session.handoffPath)) return null;
  if (tool === 'Bash' && isSafeBash(ti.command)) return null;

  return pre({
    permissionDecision: 'deny',
    permissionDecisionReason:
      `governor: session cap reached (turns ${state.turns}, compactions ${state.compactions}).` +
      ` Write the handoff under ${policy.session.handoffPath} and start a fresh session,` +
      ` or override with ${policy.session.override} in your next prompt.`
  });
});
