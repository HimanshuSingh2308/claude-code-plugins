import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export function runHook(script, input) {
  const r = spawnSync(process.execPath, [join(ROOT, 'scripts', script)], {
    input: input === undefined ? '' : JSON.stringify(input), encoding: 'utf8'
  });
  const out = (r.stdout || '').trim();
  if (r.status !== 0) {
    throw new Error(`hook ${script} exited ${r.status}: ${r.stderr}`);
  }
  return { code: r.status, stderr: r.stderr, out, json: out ? JSON.parse(out) : null };
}

/** Same contract as runHook, but spawned asynchronously so several calls can
 * genuinely race each other - use with Promise.all for concurrency tests. */
export function runHookAsync(script, input) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [join(ROOT, 'scripts', script)]);
    let out = '', err = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { err += d; });
    child.on('error', reject);
    child.on('close', (code) => {
      out = out.trim();
      if (code !== 0) return reject(new Error(`hook ${script} exited ${code}: ${err}`));
      try {
        resolve({ code, stderr: err, out, json: out ? JSON.parse(out) : null });
      } catch (e) { reject(e); }
    });
    child.stdin.end(input === undefined ? '' : JSON.stringify(input));
  });
}

export function sandbox(policy) {
  const cwd = mkdtempSync(join(tmpdir(), 'gov-cwd-'));
  const scratch = mkdtempSync(join(tmpdir(), 'gov-scratch-'));
  if (policy !== undefined) {
    mkdirSync(join(cwd, '.claude'), { recursive: true });
    writeFileSync(join(cwd, '.claude', 'governor.json'),
      typeof policy === 'string' ? policy : JSON.stringify(policy));
  }
  return { cwd, scratchpad_dir: scratch, session_id: 'test-' + Math.random().toString(36).slice(2) };
}

export function hookOut(res) {
  return (res.json && res.json.hookSpecificOutput) || {};
}
