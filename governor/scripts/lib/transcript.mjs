import { readFileSync } from 'node:fs';

/**
 * Counts main-chain assistant turns and compactions in a transcript JSONL.
 * A compaction leaves a `{"type":"system","subtype":"compact_boundary"}` record,
 * an `isCompactSummary` user record, or both, depending on the harness version,
 * so the larger of the two signals is taken rather than their sum.
 */
export function countTranscript(path) {
  const result = { turns: 0, compactions: 0 };
  let boundaries = 0, summaries = 0;
  let raw;
  try { raw = readFileSync(path, 'utf8'); } catch { return result; }
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    let rec;
    try { rec = JSON.parse(line); } catch { continue; }
    if (rec.type === 'assistant' && !rec.isSidechain) result.turns++;
    if (rec.subtype === 'compact_boundary') boundaries++;
    if (rec.isCompactSummary === true) summaries++;
  }
  result.compactions = Math.max(boundaries, summaries);
  return result;
}
