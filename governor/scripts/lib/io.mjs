import { appendFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export function logDir(input) {
  return input && typeof input.scratchpad_dir === 'string' && input.scratchpad_dir
    ? input.scratchpad_dir : tmpdir();
}

export function log(line, input) {
  try {
    const dir = logDir(input);
    mkdirSync(dir, { recursive: true });
    appendFileSync(join(dir, 'governor.log'), `${new Date().toISOString()} ${line}\n`);
  } catch { /* the logger itself must never throw */ }
}

export async function readInput() {
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  return raw ? JSON.parse(raw) : {};
}

export function emit(obj) {
  if (obj) process.stdout.write(JSON.stringify(obj));
}

export function pre(fields) {
  return { hookSpecificOutput: { hookEventName: 'PreToolUse', ...fields } };
}
export function post(fields) {
  return { hookSpecificOutput: { hookEventName: 'PostToolUse', ...fields } };
}
export function prompt(fields) {
  return { hookSpecificOutput: { hookEventName: 'UserPromptSubmit', ...fields } };
}
export function sessionStart(fields) {
  return { hookSpecificOutput: { hookEventName: 'SessionStart', ...fields } };
}

/** Runs a hook body. Any throw exits 0 silently with one log line: fail open. */
export async function safeMain(name, fn) {
  let input = {};
  try {
    input = await readInput();
    const out = await fn(input);
    emit(out);
  } catch (err) {
    log(`${name}: ${err && err.stack ? err.stack.split('\n')[0] : String(err)}`, input);
  }
  process.exit(0);
}
