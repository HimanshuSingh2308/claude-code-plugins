#!/usr/bin/env node
// Backs /governor status. Prints the session state plus orphan memories as JSON.
import { existsSync } from 'node:fs';
import { join, isAbsolute } from 'node:path';
import { loadPolicy } from './lib/policy.mjs';
import { readState } from './lib/state.mjs';
import { loadKg } from './lib/kg.mjs';

const a = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = a.indexOf(`--${name}`);
  return i >= 0 && a[i + 1] ? a[i + 1] : fallback;
};
const cwd = arg('cwd', process.cwd());
const input = { session_id: arg('session', 'unknown'), scratchpad_dir: arg('scratchpad', undefined) };
const policy = loadPolicy(cwd, input);
const state = readState(input);

const kg = loadKg(cwd, policy);
const abs = (p) => (isAbsolute(p) ? p : join(cwd, p));
const orphanMemories = ((kg && kg.memories) || []).filter((m) => {
  if (m.path && !existsSync(abs(m.path))) return true;
  return Array.isArray(m.files) && m.files.some((f) => !existsSync(abs(f)));
}).map((m) => ({ id: m.id, path: m.path, title: m.title }));

process.stdout.write(JSON.stringify({
  turns: state.turns, compactions: state.compactions,
  maxTurns: policy.session.maxTurns, maxCompactions: policy.session.maxCompactions,
  profile: state.profile, effort: state.effort, effortDefault: policy.effort.default,
  rewrites: state.rewrites, denials: state.denials, warnings: state.warnings,
  overrides: state.overrides, capReached: state.capReached, handoffWritten: state.handoffWritten,
  enforce: policy.enforce, branch: state.branch, areas: state.areas,
  orphanMemories
}, null, 2));
