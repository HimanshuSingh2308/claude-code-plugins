// Shared self-locating logic for the command-backing scripts (status.mjs,
// override.mjs) that only ever know a scratchpad directory, not a session
// id - see README.md "Harness contract this plugin relies on" and
// status.mjs's own header comment for the layout this relies on.
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { tmpdir } from 'node:os';

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

/**
 * Locates a session's state file from `{ cwd, scratchpad, session }`.
 * `session` (an explicit --session) always wins and is used as-is. Failing
 * that: derive the session id from the scratchpad path's parent directory
 * name (the interactive-session layout); failing that, the newest
 * governor-*.json in the scratchpad directory; failing that, the newest one
 * in os.tmpdir().
 *
 * Returns `{ sessionId, stateDir, located }`. `located: false` means no
 * state file could be found anywhere.
 */
export function locateSession({ cwd, scratchpad, session } = {}) {
  let sessionId = session;
  let stateDir = scratchpad;
  let located = !!session;

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

  return { sessionId, stateDir, located };
}
