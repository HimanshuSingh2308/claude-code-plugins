#!/usr/bin/env node
import { safeMain } from './lib/io.mjs';
import { updateState } from './lib/state.mjs';

await safeMain('post-tool-read', async (input) => {
  if (input.tool_name !== 'Read') return null;
  const ti = input.tool_input || {};
  if (!ti.file_path) return null;
  const partial = ti.offset !== undefined || ti.limit !== undefined;
  if (!partial) return null;  // whole reads are counted race-safely in pre-tool-read.mjs
  updateState(input, (s) => {
    const e = s.reads[ti.file_path] || { full: 0, partial: 0 };
    e.partial += 1;
    s.reads[ti.file_path] = e;
  });
  return null;
});
