import { matchGlob } from './glob.mjs';
import { findModelOverride } from './overrides.mjs';

export const HARNESS_OPEN = '<!-- harness-rules -->';
export const HARNESS_CLOSE = '<!-- /harness-rules -->';
const PROMPT_SCAN = 400;

/** Highest tier wins when several keyword groups match the same text: writing
 * and root-causing code outrank checking it, which outranks finding it. A
 * tier absent from this list (a project's custom keyword group) ranks last. */
export const TIER_PRIORITY = ['implement', 'debug', 'verify', 'review', 'gate', 'lookup', 'explore'];

export function findOverride(policy, text) {
  return findModelOverride(text, policy.override || '!model=');
}

function tierRank(t) {
  const i = TIER_PRIORITY.indexOf(t);
  return i === -1 ? TIER_PRIORITY.length : i;
}

/**
 * Resolution order (spec section 1): subagent_type against agentTypes (exact, then
 * glob) - which always beats keywords - then the highest-priority keyword group
 * matching the description or the first 400 characters of the prompt (see
 * TIER_PRIORITY: several groups can match the same text, and implement/debug
 * must win over verify/review/gate, which must win over lookup/explore), then
 * defaultTier. An !model= token wins over everything.
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
    let best = null;
    for (const [t, words] of Object.entries(policy.keywords || {})) {
      if (!(words || []).some((w) => haystack.includes(String(w).toLowerCase()))) continue;
      if (best === null || tierRank(t) < tierRank(best)) best = t;
    }
    tier = best;
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
