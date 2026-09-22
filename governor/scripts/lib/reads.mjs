import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { logDir } from './io.mjs';

function sanitize(id) {
  return String(id == null ? 'unknown' : id).replace(/[^A-Za-z0-9_-]/g, '_');
}

function pathHash(path) {
  return createHash('sha1').update(String(path)).digest('hex').slice(0, 20);
}

const MAX_ATTEMPTS = 64;

/**
 * Atomically claims this whole-file Read's 1-indexed ordinal for `path` within
 * the session.
 *
 * N Reads of one path issued in a single assistant message all run their
 * PreToolUse hooks before any PostToolUse hook can run, so a counter that is
 * only ever incremented in PostToolUse sees zero for all of them: the count
 * has to be race-safe at PreToolUse time instead.
 *
 * A plain "mkdirSync a uniquely-named marker, then readdirSync to count" is
 * not quite enough on its own: if several callers' mkdirs all land before any
 * of their readdirs run, every one of them can observe the same, too-low
 * count. Instead this claims the next free `<dir>/<n>` file with the `wx`
 * (O_CREAT|O_EXCL) flag - a single atomic filesystem operation for which the
 * OS guarantees exactly one concurrent caller wins a given `n` - so no two
 * concurrent calls can ever be handed the same ordinal. `readdirSync` is used
 * only as a cheap starting estimate for `n`, not as the source of truth.
 */
export function claimRead(input, path, label) {
  const dir = join(logDir(input), `governor-reads-${sanitize(input && input.session_id)}`, pathHash(path));
  mkdirSync(dir, { recursive: true });
  let start = 1;
  try { start = readdirSync(dir).length + 1; } catch { /* freshly created, nothing to list yet */ }
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const n = start + i;
    try {
      writeFileSync(join(dir, String(n)), String(label == null ? Date.now() : label), { flag: 'wx' });
      return n;
    } catch (err) {
      if (err && err.code === 'EEXIST') continue;
      throw err;
    }
  }
  // Never let a hook hang on contention: past MAX_ATTEMPTS, claim a slot well
  // past the live count rather than block. Correctness only needs a unique n;
  // this path is not expected to be exercised in practice.
  let live = start;
  try { live = readdirSync(dir).length + 1; } catch { /* ignore */ }
  const n = live + MAX_ATTEMPTS + Math.floor(Math.random() * 1000);
  writeFileSync(join(dir, String(n)), String(label == null ? Date.now() : label), { flag: 'w' });
  return n;
}
