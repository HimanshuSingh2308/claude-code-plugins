import { matchGlob } from './glob.mjs';

export const HARNESS_OPEN = '<!-- harness-rules -->';
export const HARNESS_CLOSE = '<!-- /harness-rules -->';
const PROMPT_SCAN = 400;

export function findOverride(policy, text) {
  const token = String(policy.override || '!model=').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = new RegExp(token + '([A-Za-z0-9._\\-]+)').exec(text || '');
  return m ? m[1] : null;
}

/**
 * Resolution order (spec section 1): subagent_type against agentTypes (exact, then
 * glob), then the first keyword group matching the description or the first 400
 * characters of the prompt, then defaultTier. An !model= token wins over everything.
 */
export function resolveTier(policy, call) {
  const type = call.subagent_type || '';
  const desc = call.description || '';
  const prompt = call.prompt || '';
  const haystack = (desc + ' ' + prompt.slice(0, PROMPT_SCAN)).toLowerCase();

  let tier = null;
  const types = policy.agentTypes || {};
  if (Object.prototype.hasOwnProperty.call(types, type)) tier = types[type];
  if (!tier) {
    for (const [pattern, t] of Object.entries(types)) {
      if (matchGlob(pattern, type)) { tier = t; break; }
    }
  }
  if (!tier) {
    for (const [t, words] of Object.entries(policy.keywords || {})) {
      if ((words || []).some((w) => haystack.includes(String(w).toLowerCase()))) { tier = t; break; }
    }
  }
  if (!tier) tier = policy.defaultTier || 'implement';

  const model = (policy.tiers || {})[tier];
  const forced = findOverride(policy, desc + ' ' + prompt);
  if (forced) return { tier, model: forced, override: true };
  return { tier, model, override: false };
}

export function replaceHarness(prompt, policy) {
  if (typeof prompt !== 'string') return prompt;
  const start = prompt.indexOf(HARNESS_OPEN);
  if (start === -1) return prompt;
  const end = prompt.indexOf(HARNESS_CLOSE, start);
  if (end === -1) return prompt;
  const line = policy.harnessSkill
    ? `Load the skill \`${policy.harnessSkill}\` before any browser or gate work.`
    : 'Load the skill named in governor.json harnessSkill before any browser or gate work.';
  return prompt.slice(0, start) + line + prompt.slice(end + HARNESS_CLOSE.length);
}
