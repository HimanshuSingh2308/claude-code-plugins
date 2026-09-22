#!/usr/bin/env node
// Backs /governor status. Prints the session state plus orphan memories as JSON.
//
// Self-locating: the command only ever knows the scratchpad directory it was
// given in its own system prompt, not the session id. In an interactive
// session the harness lays the scratchpad out as `<root>/<session_id>/scratchpad`
// (see README.md "Harness contract this plugin relies on"), so the session id
// is the scratchpad path's parent directory name. When that guess does not
// match an actual state file - a different harness layout, `claude -p`, or a
// stale scratchpad - this falls back to the newest `governor-*.json` in the
// scratchpad directory, then the newest one in os.tmpdir(). An explicit
// --session always wins and is used as-is, matching the pre-0.1.1 contract.
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, isAbsolute, dirname, basename } from 'node:path';
import { tmpdir } from 'node:os';
import { loadPolicy } from './lib/policy.mjs';
import { readState } from './lib/state.mjs';
import { loadKg } from './lib/kg.mjs';

const a = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = a.indexOf(`--${name}`);
  return i >= 0 && a[i + 1] ? a[i + 1] : fallback;
};
const cwd = arg('cwd', process.cwd());
const scratchpad = arg('scratchpad', undefined);
const explicitSession = arg('session', undefined);

function sessionIdFromScratchpad(dir) {
  // layout: <root>/<session_id>/scratchpad
  if (!dir) return undefined;
  const id = basename(dirname(dir));
  return id && id !== '.' && id !== '/' ? id : undefined;
}

function newestGovernorFile(dir) {
  if (!dir) return undefined;
  try {
    let best, bestTime = -1;
    for (const f of readdirSync(dir)) {
      if (!/^governor-.+\.json$/.test(f)) continue;
      const t = statSync(join(dir, f)).mtimeMs;
      if (t > bestTime) { bestTime = t; best = f; }
    }
    return best;
  } catch { return undefined; }
}

function idFromFilename(name) {
  const m = name && name.match(/^governor-(.+)\.json$/);
  return m ? m[1] : undefined;
}

let sessionId = explicitSession;
let stateDir = scratchpad;
let located = !!explicitSession;

if (!sessionId && scratchpad) {
  const derived = sessionIdFromScratchpad(scratchpad);
  if (derived && existsSync(join(scratchpad, `governor-${derived}.json`))) {
    sessionId = derived; located = true;
  } else {
    const newest = newestGovernorFile(scratchpad);
    if (newest) { sessionId = idFromFilename(newest); located = true; }
  }
}
if (!sessionId) {
  const td = tmpdir();
  const newest = newestGovernorFile(td);
  if (newest) { sessionId = idFromFilename(newest); stateDir = td; located = true; }
}

if (!located) {
  const looked = [scratchpad, tmpdir()].filter(Boolean).join(' and ');
  process.stdout.write(
    `governor: no session state file found (looked in ${looked || 'os.tmpdir()'}).` +
    ' Pass --session <id> if you know it, or --scratchpad <dir> for the scratchpad' +
    ' directory named in the system prompt.\n'
  );
  process.exit(0);
}

const input = { session_id: sessionId, scratchpad_dir: stateDir };
const policy = loadPolicy(cwd, input);
const state = readState(input);

const kg = loadKg(cwd, policy);
const abs = (p) => (isAbsolute(p) ? p : join(cwd, p));
const orphanMemories = ((kg && kg.memories) || []).filter((m) => {
  if (m.path && !existsSync(abs(m.path))) return true;
  return Array.isArray(m.files) && m.files.some((f) => !existsSync(abs(f)));
}).map((m) => ({ id: m.id, path: m.path, title: m.title }));

process.stdout.write(JSON.stringify({
  sessionId, turns: state.turns, compactions: state.compactions,
  maxTurns: policy.session.maxTurns, maxCompactions: policy.session.maxCompactions,
  profile: state.profile, effort: state.effort, effortDefault: policy.effort.default,
  rewrites: state.rewrites, denials: state.denials, warnings: state.warnings,
  overrides: state.overrides, capReached: state.capReached, handoffWritten: state.handoffWritten,
  enforce: policy.enforce, branch: state.branch, areas: state.areas,
  orphanMemories
}, null, 2));
