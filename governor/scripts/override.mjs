#!/usr/bin/env node
// Backs `/governor cap off|on` and `/governor reads off|on`: writes a session
// override directly into state, without relying on a prompt token reaching
// the UserPromptSubmit hook. Exists because a leading `!` in the prompt box
// (the token spelling, `!cap=off`) is Claude Code's run-a-shell-command
// shortcut when it is the very first character of the prompt, so typing the
// token alone never reaches the hook at all. This command-backing script is
// the reliable path; the recommended prompt spelling (`governor cap=off`,
// bang-free, with a leading word) is the reliable path too - see
// lib/overrides.mjs and README.md.
//
// Self-locating the same way status.mjs is: --cwd and --scratchpad, no
// session id required. See lib/session.mjs.
import { locateSession } from './lib/session.mjs';
import { readState, writeState } from './lib/state.mjs';

const a = process.argv.slice(2);
const arg = (name) => {
  const i = a.indexOf(`--${name}`);
  return i >= 0 && a[i + 1] ? a[i + 1] : undefined;
};

const cwd = arg('cwd') || process.cwd();
const scratchpad = arg('scratchpad');
const explicitSession = arg('session');
const capArg = arg('cap');
const readsArg = arg('reads');

const { sessionId, stateDir, located } = locateSession({ cwd, scratchpad, session: explicitSession });

if (!located) {
  process.stdout.write(
    'governor: no session state file found. Pass --session <id> if you know it, or' +
    ' --scratchpad <dir> for the scratchpad directory named in the system prompt.\n'
  );
  process.exit(0);
}

const input = { session_id: sessionId, scratchpad_dir: stateDir };
const state = readState(input);
const changed = [];

if (capArg === 'off') { state.overrides.cap = true; changed.push('cap=off'); }
else if (capArg === 'on') { state.overrides.cap = false; changed.push('cap=on'); }
else if (capArg !== undefined) {
  process.stdout.write(`governor: --cap must be "off" or "on", got "${capArg}".\n`);
  process.exit(0);
}

if (readsArg === 'off') { state.overrides.reads = true; changed.push('reads=off'); }
else if (readsArg === 'on') { state.overrides.reads = false; changed.push('reads=on'); }
else if (readsArg !== undefined) {
  process.stdout.write(`governor: --reads must be "off" or "on", got "${readsArg}".\n`);
  process.exit(0);
}

if (!changed.length) {
  process.stdout.write('governor: nothing to change; pass --cap off|on and/or --reads off|on.\n');
  process.exit(0);
}

writeState(input, state);
process.stdout.write(`governor: ${changed.join(', ')} set for session ${sessionId}.\n`);
