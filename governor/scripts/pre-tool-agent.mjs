#!/usr/bin/env node
import { safeMain, pre } from './lib/io.mjs';
import { loadPolicy } from './lib/policy.mjs';
import { updateState } from './lib/state.mjs';
import { resolveTier, replaceHarness } from './lib/tier.mjs';

await safeMain('pre-tool-agent', async (input) => {
  if (input.tool_name !== 'Agent' && input.tool_name !== 'Task') return null;
  const call = input.tool_input || {};
  const policy = loadPolicy(input.cwd, input);
  const { tier, model, override } = resolveTier(policy, call);

  const newPrompt = replaceHarness(call.prompt, policy);
  const harnessChanged = newPrompt !== call.prompt;
  const rewriteModel = !override && !!model && call.model !== model;
  if (!rewriteModel && !harnessChanged) return null;

  const updatedInput = { ...call };
  if (harnessChanged) updatedInput.prompt = newPrompt;
  if (rewriteModel) {
    updatedInput.model = model;
    updatedInput.prompt = `${updatedInput.prompt || ''}\n\ngovernor: tier ${tier} -> ${model}`.trim();
    updateState(input, (s) => { s.rewrites += 1; });
  }
  return pre({ updatedInput });
});
