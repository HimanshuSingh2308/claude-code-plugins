#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { safeMain } from './lib/io.mjs';
import { loadPolicy } from './lib/policy.mjs';
import { updateState } from './lib/state.mjs';
import { isUnderHandoff, repoDirFor } from './lib/paths.mjs';
import { loadKg, appendMemory, relPath } from './lib/kg.mjs';
import { extractRefs, isMemoryPath, titleOf, memoryId } from './lib/extract.mjs';

await safeMain('post-tool-write', async (input) => {
  if (input.tool_name !== 'Write' && input.tool_name !== 'Edit') return null;
  const ti = input.tool_input || {};
  const policy = loadPolicy(input.cwd, input);

  const repoDir = repoDirFor(input.cwd, ti.file_path);
  if (repoDir) updateState(input, (s) => { s.lastRepoDir = repoDir; });

  if (isUnderHandoff(ti.file_path, policy.session.handoffPath)) {
    updateState(input, (s) => { s.handoffWritten = true; });
  }

  const rel = relPath(input.cwd, ti.file_path);
  const scope = isMemoryPath(rel, policy);
  if (!scope) return null;
  const kg = loadKg(input.cwd, policy);
  if (!kg) return null;

  let body = ti.content;
  if (body === undefined) { try { body = readFileSync(ti.file_path, 'utf8'); } catch { body = ''; } }
  const refs = extractRefs(body);
  const knownFiles = kg.files ? Object.keys(kg.files) : [];
  const knownSymbols = kg.symbols ? Object.keys(kg.symbols) : [];
  appendMemory(input.cwd, policy, {
    id: memoryId(rel), scope, path: rel, title: titleOf(body, rel),
    files: refs.files.filter((f) => knownFiles.includes(f)),
    symbols: refs.symbols.filter((sym) => knownSymbols.includes(sym))
  }, input);
  return null;
});
