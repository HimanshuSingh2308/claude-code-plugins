import { readFileSync, writeFileSync } from 'node:fs';
import { join, isAbsolute, relative } from 'node:path';
import { log } from './io.mjs';

/** Versions governor knows how to append to. An absent key means the
 *  project-manager generator, which has no schemaVersion; an unrecognised
 *  value means a graph shape governor must not touch. */
const KNOWN_SCHEMA_VERSIONS = ['1', '1.0', 1];

export function kgPath(cwd, policy) {
  const p = (policy.memory && policy.memory.kgPath) || '.claude/knowledge_graph.json';
  return isAbsolute(p) ? p : join(cwd, p);
}

export function loadKg(cwd, policy) {
  if (!cwd) return null;
  try { return JSON.parse(readFileSync(kgPath(cwd, policy), 'utf8')); } catch { return null; }
}

export function schemaOk(kg) {
  if (!kg || typeof kg !== 'object' || !kg.meta) return false;
  const v = kg.meta.schemaVersion;
  return v === undefined || KNOWN_SCHEMA_VERSIONS.includes(v);
}

export function relPath(cwd, p) {
  if (!p) return '';
  const r = isAbsolute(p) && cwd ? relative(cwd, p) : p;
  return r.split('\\').join('/');
}

export function symbolsFor(kg, rel) {
  if (!kg || !kg.files) return [];
  const entry = kg.files[rel];
  if (entry && Array.isArray(entry.symbols)) return entry.symbols;
  if (kg.symbols && typeof kg.symbols === 'object') {
    return Object.entries(kg.symbols).filter(([, v]) => v && v.file === rel).map(([k]) => k);
  }
  return [];
}

export function memoriesFor(kg, rel) {
  if (!kg || !Array.isArray(kg.memories)) return [];
  return kg.memories.filter((m) => Array.isArray(m.files) && m.files.includes(rel));
}

export function appendMemory(cwd, policy, entry, input) {
  const path = kgPath(cwd, policy);
  let kg;
  try { kg = JSON.parse(readFileSync(path, 'utf8')); }
  catch { log(`kg: no graph at ${path}`, input); return 'skipped'; }
  if (!schemaOk(kg)) {
    log(`kg: unknown meta.schemaVersion ${kg.meta && kg.meta.schemaVersion}; wrote nothing`, input);
    return 'unknown-schema';
  }
  if (!Array.isArray(kg.memories)) kg.memories = [];
  const record = { ...entry, updatedAt: new Date().toISOString() };
  const i = kg.memories.findIndex((m) => m && m.id === record.id);
  if (i >= 0) kg.memories[i] = record; else kg.memories.push(record);
  try { writeFileSync(path, JSON.stringify(kg, null, 2)); }
  catch (e) { log(`kg write: ${e.message}`, input); return 'skipped'; }
  return 'ok';
}

export function countLines(absPath) {
  try {
    const raw = readFileSync(absPath, 'utf8');
    if (!raw) return 0;
    let n = 1;
    for (let i = 0; i < raw.length; i++) if (raw.charCodeAt(i) === 10) n++;
    return n;
  } catch { return 0; }
}
