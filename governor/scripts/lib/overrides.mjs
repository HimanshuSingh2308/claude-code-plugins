/**
 * Override-token matching shared by user-prompt.mjs (session overrides) and
 * lib/tier.mjs (the per-Agent-call !model= token).
 *
 * Claude Code treats a leading `!` as its run-a-shell-command shortcut only
 * when it is the very first character of the whole prompt box - so
 * `!cap=off ...` typed alone never reaches the hook. The fix is to accept the
 * token with or without its leading `!` (the recommended spelling drops it:
 * `governor cap=off`, a leading word so the shortcut cannot swallow it) and
 * to match it anywhere in the prompt, word-bounded so `model=` inside a code
 * block or a config literal is never mistaken for the token.
 */

function stripBang(token) {
  return String(token || '').replace(/^!/, '');
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** True if `token` (`!`-prefixed or not) appears at a word boundary in `text`. */
export function hasOverrideToken(text, token) {
  const t = escapeRe(stripBang(token));
  if (!t) return false;
  return new RegExp(`(?:^|\\s)!?${t}(?=\\s|$)`).test(String(text || ''));
}

/**
 * Extracts the value after a `model=`-style token (`!`-prefixed or not),
 * word-bounded before and after. Only `haiku|sonnet|opus|fable|[a-z0-9.-]+`
 * is accepted as the value, so a stray `model=` inside code is never matched
 * with an unintended value.
 */
export function findModelOverride(text, token) {
  const t = escapeRe(stripBang(token || 'model='));
  if (!t) return null;
  const re = new RegExp(`(?:^|\\s)!?${t}(haiku|sonnet|opus|fable|[a-z0-9.-]+)(?=\\s|$)`);
  const m = re.exec(String(text || ''));
  return m ? m[1] : null;
}
