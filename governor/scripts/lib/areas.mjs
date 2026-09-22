import { execFileSync } from 'node:child_process';
import { globToRegExp } from './glob.mjs';

/**
 * Maps one path to its area alias. A single `*` segment becomes a capture group
 * so `{1}` in the alias resolves, and a glob ending in `*` also matches files
 * below the matched directory.
 */
export function areaFor(policy, path) {
  const areas = (policy.memory && policy.memory.areas) || {};
  for (const [pattern, alias] of Object.entries(areas)) {
    const captured = pattern.replace(/\*\*/g, '\u0000').replace(/\*/g, '([^/]+)').replace(/\u0000/g, '.*');
    const m = new RegExp('^' + captured + (pattern.endsWith('*') ? '(?:/.*)?' : '') + '$').exec(path);
    if (m) return String(alias).replace(/\{(\d+)\}/g, (_, i) => m[Number(i)] || '');
    if (globToRegExp(pattern).test(path)) return String(alias).replace(/\{\d+\}/g, '');
  }
  return null;
}

export function areasFor(policy, paths) {
  const out = [];
  for (const p of paths || []) {
    const a = areaFor(policy, String(p).split('\\').join('/'));
    if (a && !out.includes(a)) out.push(a);
  }
  return out;
}

export function git(cwd, args) {
  return execFileSync('git', args,
    { cwd: cwd || '.', encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
}

export function gitBranch(cwd) {
  try { return git(cwd, ['rev-parse', '--abbrev-ref', 'HEAD']); } catch { return null; }
}

export function slug(branch) {
  return String(branch || 'no-branch').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/** Files the branch changed against its base, plus anything uncommitted. */
export function changedFiles(cwd) {
  const dirty = () => {
    try { return git(cwd, ['status', '--porcelain']).split('\n').map((l) => l.slice(3).trim()).filter(Boolean); }
    catch { return []; }
  };
  for (const base of ['origin/main', 'origin/master', 'main', 'master']) {
    try {
      const mb = git(cwd, ['merge-base', base, 'HEAD']);
      const names = git(cwd, ['diff', '--name-only', mb, 'HEAD']).split('\n');
      return [...new Set([...names, ...dirty()])].filter(Boolean);
    } catch { /* try the next base */ }
  }
  return dirty();
}
