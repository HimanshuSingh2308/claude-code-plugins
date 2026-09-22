#!/usr/bin/env node
import { safeMain, pre, log } from './lib/io.mjs';
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
  const explicitModel = typeof call.model === 'string' && call.model.length > 0;
  const respectExplicit = policy.respectExplicitModel !== false;

  let rewriteModel = !override && !!model && call.model !== model;
  if (rewriteModel && respectExplicit && explicitModel) {
    // The cost lever: a dispatcher that already picked a model (e.g. an
    // explicit "opus" on a call whose prompt happens to match a lower tier's
    // keywords) keeps it. Set respectExplicitModel: false to force tier
    // models even over an explicit one.
    rewriteModel = false;
    log(`explicit model kept: ${call.model} (tier ${tier} would have used ${model})`, input);
  }
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
