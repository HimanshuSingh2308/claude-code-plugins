import { dirname, isAbsolute, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';

/** Read-only or handoff-preserving git commands allowed through the cap gate. */
export const SAFE_BASH = ['git status', 'git diff', 'git log', 'git add', 'git commit'];

export function isSafeBash(command) {
  const c = String(command || '').trim();
  return SAFE_BASH.some((p) => c.startsWith(p));
}

/**
 * True when `path` names a file under `handoffPath`, wherever in the path it
 * falls - not just relative to the hook's own `cwd`. `cwd` drifts session to
 * session (a stdin `cwd` outside any worktree, a subagent in a different
 * directory), so pinning the check to "relative-to-cwd starts with
 * handoffPath" denies a real handoff file the moment cwd is wrong. Matching
 * the segment anywhere in the (possibly absolute) path is cwd-independent.
 */
export function isUnderHandoff(path, handoffPath) {
  if (!path) return false;
  const norm = String(path).split('\\').join('/');
  let seg = String(handoffPath || '').replace(/^\.\//, '');
  if (!seg) return false;
  if (!seg.endsWith('/')) seg += '/';
  return norm.includes(seg);
}

/** The git toplevel containing `dir`, or null outside any repo or on error. */
export function gitToplevel(dir) {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'],
      { cwd: dir || '.', encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch { return null; }
}

/** The git toplevel containing `filePath`'s directory, resolving a relative
 * `filePath` against `cwd` first. Null outside any repo - callers fall back
 * to `cwd` themselves. */
export function repoDirFor(cwd, filePath) {
  if (!filePath) return null;
  const abs = isAbsolute(filePath) ? filePath : join(cwd || '.', filePath);
  return gitToplevel(dirname(abs));
}

/**
 * Scans `<base><handoffPath>*.md` for a handoff already on disk - written by
 * a Bash heredoc, or before the plugin loaded this session, so no Write/Edit
 * PostToolUse hook ever saw it. Tries the git toplevel of `cwd` first (a
 * handoff is written from the worktree root, not wherever the hook's cwd
 * happens to be), then `cwd` itself.
 *
 * `sinceMs`, when given, requires the file's mtime to be at or after it (the
 * session's `capReachedAt`) so a stale handoff left over from an unrelated
 * past session is never credited. Null/undefined skips the recency check.
 * Fails open: any filesystem error is treated as "not found", never thrown.
 */
export function handoffOnDisk(cwd, handoffPath, sinceMs) {
  const seg = String(handoffPath || '').replace(/^\.\//, '');
  if (!seg) return null;
  const bases = [];
  const top = gitToplevel(cwd);
  if (top) bases.push(top);
  if (cwd && cwd !== top) bases.push(cwd);

  for (const base of bases) {
    const dir = join(base, seg);
    let entries;
    try { entries = readdirSync(dir); } catch { continue; }
    for (const name of entries) {
      if (!name.toLowerCase().endsWith('.md')) continue;
      const full = join(dir, name);
      try {
        const st = statSync(full);
        if (sinceMs == null || st.mtimeMs >= sinceMs) return full;
      } catch { /* file vanished between readdir and stat - skip it */ }
    }
  }
  return null;
}
