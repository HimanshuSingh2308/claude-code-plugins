#!/usr/bin/env node
import { isAbsolute, join } from 'node:path';
import { safeMain, pre } from './lib/io.mjs';
import { loadPolicy } from './lib/policy.mjs';
import { readState, updateState } from './lib/state.mjs';
import { loadKg, symbolsFor, memoriesFor, relPath, countLines } from './lib/kg.mjs';

await safeMain('pre-tool-read', async (input) => {
  if (input.tool_name !== 'Read') return null;
  const ti = input.tool_input || {};
  const path = ti.file_path;
  if (!path) return null;
  if (ti.offset !== undefined || ti.limit !== undefined) return null;  // partial reads always pass

  const policy = loadPolicy(input.cwd, input);
  const state = readState(input);
  const seen = (state.reads[path] || { full: 0 }).full;
  const limit = (policy.reads && policy.reads.wholeFileLimit) || 3;
  if (seen < limit - 1) return null;

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
