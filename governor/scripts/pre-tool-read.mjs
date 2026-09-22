#!/usr/bin/env node
import { isAbsolute, join } from 'node:path';
import { safeMain, pre } from './lib/io.mjs';
import { loadPolicy } from './lib/policy.mjs';
import { readState, updateState } from './lib/state.mjs';
import { claimRead } from './lib/reads.mjs';
import { loadKg, symbolsFor, memoriesFor, relPath, countLines } from './lib/kg.mjs';

await safeMain('pre-tool-read', async (input) => {
  if (input.tool_name !== 'Read') return null;
  const ti = input.tool_input || {};
  const path = ti.file_path;
  if (!path) return null;
  if (ti.offset !== undefined || ti.limit !== undefined) return null;  // partial reads always pass

  const policy = loadPolicy(input.cwd, input);
  const limit = (policy.reads && policy.reads.wholeFileLimit) || 3;

  // Race-safe: claims this read's ordinal atomically so N parallel Reads of the
  // same path in one assistant message each get a distinct count, rather than
  // all seeing the pre-burst count from a PostToolUse counter that hasn't run
  // yet. See lib/reads.mjs.
  const count = claimRead(input, path, input.tool_use_id);
  const seen = count - 1;  // whole reads of this path strictly before this one

  updateState(input, (s) => {
    const e = s.reads[path] || { full: 0, partial: 0 };
    e.full = Math.max(e.full, count);
    s.reads[path] = e;
  });

  if (seen < limit - 1) return null;

  const state = readState(input);
  const abs = isAbsolute(path) ? path : join(input.cwd || '.', path);
  const rel = relPath(input.cwd, path);
  const kg = loadKg(input.cwd, policy);
  const symbols = symbolsFor(kg, rel).slice(0, 10);
  const memories = memoriesFor(kg, rel).map((m) => m.title || m.path).slice(0, 5);
  const hint = [
    symbols.length ? `KG symbols: ${symbols.join(', ')}` : '',
    memories.length ? `memories: ${memories.join('; ')}` : ''
  ].filter(Boolean).join(' | ');

  if (seen === limit - 1) {
    updateState(input, (s) => { s.warnings += 1; });
    return pre({ additionalContext:
      `governor: ${rel} read ${seen}x in full already. Prefer offset/limit.${hint ? ' ' + hint : ''}` });
  }

  const large = countLines(abs) > ((policy.reads && policy.reads.largeFileLines) || 2000);
  const reason = `governor: ${rel} read ${limit}x in full; use offset/limit,` +
    ` or the KG symbols: ${symbols.join(', ') || '(none indexed)'}`;
  const enforcing = !!(policy.enforce && policy.enforce.reads === true);
  if (large && enforcing && !state.overrides.reads) {
    updateState(input, (s) => { s.denials += 1; });
    return pre({ permissionDecision: 'deny', permissionDecisionReason: reason });
  }
  updateState(input, (s) => { s.warnings += 1; });
  return pre({ additionalContext: reason + (memories.length ? ` | memories: ${memories.join('; ')}` : '') });
});
