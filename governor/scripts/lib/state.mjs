import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { logDir, log } from './io.mjs';

export function statePath(input) {
  const id = (input && input.session_id) || 'unknown';
  return join(logDir(input), `governor-${String(id).replace(/[^A-Za-z0-9_-]/g, '_')}.json`);
}

export function freshState(input) {
  return {
    sessionId: (input && input.session_id) || 'unknown',
    turns: 0, compactions: 0, reads: {},
    rewrites: 0, denials: 0, warnings: 0,
    overrides: { model: false, reads: false, cap: false },
    capReached: false, handoffWritten: false,
    profile: 'default', baselinePlugins: null,
    effort: null, branch: null, areas: [], pendingStatus: null
  };
}

export function readState(input) {
  const base = freshState(input);
  try {
    const s = JSON.parse(readFileSync(statePath(input), 'utf8'));
    return { ...base, ...s, overrides: { ...base.overrides, ...(s.overrides || {}) } };
  } catch (err) {
    if (err && err.code !== 'ENOENT') log(`state: ${err.message}`, input);
    return base;
  }
}

export function writeState(input, state) {
  try {
    mkdirSync(logDir(input), { recursive: true });
    writeFileSync(statePath(input), JSON.stringify(state));
  } catch (err) { log(`state write: ${err.message}`, input); }
  return state;
}

export function updateState(input, fn) {
  const s = readState(input);
  fn(s);
  return writeState(input, s);
}
