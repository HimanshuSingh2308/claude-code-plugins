import { isAbsolute, relative } from 'node:path';

/** Read-only or handoff-preserving git commands allowed through the cap gate. */
export const SAFE_BASH = ['git status', 'git diff', 'git log', 'git add', 'git commit'];

export function isSafeBash(command) {
  const c = String(command || '').trim();
  return SAFE_BASH.some((p) => c.startsWith(p));
}

export function isUnderHandoff(path, handoffPath, cwd) {
  if (!path) return false;
  const norm = (isAbsolute(path) && cwd ? relative(cwd, path) : path).split('\\').join('/');
  return norm.startsWith(String(handoffPath).replace(/^\.\//, ''));
}
