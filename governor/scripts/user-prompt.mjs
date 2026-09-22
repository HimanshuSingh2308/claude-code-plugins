#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { safeMain, prompt as promptOut } from './lib/io.mjs';
import { loadPolicy } from './lib/policy.mjs';
import { readState, writeState } from './lib/state.mjs';
import { countTranscript } from './lib/transcript.mjs';
import { hasOverrideToken, findModelOverride } from './lib/overrides.mjs';
import { handoffOnDisk } from './lib/paths.mjs';

export function branchSlug(cwd) {
  try {
    const b = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'],
      { cwd: cwd || '.', encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    return b.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'detached';
  } catch { return 'no-branch'; }
}

export function statusLine(s) {
  return `governor: turns ${s.turns} | compactions ${s.compactions} | profile ${s.profile}` +
    ` | effort ${s.effort || 'unknown'} | rewrites ${s.rewrites} | denials ${s.denials}`;
}

await safeMain('user-prompt', async (input) => {
  const policy = loadPolicy(input.cwd, input);
  const state = readState(input);
  const text = String(input.prompt || '');

  const counts = countTranscript(input.transcript_path);
  state.turns = counts.turns;
  state.compactions = counts.compactions;
  state.effort = (input.effort && input.effort.level) || state.effort;

  if (hasOverrideToken(text, (policy.reads && policy.reads.override) || '!reads=off')) state.overrides.reads = true;
  if (hasOverrideToken(text, (policy.session && policy.session.override) || '!cap=off')) state.overrides.cap = true;
  if (findModelOverride(text, policy.override || '!model=')) state.overrides.model = true;

  const lines = [];
  if (state.pendingStatus) { lines.push(state.pendingStatus); state.pendingStatus = null; }
  let status = statusLine(state);
  const active = Object.entries(state.overrides).filter(([, v]) => v).map(([k]) => k);
  if (active.length) status += ` | overrides: ${active.join(', ')}`;
  lines.push(status);

  const raise = (policy.effort && policy.effort.raiseFor) || [];
  const low = text.toLowerCase();
  const hit = raise.find((w) => low.includes(String(w).toLowerCase()));
  if (hit) {
    lines.push(`governor: this looks like ${hit} work; effort is ${state.effort || 'unknown'}` +
      ` and the policy default is ${policy.effort.default}.` +
      ' Effort is per session: raise it with /effort if you need to.');
  }

  const maxTurns = policy.session.maxTurns;
  const maxComp = policy.session.maxCompactions;
  if ((state.turns >= maxTurns || state.compactions >= maxComp)
      && !state.handoffWritten && !state.overrides.cap) {
    if (!state.capReached) { state.capReached = true; state.capReachedAt = Date.now(); }

    // A handoff can land on disk without ever going through the Write/Edit
    // PostToolUse hook - a Bash heredoc, or a write from before the plugin
    // loaded this session. Credit it here too, not only in the cap gate, so
    // the status line stops asking for a handoff that already exists.
    const baseDir = state.lastRepoDir || input.cwd;
    if (handoffOnDisk(baseDir, policy.session.handoffPath, state.capReachedAt)) {
      state.handoffWritten = true;
    } else {
      const date = new Date().toISOString().slice(0, 10);
      const file = `${policy.session.handoffPath}${date}-${branchSlug(baseDir)}.md`;
      lines.push(`governor: session cap reached (turns ${state.turns}/${maxTurns},` +
        ` compactions ${state.compactions}/${maxComp}). Stop the current work and write the handoff` +
        ` to ${file} from the template at ${'${CLAUDE_PLUGIN_ROOT}'}/templates/handoff.md,` +
        ` then start a fresh session. Override with ${policy.session.override}.`);
    }
  }

  writeState(input, state);
  return promptOut({ additionalContext: lines.join('\n') });
});
