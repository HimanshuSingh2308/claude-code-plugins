#!/usr/bin/env node
import { safeMain, pre } from './lib/io.mjs';
import { loadPolicy } from './lib/policy.mjs';
import { readState } from './lib/state.mjs';
import { isSafeBash, isUnderHandoff } from './lib/paths.mjs';

await safeMain('pre-tool-cap', async (input) => {
  const policy = loadPolicy(input.cwd, input);
  if (!(policy.enforce && policy.enforce.cap === true)) return null;
  const state = readState(input);
  if (!state.capReached || state.handoffWritten || state.overrides.cap) return null;

  const tool = input.tool_name;
  const ti = input.tool_input || {};
  if (tool === 'Read' || tool === 'Glob' || tool === 'Grep') return null;
  if ((tool === 'Write' || tool === 'Edit')
      && isUnderHandoff(ti.file_path, policy.session.handoffPath, input.cwd)) return null;
  if (tool === 'Bash' && isSafeBash(ti.command)) return null;

  return pre({
    permissionDecision: 'deny',
    permissionDecisionReason:
      `governor: session cap reached (turns ${state.turns}, compactions ${state.compactions}).` +
      ` Write the handoff under ${policy.session.handoffPath} and start a fresh session,` +
      ` or override with ${policy.session.override} in your next prompt.`
  });
});
