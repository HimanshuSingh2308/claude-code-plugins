#!/usr/bin/env node
import { safeMain } from './lib/io.mjs';
import { readState, writeState } from './lib/state.mjs';
import { countTranscript } from './lib/transcript.mjs';

await safeMain('pre-compact', async (input) => {
  const state = readState(input);
  const counts = countTranscript(input.transcript_path);
  state.turns = counts.turns;
  state.compactions = counts.compactions;
  state.pendingStatus =
    `governor: before compaction (${input.trigger || input.reason || 'auto'}) - turns ${state.turns}` +
    ` | compactions ${state.compactions} | profile ${state.profile}` +
    ` | rewrites ${state.rewrites} | denials ${state.denials}` +
    (state.branch ? ` | branch ${state.branch}` : '');
  writeState(input, state);
  return null;
});
