import { createHash } from 'node:crypto';
import { basename } from 'node:path';

const PATHY = /[\\/]|\.[a-z]{1,5}$/i;

/** Pulls backticked paths and CamelCase / snake_case symbol tokens out of a memory body. */
export function extractRefs(body) {
  const text = String(body || '');
  const files = [];
  const symbols = [];
  for (const m of text.matchAll(/`([^`\n]+)`/g)) {
    const tok = m[1].trim();
    if (PATHY.test(tok) && !/\s/.test(tok)) { if (!files.includes(tok)) files.push(tok); continue; }
    // A backticked identifier is an explicit symbol reference, whatever its case;
    // the caller filters it against the graph's known symbols.
    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(tok) && !symbols.includes(tok)) symbols.push(tok);
  }
  for (const m of text.matchAll(/\b([A-Z][a-z0-9]+(?:[A-Z][a-z0-9]+)+|[a-z][a-z0-9]*(?:_[a-z0-9]+)+)\b/g)) {
    if (!symbols.includes(m[1]) && !files.includes(m[1])) symbols.push(m[1]);
  }
  return { files, symbols };
}

export function isMemoryPath(rel, policy) {
  const p = String(rel || '').split('\\').join('/');
  const m = policy.memory || {};
  const strip = (d) => String(d || '').replace(/^\.\//, '').replace(/\/$/, '');
  if (p.startsWith(strip(m.rulesDir) + '/')) return 'area';
  if (p.startsWith(strip(m.tasksDir) + '/')) return 'task';
  if (p.startsWith(strip(m.archiveDir) + '/')) return 'project';
  if (/(^|\/)memory\/.*\.md$/.test(p) || /(^|\/)MEMORY\.md$/.test(p)) return 'project';
  return null;
}

export function titleOf(body, rel) {
  const m = /^#\s+(.+)$/m.exec(String(body || ''));
  return m ? m[1].trim() : basename(String(rel || 'memory'), '.md');
}

export function memoryId(rel) {
  return 'mem-' + createHash('sha1').update(String(rel)).digest('hex').slice(0, 12);
}
