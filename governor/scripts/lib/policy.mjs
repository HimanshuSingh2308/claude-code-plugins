import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { log } from './io.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_PATH = join(HERE, '..', '..', 'policy', 'default.json');

function isPlain(v) { return v && typeof v === 'object' && !Array.isArray(v); }

export function merge(base, over) {
  if (!isPlain(over)) return over === undefined ? base : over;
  const out = { ...base };
  for (const [k, v] of Object.entries(over)) {
    out[k] = isPlain(v) && isPlain(base[k]) ? merge(base[k], v) : v;
  }
  return out;
}

export function defaults() {
  return JSON.parse(readFileSync(DEFAULT_PATH, 'utf8'));
}

export function loadPolicy(cwd, input) {
  const base = defaults();
  if (!cwd) return base;
  try {
    return merge(base, JSON.parse(readFileSync(join(cwd, '.claude', 'governor.json'), 'utf8')));
  } catch (err) {
    if (err && err.code !== 'ENOENT') log(`policy: ${cwd}: ${err.message}`, input);
    return base;
  }
}
