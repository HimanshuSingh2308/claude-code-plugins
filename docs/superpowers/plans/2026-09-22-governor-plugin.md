# Governor Plugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the `governor` Claude Code plugin 0.1.0 in the hplugins marketplace: hooks that rewrite subagent models by tier, count whole-file reads, report a turn/compaction budget, gate a session after its cap, and index memory into the knowledge graph.

**Architecture:** Plain Node 24 ESM scripts with zero npm dependencies. `hooks/hooks.json` registers one script per hook event/matcher with `${CLAUDE_PLUGIN_ROOT}`. Every script is a thin `main()` around a shared `scripts/lib/` (policy loading + defaults merge, per-session state file, transcript counting, tier resolution, glob matching, KG append, fail-open logging). Every script is wrapped so that any exception exits 0 with no decision and one line in `<scratchpad|tmpdir>/governor.log`. Tests are `node --test` and drive the real scripts as child processes over stdin/stdout so they test the harness contract, not internal functions.

**Tech Stack:** Node 24 ESM (`.mjs`), `node:test`, `node:assert/strict`, `child_process.spawnSync`. No package.json dependencies.

**Spec:** `docs/superpowers/specs/2026-09-22-governor-plugin-design.md`

## Global Constraints

- Repo: `/Users/hsingh1/.claude/plugins/marketplaces/hplugins`, branch `main`. Never touch, stage or revert `content-studio/lib/youtube_upload.py`. Never `git stash`, `git checkout -- .`, `git clean`. Never push.
- Every commit message ends with the line: `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`
- Zero npm dependencies. Node builtins only. All scripts are `.mjs` ESM.
- Fail-open is mandatory: any exception in a hook exits 0, prints nothing, appends one line to `<scratchpad_dir or os.tmpdir()>/governor.log`.
- Plugin version `0.1.0`. Marketplace `metadata.version` bumps from `1.1.0` to `1.2.0`.
- Do not modify the user's `~/.claude/settings.json` or any project's `.claude/settings.json`.
- `policy/default.json` is exactly the spec schema (Section 1) plus one extra top-level key `"enforce": { "reads": false, "cap": false }` so 0.1.0 ships warn-only for reads and the cap. The Agent model rewrite is always on.

### Hook harness contract (verified against https://code.claude.com/docs/en/hooks.md, 2026-09-22)

Common stdin fields: `session_id`, `prompt_id`, `transcript_path`, `cwd`, `scratchpad_dir`, `permission_mode`, `effort: { level }`, `hook_event_name`, and inside a subagent `agent_id`, `agent_type`.

Per event stdin adds:
- PreToolUse: `tool_name`, `tool_input`, `tool_use_id`
- PostToolUse: `tool_name`, `tool_input`, `tool_use_id`, `tool_result`
- UserPromptSubmit: `prompt`, `permission_mode`
- SessionStart: `reason` (`startup|resume|clear|compact|fork`), `model`
- PreCompact: `reason` (`manual|auto`)

Stdout (exit 0, JSON on one line):
```json
{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"...","updatedInput":{...},"additionalContext":"...","systemMessage":"..."}}
```
`permissionDecision` is one of `allow|deny|ask`. `additionalContext` is the UserPromptSubmit / SessionStart / PostToolUse channel. Exit 0 with empty stdout means "no decision, proceed".

---

## File Structure

```
governor/
  .claude-plugin/plugin.json        name/version/author, hplugins conventions
  hooks/hooks.json                  8 registrations across 6 events
  policy/default.json               spec schema + enforce switches
  scripts/
    lib/io.mjs                      stdin read, emit(), safeMain() fail-open wrapper, log()
    lib/glob.mjs                    globToRegExp, matchGlob, matchAny
    lib/policy.mjs                  loadPolicy(cwd) with deep defaults merge
    lib/state.mjs                   read/update per-session state JSON
    lib/transcript.mjs              countTranscript(path) -> {turns, compactions}
    lib/tier.mjs                    resolveTier(policy, call) -> {tier, model, override}
    lib/kg.mjs                      loadKg(cwd, policy), appendMemory(...)
    pre-tool-agent.mjs              hook 1
    pre-tool-read.mjs               hook 2a
    post-tool-read.mjs              hook 2b
    user-prompt.mjs                 hook 3
    pre-tool-cap.mjs                hook 4
    post-tool-write.mjs             hook 4b (handoff flag) + hook 6 (memory indexer)
    session-start.mjs               hook 5a
    pre-compact.mjs                 hook 5b
    fold.mjs                        /governor memory fold + task fold engine
    status.mjs                      /governor status reporter
  commands/governor.md              status | profile | memory fold | task fold | handoff
  skills/governor-rules/SKILL.md    human-readable rules
  templates/handoff.md
  tests/                            *.test.mjs + fixtures/
  README.md
```

---

### Task 1: Plugin skeleton, policy loading, glob matching, fail-open

**Files:**
- Create: `governor/.claude-plugin/plugin.json`, `governor/policy/default.json`, `governor/scripts/lib/io.mjs`, `governor/scripts/lib/glob.mjs`, `governor/scripts/lib/policy.mjs`
- Test: `governor/tests/policy.test.mjs`, `governor/tests/glob.test.mjs`

**Interfaces:**
- Produces: `loadPolicy(cwd) -> policy` (deep merge of `.claude/governor.json` over `policy/default.json`; malformed or missing project file returns defaults and logs); `matchGlob(pattern, value) -> boolean`; `globToRegExp(pattern) -> RegExp`; `safeMain(fn)`; `emit(obj)`; `log(line, scratchpadDir)`; `readInput() -> object`.

- [ ] **Step 1: Write the failing tests**

`governor/tests/glob.test.mjs`:
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { matchGlob } from '../scripts/lib/glob.mjs';

test('exact match', () => assert.equal(matchGlob('Explore', 'Explore'), true));
test('suffix star', () => assert.equal(matchGlob('*-reviewer', 'game-code-reviewer'), true));
test('prefix star', () => assert.equal(matchGlob('kg-*', 'kg-generator'), true));
test('no match', () => assert.equal(matchGlob('*-tester', 'game-builder'), false));
test('dots are literal', () => assert.equal(matchGlob('a.b', 'axb'), false));
test('double star crosses slashes', () =>
  assert.equal(matchGlob('apps/api/**', 'apps/api/src/main.ts'), true));
test('single star does not cross slashes', () =>
  assert.equal(matchGlob('apps/web/public/games/*', 'apps/web/public/games/tt3d/a.js'), false));
test('single star matches one segment', () =>
  assert.equal(matchGlob('apps/web/public/games/*', 'apps/web/public/games/tt3d'), true));
```

`governor/tests/policy.test.mjs`:
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadPolicy } from '../scripts/lib/policy.mjs';

function project(json) {
  const dir = mkdtempSync(join(tmpdir(), 'gov-policy-'));
  mkdirSync(join(dir, '.claude'), { recursive: true });
  if (json !== null) writeFileSync(join(dir, '.claude', 'governor.json'), json);
  return dir;
}

test('no project file yields defaults', () => {
  const p = loadPolicy(project(null));
  assert.equal(p.tiers.explore, 'haiku');
  assert.equal(p.defaultTier, 'implement');
  assert.equal(p.enforce.reads, false);
  assert.equal(p.enforce.cap, false);
});

test('a three line project file merges over defaults', () => {
  const p = loadPolicy(project('{"tiers":{"explore":"sonnet"},"harnessSkill":"tt3d-harness"}'));
  assert.equal(p.tiers.explore, 'sonnet');
  assert.equal(p.tiers.implement, 'opus', 'untouched keys keep their default');
  assert.equal(p.harnessSkill, 'tt3d-harness');
  assert.equal(p.reads.wholeFileLimit, 3);
});

test('arrays replace rather than concatenate', () => {
  const p = loadPolicy(project('{"effort":{"raiseFor":["debug"]}}'));
  assert.deepEqual(p.effort.raiseFor, ['debug']);
  assert.equal(p.effort.default, 'medium');
});

test('malformed project policy fails open to defaults', () => {
  const p = loadPolicy(project('{ this is not json'));
  assert.equal(p.defaultTier, 'implement');
});
```

- [ ] **Step 2: Run the tests, expect failure**

Run: `cd governor && node --test tests/glob.test.mjs tests/policy.test.mjs`
Expected: FAIL, `Cannot find module '.../scripts/lib/glob.mjs'`.

- [ ] **Step 3: Write `governor/scripts/lib/glob.mjs`**

```js
export function globToRegExp(pattern) {
  let out = '';
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === '*') {
      if (pattern[i + 1] === '*') { out += '.*'; i++; if (pattern[i + 1] === '/') i++; }
      else out += '[^/]*';
    } else if (c === '?') out += '[^/]';
    else out += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp('^' + out + '$');
}

export function matchGlob(pattern, value) {
  if (typeof pattern !== 'string' || typeof value !== 'string') return false;
  if (!pattern.includes('*') && !pattern.includes('?')) return pattern === value;
  return globToRegExp(pattern).test(value);
}

export function matchAny(patterns, value) {
  return Array.isArray(patterns) && patterns.some((p) => matchGlob(p, value));
}
```

Note the `**/` collapse: `apps/api/**` must match `apps/api/src/main.ts`, so after `**` a following `/` is swallowed and `.*` covers it.

- [ ] **Step 4: Write `governor/scripts/lib/io.mjs`**

```js
import { appendFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export function logDir(input) {
  const d = input && typeof input.scratchpad_dir === 'string' ? input.scratchpad_dir : tmpdir();
  return d;
}

export function log(line, input) {
  try {
    appendFileSync(join(logDir(input), 'governor.log'),
      `${new Date().toISOString()} ${line}\n`);
  } catch { /* fail open: never throw out of the logger */ }
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

/** Runs a hook body. Any throw exits 0 silently with one log line. */
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
```

- [ ] **Step 5: Write `governor/policy/default.json`**

Exactly the spec's schema plus `enforce`:
```json
{
  "tiers": {
    "implement": "opus", "debug": "opus",
    "verify": "sonnet", "review": "sonnet", "gate": "sonnet",
    "lookup": "haiku", "explore": "haiku"
  },
  "agentTypes": {
    "Explore": "lookup", "Plan": "review",
    "*-reviewer": "review", "*-tester": "verify", "*-validator": "verify",
    "*-builder": "implement", "*-bug-fixer": "debug", "*-artist": "implement",
    "kg-*": "lookup", "*-extractor": "lookup", "*-updater": "lookup"
  },
  "keywords": {
    "verify": ["verify", "measure", "probe", "gate", "check", "audit", "re-run"],
    "review": ["review"],
    "lookup": ["find", "list", "where is", "grep", "inventory"],
    "debug": ["root cause", "diagnose", "reproduce", "why does"],
    "implement": ["implement", "build", "write", "fix", "add"]
  },
  "defaultTier": "implement",
  "override": "!model=",
  "effort": { "default": "medium", "raiseFor": ["debug", "design"] },
  "reads": { "wholeFileLimit": 3, "largeFileLines": 2000, "override": "!reads=off" },
  "session": {
    "maxCompactions": 2, "maxTurns": 2500,
    "handoffPath": "docs/handoffs/", "override": "!cap=off"
  },
  "memory": {
    "areas": {
      "apps/web-astro/public/games/*": "games/{1}",
      "apps/api/**": "api",
      "apps/web-astro/src/**": "web"
    },
    "rulesDir": ".claude/rules",
    "tasksDir": ".claude/memory/tasks",
    "archiveDir": ".claude/memory/archive",
    "kgPath": ".claude/knowledge_graph.json",
    "indexBudgetBytes": 8192
  },
  "profiles": {
    "default": ["project-manager", "superpowers", "remember", "governor"],
    "game-art": ["+game-design", "+chrome-devtools-mcp", "+blender-local"],
    "backend": ["+backend-dev", "+playwright"],
    "content": ["+content-studio", "+chrome-devtools-mcp"]
  },
  "enforce": { "reads": false, "cap": false },
  "harnessSkill": null
}
```

- [ ] **Step 6: Write `governor/scripts/lib/policy.mjs`**

```js
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
    const raw = readFileSync(join(cwd, '.claude', 'governor.json'), 'utf8');
    return merge(base, JSON.parse(raw));
  } catch (err) {
    if (err && err.code !== 'ENOENT') log(`policy: ${cwd}: ${err.message}`, input);
    return base;
  }
}
```

- [ ] **Step 7: Write `governor/.claude-plugin/plugin.json`**

```json
{
  "name": "governor",
  "description": "Turns cost rules into hooks: subagent model tiers, whole-file read limits, a turn and compaction budget with a handoff cap, and scoped memory",
  "version": "0.1.0",
  "author": { "name": "Himanshu Singh", "url": "https://github.com/HimanshuSingh2308" },
  "repository": "https://github.com/HimanshuSingh2308/claude-code-plugins",
  "license": "MIT",
  "keywords": ["governance", "cost", "hooks", "subagents", "memory", "context"]
}
```

- [ ] **Step 8: Run the tests, expect pass**

Run: `cd governor && node --test tests/`
Expected: all PASS.

- [ ] **Step 9: Commit**

```bash
git add governor/.claude-plugin governor/policy governor/scripts/lib governor/tests
git commit -m "$(cat <<'EOF'
feat(governor): plugin skeleton, policy defaults merge and glob matching

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Session state file and transcript counting

**Files:**
- Create: `governor/scripts/lib/state.mjs`, `governor/scripts/lib/transcript.mjs`
- Test: `governor/tests/state.test.mjs`, `governor/tests/transcript.test.mjs`, `governor/tests/fixtures/transcript-two-compactions.jsonl`

**Interfaces:**
- Consumes: `log` from `lib/io.mjs`.
- Produces: `statePath(input) -> string`; `readState(input) -> state`; `updateState(input, fn) -> state`; `countTranscript(path) -> { turns, compactions }`.
- State shape: `{ sessionId, turns, compactions, reads: { [path]: { full, partial } }, rewrites, denials, warnings, overrides: { model, reads, cap }, capReached, handoffWritten, profile, baselinePlugins, effort, branch, areas, pendingStatus }`.

- [ ] **Step 1: Write the transcript fixture**

`governor/tests/fixtures/transcript-two-compactions.jsonl` — 9 lines, 4 main-chain assistant turns, 1 sidechain assistant turn (not counted), two compactions expressed both ways:
```jsonl
{"type":"user","message":{"role":"user","content":"hello"}}
{"type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"hi"}]}}
{"type":"assistant","isSidechain":true,"message":{"role":"assistant","content":[{"type":"text","text":"subagent"}]}}
{"type":"system","subtype":"compact_boundary","compactMetadata":{"trigger":"auto"}}
{"type":"user","isCompactSummary":true,"message":{"role":"user","content":"summary"}}
{"type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"after one"}]}}
{"type":"system","subtype":"compact_boundary","compactMetadata":{"trigger":"manual"}}
{"type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"after two"}]}}
{"type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"last"}]}}
```

- [ ] **Step 2: Write the failing tests**

`governor/tests/transcript.test.mjs`:
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { countTranscript } from '../scripts/lib/transcript.mjs';

const F = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

test('counts two compactions and only main-chain assistant turns', () => {
  const r = countTranscript(join(F, 'transcript-two-compactions.jsonl'));
  assert.equal(r.compactions, 2);
  assert.equal(r.turns, 4);
});

test('a missing transcript counts zero and does not throw', () => {
  assert.deepEqual(countTranscript(join(F, 'nope.jsonl')), { turns: 0, compactions: 0 });
});

test('unparseable lines are skipped', () => {
  const r = countTranscript(join(F, 'transcript-garbage.jsonl'));
  assert.equal(r.turns, 1);
});
```
Also create `governor/tests/fixtures/transcript-garbage.jsonl`:
```jsonl
not json at all
{"type":"assistant","message":{"role":"assistant","content":[]}}

```

`governor/tests/state.test.mjs`:
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readState, updateState, statePath } from '../scripts/lib/state.mjs';

function input() {
  return { session_id: 's1', scratchpad_dir: mkdtempSync(join(tmpdir(), 'gov-state-')) };
}

test('a fresh state has zeroed counters', () => {
  const s = readState(input());
  assert.equal(s.turns, 0);
  assert.equal(s.rewrites, 0);
  assert.deepEqual(s.overrides, { model: false, reads: false, cap: false });
});

test('updateState persists and reads back', () => {
  const i = input();
  updateState(i, (s) => { s.rewrites += 1; s.reads['a.js'] = { full: 2, partial: 0 }; });
  const s = readState(i);
  assert.equal(s.rewrites, 1);
  assert.equal(s.reads['a.js'].full, 2);
});

test('the state path is namespaced by session id', () => {
  const i = input();
  assert.ok(statePath(i).endsWith('governor-s1.json'));
});

test('a corrupt state file is replaced, not thrown', () => {
  const i = input();
  updateState(i, (s) => { s.turns = 3; });
  require('node:fs').writeFileSync(statePath(i), '{{{');
  assert.equal(readState(i).turns, 0);
});
```
(Replace the `require` line with a top-level `import { writeFileSync } from 'node:fs';` — ESM has no `require`.)

- [ ] **Step 3: Run the tests, expect failure**

Run: `cd governor && node --test tests/state.test.mjs tests/transcript.test.mjs`
Expected: FAIL, module not found.

- [ ] **Step 4: Write `governor/scripts/lib/transcript.mjs`**

```js
import { readFileSync } from 'node:fs';

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
  // A compaction writes a boundary record, a summary record, or both, depending on
  // the harness version. Take the larger signal so neither shape double counts.
  result.compactions = Math.max(boundaries, summaries);
  return result;
}
```

- [ ] **Step 5: Write `governor/scripts/lib/state.mjs`**

```js
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { logDir, log } from './io.mjs';

export function statePath(input) {
  const id = (input && input.session_id) || 'unknown';
  return join(logDir(input), `governor-${String(id).replace(/[^A-Za-z0-9_-]/g, '_')}.json`);
}

export function freshState(input) {
  return {
    sessionId: (input && input.session_id) || 'unknown',
    turns: 0, compactions: 0, reads: {},
    rewrites: 0, denials: 0, warnings: 0,
    overrides: { model: false, reads: false, cap: false },
    capReached: false, handoffWritten: false,
    profile: 'default', baselinePlugins: null,
    effort: null, branch: null, areas: [], pendingStatus: null
  };
}

export function readState(input) {
  try {
    const s = JSON.parse(readFileSync(statePath(input), 'utf8'));
    return { ...freshState(input), ...s, overrides: { ...freshState(input).overrides, ...(s.overrides || {}) } };
  } catch (err) {
    if (err && err.code !== 'ENOENT') log(`state: ${err.message}`, input);
    return freshState(input);
  }
}

export function writeState(input, state) {
  try {
    mkdirSync(logDir(input), { recursive: true });
    writeFileSync(statePath(input), JSON.stringify(state));
  } catch (err) { log(`state write: ${err.message}`, input); }
  return state;
}

export function updateState(input, fn) {
  const s = readState(input);
  fn(s);
  return writeState(input, s);
}
```

- [ ] **Step 6: Run the tests, expect pass**

Run: `cd governor && node --test tests/`
Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add governor/scripts/lib governor/tests
git commit -m "$(cat <<'EOF'
feat(governor): session state file and transcript turn/compaction counting

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Hook 1, the Agent model tier rewrite

**Files:**
- Create: `governor/scripts/lib/tier.mjs`, `governor/scripts/pre-tool-agent.mjs`, `governor/hooks/hooks.json`
- Test: `governor/tests/helpers.mjs`, `governor/tests/tier.test.mjs`, `governor/tests/hook-agent.test.mjs`

**Interfaces:**
- Consumes: `loadPolicy`, `matchGlob`, `updateState`, `pre`, `safeMain`.
- Produces: `resolveTier(policy, { subagent_type, description, prompt }) -> { tier, model, override }`; `HARNESS_OPEN = '<!-- harness-rules -->'`, `HARNESS_CLOSE = '<!-- /harness-rules -->'`; `replaceHarness(prompt, policy) -> string`.
- Produces for tests: `governor/tests/helpers.mjs` exporting `runHook(script, input, opts) -> { code, out }`.

- [ ] **Step 1: Write `governor/tests/helpers.mjs`**

```js
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export function runHook(script, input) {
  const r = spawnSync(process.execPath, [join(ROOT, 'scripts', script)], {
    input: JSON.stringify(input), encoding: 'utf8'
  });
  const out = r.stdout.trim();
  return { code: r.status, stderr: r.stderr, out, json: out ? JSON.parse(out) : null };
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
```

- [ ] **Step 2: Write the failing tests**

`governor/tests/tier.test.mjs`:
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { defaults } from '../scripts/lib/policy.mjs';
import { resolveTier, replaceHarness } from '../scripts/lib/tier.mjs';

const P = defaults();

test('by agent type, exact', () => {
  assert.deepEqual(resolveTier(P, { subagent_type: 'Explore' }),
    { tier: 'lookup', model: 'haiku', override: false });
});

test('by agent type, glob', () => {
  assert.equal(resolveTier(P, { subagent_type: 'game-code-reviewer' }).tier, 'review');
  assert.equal(resolveTier(P, { subagent_type: 'kg-generator' }).model, 'haiku');
});

test('by keyword in the description when the type is unknown', () => {
  assert.equal(resolveTier(P, { subagent_type: 'custom', description: 'Verify the gate' }).tier, 'verify');
  assert.equal(resolveTier(P, { subagent_type: 'custom', description: 'find the caller' }).tier, 'lookup');
});

test('by keyword in the first 400 characters of the prompt only', () => {
  const pad = 'x'.repeat(420);
  assert.equal(resolveTier(P, { subagent_type: 'custom', prompt: 'please diagnose this' }).tier, 'debug');
  assert.equal(resolveTier(P, { subagent_type: 'custom', prompt: pad + ' diagnose' }).tier, 'implement');
});

test('unclassified falls back to the default tier, never downgraded', () => {
  assert.deepEqual(resolveTier(P, { subagent_type: 'custom', prompt: 'do the thing' }),
    { tier: 'implement', model: 'opus', override: false });
});

test('an !model= token wins over everything', () => {
  const r = resolveTier(P, { subagent_type: 'Explore', prompt: 'go !model=opus now' });
  assert.deepEqual(r, { tier: 'lookup', model: 'opus', override: true });
});

test('replaceHarness swaps the marked block for the skill line', () => {
  const p = 'a\n<!-- harness-rules -->\nlots\nof\nboilerplate\n<!-- /harness-rules -->\nb';
  const out = replaceHarness(p, { ...P, harnessSkill: 'tt3d-harness' });
  assert.equal(out, 'a\nLoad the skill `tt3d-harness` before any browser or gate work.\nb');
  assert.ok(!out.includes('boilerplate'));
});

test('replaceHarness without a configured skill uses the generic line', () => {
  const p = '<!-- harness-rules -->x<!-- /harness-rules -->';
  assert.equal(replaceHarness(p, P),
    'Load the skill named in governor.json harnessSkill before any browser or gate work.');
});

test('replaceHarness leaves an unmarked prompt untouched', () => {
  assert.equal(replaceHarness('plain', P), 'plain');
});
```

`governor/tests/hook-agent.test.mjs`:
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { runHook, sandbox, hookOut } from './helpers.mjs';

function call(tool_input, policy) {
  return runHook('pre-tool-agent.mjs', {
    ...sandbox(policy), hook_event_name: 'PreToolUse',
    tool_name: 'Agent', tool_use_id: 'toolu_1', tool_input
  });
}

test('an Explore call with no model is rewritten to haiku', () => {
  const res = call({ subagent_type: 'Explore', description: 'look around', prompt: 'find X' });
  const o = hookOut(res);
  assert.equal(res.code, 0);
  assert.equal(o.hookEventName, 'PreToolUse');
  assert.equal(o.updatedInput.model, 'haiku');
  assert.ok(o.updatedInput.prompt.endsWith('governor: tier lookup -> haiku'));
  assert.equal(o.permissionDecision, undefined, 'hook 1 never denies');
});

test('a call already on the tier model is left alone', () => {
  const res = call({ subagent_type: 'Explore', model: 'haiku', prompt: 'find X' });
  assert.equal(res.out, '', 'no decision, no rewrite');
});

test('an !model= override is honoured and nothing is rewritten', () => {
  const res = call({ subagent_type: 'Explore', model: 'opus', prompt: 'find X !model=opus' });
  assert.equal(res.out, '');
});

test('the harness block is replaced even when the model already matches', () => {
  const res = call({
    subagent_type: 'Explore', model: 'haiku',
    prompt: 'go\n<!-- harness-rules -->\nboilerplate\n<!-- /harness-rules -->\nend'
  }, { harnessSkill: 'tt3d-harness' });
  const o = hookOut(res);
  assert.ok(o.updatedInput.prompt.includes('Load the skill `tt3d-harness`'));
  assert.ok(!o.updatedInput.prompt.includes('boilerplate'));
});

test('a non Agent tool is ignored', () => {
  const res = runHook('pre-tool-agent.mjs', {
    ...sandbox(), hook_event_name: 'PreToolUse', tool_name: 'Read', tool_input: { file_path: 'a' }
  });
  assert.equal(res.out, '');
});

test('a malformed project policy fails open and still rewrites from defaults', () => {
  const res = call({ subagent_type: 'Explore', prompt: 'find X' }, '{ not json');
  assert.equal(hookOut(res).updatedInput.model, 'haiku');
});

test('unreadable stdin exits 0 with no output', () => {
  const res = runHook('pre-tool-agent.mjs', undefined);
  assert.equal(res.code, 0);
});
```

- [ ] **Step 3: Run the tests, expect failure**

Run: `cd governor && node --test tests/tier.test.mjs tests/hook-agent.test.mjs`
Expected: FAIL, `Cannot find module '.../scripts/lib/tier.mjs'`.

- [ ] **Step 4: Write `governor/scripts/lib/tier.mjs`**

```js
import { matchGlob } from './glob.mjs';

export const HARNESS_OPEN = '<!-- harness-rules -->';
export const HARNESS_CLOSE = '<!-- /harness-rules -->';
const PROMPT_SCAN = 400;

export function findOverride(policy, text) {
  const token = (policy.override || '!model=').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = new RegExp(token + '([A-Za-z0-9._\\-]+)').exec(text || '');
  return m ? m[1] : null;
}

export function resolveTier(policy, call) {
  const type = call.subagent_type || '';
  const desc = call.description || '';
  const prompt = call.prompt || '';
  const haystack = (desc + ' ' + prompt.slice(0, PROMPT_SCAN)).toLowerCase();

  let tier = null;
  const types = policy.agentTypes || {};
  if (Object.prototype.hasOwnProperty.call(types, type)) tier = types[type];
  if (!tier) {
    for (const [pattern, t] of Object.entries(types)) {
      if (matchGlob(pattern, type)) { tier = t; break; }
    }
  }
  if (!tier) {
    for (const [t, words] of Object.entries(policy.keywords || {})) {
      if ((words || []).some((w) => haystack.includes(String(w).toLowerCase()))) { tier = t; break; }
    }
  }
  if (!tier) tier = policy.defaultTier || 'implement';

  const tiers = policy.tiers || {};
  let model = tiers[tier];
  const forced = findOverride(policy, desc + ' ' + prompt);
  if (forced) return { tier, model: forced, override: true };
  return { tier, model, override: false };
}

export function replaceHarness(prompt, policy) {
  if (typeof prompt !== 'string') return prompt;
  const start = prompt.indexOf(HARNESS_OPEN);
  if (start === -1) return prompt;
  const end = prompt.indexOf(HARNESS_CLOSE, start);
  if (end === -1) return prompt;
  const line = policy.harnessSkill
    ? `Load the skill \`${policy.harnessSkill}\` before any browser or gate work.`
    : 'Load the skill named in governor.json harnessSkill before any browser or gate work.';
  return prompt.slice(0, start) + line + prompt.slice(end + HARNESS_CLOSE.length);
}
```

- [ ] **Step 5: Write `governor/scripts/pre-tool-agent.mjs`**

```js
#!/usr/bin/env node
import { safeMain, pre } from './lib/io.mjs';
import { loadPolicy } from './lib/policy.mjs';
import { updateState } from './lib/state.mjs';
import { resolveTier, replaceHarness } from './lib/tier.mjs';

await safeMain('pre-tool-agent', async (input) => {
  if (input.tool_name !== 'Agent' && input.tool_name !== 'Task') return null;
  const call = input.tool_input || {};
  const policy = loadPolicy(input.cwd, input);
  const { tier, model, override } = resolveTier(policy, call);

  const newPrompt = replaceHarness(call.prompt, policy);
  const harnessChanged = newPrompt !== call.prompt;
  const rewriteModel = !override && model && call.model !== model;
  if (!rewriteModel && !harnessChanged) return null;

  const updatedInput = { ...call };
  if (harnessChanged) updatedInput.prompt = newPrompt;
  if (rewriteModel) {
    updatedInput.model = model;
    const note = `governor: tier ${tier} -> ${model}`;
    updatedInput.prompt = `${updatedInput.prompt || ''}\n\n${note}`.trim();
    updateState(input, (s) => { s.rewrites += 1; });
  }
  return pre({ updatedInput });
});
```

- [ ] **Step 6: Write `governor/hooks/hooks.json` with the Agent registration only**

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Agent",
        "hooks": [
          { "type": "command", "command": "node \"${CLAUDE_PLUGIN_ROOT}/scripts/pre-tool-agent.mjs\"" }
        ]
      }
    ]
  }
}
```

- [ ] **Step 7: Run the tests, expect pass**

Run: `cd governor && node --test tests/`
Expected: all PASS.

- [ ] **Step 8: Commit**

```bash
git add governor/scripts governor/hooks governor/tests
git commit -m "$(cat <<'EOF'
feat(governor): hook 1, Agent model tier rewrite and harness block replacement

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Hook 2, the read counter

**Files:**
- Create: `governor/scripts/lib/kg.mjs`, `governor/scripts/post-tool-read.mjs`, `governor/scripts/pre-tool-read.mjs`
- Modify: `governor/hooks/hooks.json`
- Test: `governor/tests/hook-read.test.mjs`, `governor/tests/kg.test.mjs`

**Interfaces:**
- Consumes: `readState`, `updateState`, `loadPolicy`, `pre`, `post`.
- Produces: `loadKg(cwd, policy) -> kg|null`; `symbolsFor(kg, relPath) -> string[]`; `memoriesFor(kg, relPath) -> object[]`; `appendMemory(cwd, policy, entry, input) -> 'ok'|'skipped'|'unknown-schema'`; `countLines(absPath) -> number`.

- [ ] **Step 1: Write the failing tests**

`governor/tests/kg.test.mjs`:
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sandbox } from './helpers.mjs';
import { defaults } from '../scripts/lib/policy.mjs';
import { loadKg, symbolsFor, memoriesFor, appendMemory } from '../scripts/lib/kg.mjs';

function withKg(kg) {
  const s = sandbox();
  mkdirSync(join(s.cwd, '.claude'), { recursive: true });
  writeFileSync(join(s.cwd, '.claude', 'knowledge_graph.json'), JSON.stringify(kg));
  return s;
}

const KG = {
  meta: { project: 'x' },
  files: { 'src/game.js': { lines: 3000, symbols: ['start', 'tick'] } },
  symbols: { start: { file: 'src/game.js' }, tick: { file: 'src/game.js' } }
};

test('symbolsFor reads the file entry', () => {
  const s = withKg(KG);
  assert.deepEqual(symbolsFor(loadKg(s.cwd, defaults()), 'src/game.js'), ['start', 'tick']);
});

test('appendMemory adds to meta-compatible graphs', () => {
  const s = withKg(KG);
  const r = appendMemory(s.cwd, defaults(),
    { id: 'm1', scope: 'task', path: '.claude/memory/tasks/b/n.md', title: 'N',
      files: ['src/game.js'], symbols: ['tick'] }, s);
  assert.equal(r, 'ok');
  const kg = JSON.parse(readFileSync(join(s.cwd, '.claude', 'knowledge_graph.json'), 'utf8'));
  assert.equal(kg.memories.length, 1);
  assert.equal(kg.memories[0].id, 'm1');
  assert.ok(kg.memories[0].updatedAt);
  assert.deepEqual(Object.keys(kg.files), ['src/game.js'], 'nothing else is touched');
});

test('appending the same id replaces rather than duplicates', () => {
  const s = withKg(KG);
  const e = { id: 'm1', scope: 'task', path: 'p', title: 'A', files: [], symbols: [] };
  appendMemory(s.cwd, defaults(), e, s);
  appendMemory(s.cwd, defaults(), { ...e, title: 'B' }, s);
  const kg = JSON.parse(readFileSync(join(s.cwd, '.claude', 'knowledge_graph.json'), 'utf8'));
  assert.equal(kg.memories.length, 1);
  assert.equal(kg.memories[0].title, 'B');
});

test('an unknown schemaVersion writes nothing and reports it', () => {
  const s = withKg({ ...KG, meta: { schemaVersion: '99' } });
  const before = readFileSync(join(s.cwd, '.claude', 'knowledge_graph.json'), 'utf8');
  assert.equal(appendMemory(s.cwd, defaults(), { id: 'm', path: 'p' }, s), 'unknown-schema');
  assert.equal(readFileSync(join(s.cwd, '.claude', 'knowledge_graph.json'), 'utf8'), before);
});

test('no graph at all is a skip, not a throw', () => {
  const s = sandbox();
  assert.equal(appendMemory(s.cwd, defaults(), { id: 'm', path: 'p' }, s), 'skipped');
});

test('memoriesFor finds entries attached to a file', () => {
  const s = withKg(KG);
  appendMemory(s.cwd, defaults(),
    { id: 'm1', scope: 'area', path: '.claude/rules/web.md', title: 'Web rule',
      files: ['src/game.js'], symbols: [] }, s);
  const found = memoriesFor(loadKg(s.cwd, defaults()), 'src/game.js');
  assert.equal(found.length, 1);
  assert.equal(found[0].title, 'Web rule');
});
```

`governor/tests/hook-read.test.mjs`:
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { runHook, sandbox, hookOut } from './helpers.mjs';

function bigFile(s, lines = 3000, name = 'big.js') {
  const p = join(s.cwd, name);
  writeFileSync(p, 'const x = 1;\n'.repeat(lines));
  return p;
}

function readPre(s, file_path, extra = {}) {
  return runHook('pre-tool-read.mjs', {
    ...s, hook_event_name: 'PreToolUse', tool_name: 'Read',
    tool_input: { file_path, ...extra }
  });
}
function readPost(s, file_path, extra = {}) {
  return runHook('post-tool-read.mjs', {
    ...s, hook_event_name: 'PostToolUse', tool_name: 'Read',
    tool_input: { file_path, ...extra }, tool_result: 'ok'
  });
}

test('the first two whole reads are silent', () => {
  const s = sandbox(); const f = bigFile(s);
  assert.equal(readPre(s, f).out, ''); readPost(s, f);
  assert.equal(readPre(s, f).out, ''); readPost(s, f);
});

test('the third whole read warns with additionalContext and does not deny', () => {
  const s = sandbox(); const f = bigFile(s);
  for (let i = 0; i < 2; i++) { readPre(s, f); readPost(s, f); }
  const o = hookOut(readPre(s, f));
  assert.equal(o.permissionDecision, undefined);
  assert.ok(o.additionalContext.includes('governor:'));
  assert.ok(o.additionalContext.includes('big.js'));
});

test('the fourth whole read denies a large file when enforce.reads is on', () => {
  const s = sandbox({ enforce: { reads: true } }); const f = bigFile(s);
  for (let i = 0; i < 3; i++) { readPre(s, f); readPost(s, f); }
  const o = hookOut(readPre(s, f));
  assert.equal(o.permissionDecision, 'deny');
  assert.ok(o.permissionDecisionReason.includes('read 3x in full'));
  assert.ok(o.permissionDecisionReason.includes('offset/limit'));
});

test('warn-only is the default: the fourth read warns instead of denying', () => {
  const s = sandbox(); const f = bigFile(s);
  for (let i = 0; i < 3; i++) { readPre(s, f); readPost(s, f); }
  const o = hookOut(readPre(s, f));
  assert.equal(o.permissionDecision, undefined);
  assert.ok(o.additionalContext.includes('read 3x in full'));
});

test('a file under largeFileLines is never denied', () => {
  const s = sandbox({ enforce: { reads: true } }); const f = bigFile(s, 10, 'small.js');
  for (let i = 0; i < 5; i++) { readPre(s, f); readPost(s, f); }
  assert.equal(hookOut(readPre(s, f)).permissionDecision, undefined);
});

test('reads with offset or limit always pass and are not counted', () => {
  const s = sandbox({ enforce: { reads: true } }); const f = bigFile(s);
  for (let i = 0; i < 6; i++) {
    assert.equal(readPre(s, f, { offset: 1, limit: 50 }).out, '');
    readPost(s, f, { offset: 1, limit: 50 });
  }
  assert.equal(readPre(s, f).out, '', 'partial reads did not bank a full-read count');
});

test('!reads=off disables denial for the session', () => {
  const s = sandbox({ enforce: { reads: true } }); const f = bigFile(s);
  runHook('user-prompt.mjs', { ...s, hook_event_name: 'UserPromptSubmit', prompt: 'carry on !reads=off' });
  for (let i = 0; i < 3; i++) { readPre(s, f); readPost(s, f); }
  assert.equal(hookOut(readPre(s, f)).permissionDecision, undefined);
});

test('the warning names knowledge graph symbols when a graph exists', () => {
  const s = sandbox(); const f = bigFile(s, 3000, 'game.js');
  mkdirSync(join(s.cwd, '.claude'), { recursive: true });
  writeFileSync(join(s.cwd, '.claude', 'knowledge_graph.json'), JSON.stringify({
    meta: { project: 'x' }, files: { 'game.js': { lines: 3000, symbols: ['start', 'tick'] } }, symbols: {}
  }));
  for (let i = 0; i < 2; i++) { readPre(s, f); readPost(s, f); }
  assert.ok(hookOut(readPre(s, f)).additionalContext.includes('start'));
});

test('a missing file does not throw', () => {
  const s = sandbox();
  assert.equal(readPre(s, join(s.cwd, 'gone.js')).code, 0);
});
```

(The `!reads=off` test depends on Task 5's `user-prompt.mjs`; write the test now, mark it `test.skip` until Task 5 lands, and un-skip it in Task 5 Step 6.)

- [ ] **Step 2: Run the tests, expect failure**

Run: `cd governor && node --test tests/kg.test.mjs tests/hook-read.test.mjs`
Expected: FAIL, module not found / no output from the hook.

- [ ] **Step 3: Write `governor/scripts/lib/kg.mjs`**

```js
import { readFileSync, writeFileSync } from 'node:fs';
import { join, isAbsolute, relative } from 'node:path';
import { log } from './io.mjs';

const KNOWN_SCHEMA_VERSIONS = ['1', '1.0', 1, 1.0];

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
  try { writeFileSync(path, JSON.stringify(kg, null, 2)); } catch (e) { log(`kg write: ${e.message}`, input); return 'skipped'; }
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
```

- [ ] **Step 4: Write `governor/scripts/post-tool-read.mjs`**

```js
#!/usr/bin/env node
import { safeMain } from './lib/io.mjs';
import { updateState } from './lib/state.mjs';

await safeMain('post-tool-read', async (input) => {
  if (input.tool_name !== 'Read') return null;
  const ti = input.tool_input || {};
  const path = ti.file_path;
  if (!path) return null;
  const partial = ti.offset !== undefined || ti.limit !== undefined;
  updateState(input, (s) => {
    const e = s.reads[path] || { full: 0, partial: 0 };
    if (partial) e.partial += 1; else e.full += 1;
    s.reads[path] = e;
  });
  return null;
});
```

- [ ] **Step 5: Write `governor/scripts/pre-tool-read.mjs`**

```js
#!/usr/bin/env node
import { isAbsolute, join } from 'node:path';
import { safeMain, pre } from './lib/io.mjs';
import { loadPolicy } from './lib/policy.mjs';
import { readState, updateState } from './lib/state.mjs';
import { loadKg, symbolsFor, memoriesFor, relPath, countLines } from './lib/kg.mjs';

await safeMain('pre-tool-read', async (input) => {
  if (input.tool_name !== 'Read') return null;
  const ti = input.tool_input || {};
  const path = ti.file_path;
  if (!path) return null;
  if (ti.offset !== undefined || ti.limit !== undefined) return null;

  const policy = loadPolicy(input.cwd, input);
  const state = readState(input);
  const seen = (state.reads[path] || { full: 0 }).full;
  const limit = (policy.reads && policy.reads.wholeFileLimit) || 3;
  if (seen < limit - 1) return null;

  const abs = isAbsolute(path) ? path : join(input.cwd || '.', path);
  const rel = relPath(input.cwd, path);
  const kg = loadKg(input.cwd, policy);
  const symbols = symbolsFor(kg, rel).slice(0, 10);
  const memories = memoriesFor(kg, rel).map((m) => m.title || m.path).slice(0, 5);
  const hint = [
    symbols.length ? `KG symbols: ${symbols.join(', ')}` : '',
    memories.length ? `memories: ${memories.join('; ')}` : ''
  ].filter(Boolean).join(' | ');

  if (seen === limit - 1) {
    updateState(input, (s) => { s.warnings += 1; });
    return pre({ additionalContext:
      `governor: ${rel} read ${seen}x in full already. Prefer offset/limit.${hint ? ' ' + hint : ''}` });
  }

  // seen >= limit: the fourth or later whole read.
  const lines = countLines(abs);
  const large = lines > ((policy.reads && policy.reads.largeFileLines) || 2000);
  const reason = `governor: ${rel} read ${limit}x in full; use offset/limit, or the KG symbols: ${symbols.join(', ') || '(none indexed)'}`;
  const enforcing = policy.enforce && policy.enforce.reads === true;
  if (large && enforcing && !state.overrides.reads) {
    updateState(input, (s) => { s.denials += 1; });
    return pre({ permissionDecision: 'deny', permissionDecisionReason: reason });
  }
  updateState(input, (s) => { s.warnings += 1; });
  return pre({ additionalContext: reason + (memories.length ? ` | memories: ${memories.join('; ')}` : '') });
});
```

- [ ] **Step 6: Add both registrations to `governor/hooks/hooks.json`**

Append to `PreToolUse` a `{ "matcher": "Read", ... pre-tool-read.mjs }` block and add a `PostToolUse` array with `{ "matcher": "Read", ... post-tool-read.mjs }`.

- [ ] **Step 7: Run the tests, expect pass**

Run: `cd governor && node --test tests/`
Expected: all PASS (the `!reads=off` case still skipped).

- [ ] **Step 8: Commit**

```bash
git add governor/scripts governor/hooks governor/tests
git commit -m "$(cat <<'EOF'
feat(governor): hook 2, whole-file read counter with KG-backed warnings

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Hook 3, UserPromptSubmit budget, overrides and status

**Files:**
- Create: `governor/scripts/user-prompt.mjs`, `governor/templates/handoff.md`
- Modify: `governor/hooks/hooks.json`, `governor/tests/hook-read.test.mjs` (un-skip the override case)
- Test: `governor/tests/hook-prompt.test.mjs`

**Interfaces:**
- Consumes: `countTranscript`, `readState`, `updateState`, `loadPolicy`, `prompt` from `lib/io.mjs`.
- Produces: the state fields `turns`, `compactions`, `overrides`, `capReached`, and a status line of the exact form
  `governor: turns <n> | compactions <n> | profile <p> | effort <e> | rewrites <n> | denials <n>`.
- Produces: `governor/templates/handoff.md` consumed by Task 7 and the `handoff` subcommand.

- [ ] **Step 1: Write the failing tests**

`governor/tests/hook-prompt.test.mjs`:
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { runHook, sandbox, hookOut, ROOT } from './helpers.mjs';

const FIXTURE = join(ROOT, 'tests', 'fixtures', 'transcript-two-compactions.jsonl');

function submit(s, text, extra = {}) {
  return runHook('user-prompt.mjs', {
    ...s, hook_event_name: 'UserPromptSubmit', prompt: text,
    effort: { level: 'medium' }, ...extra
  });
}

test('injects one status line', () => {
  const s = sandbox();
  const o = hookOut(submit(s, 'hello'));
  assert.equal(o.hookEventName, 'UserPromptSubmit');
  assert.match(o.additionalContext,
    /governor: turns \d+ \| compactions \d+ \| profile \S+ \| effort \S+ \| rewrites \d+ \| denials \d+/);
});

test('counts turns and compactions from the transcript', () => {
  const s = sandbox();
  const o = hookOut(submit(s, 'hello', { transcript_path: FIXTURE }));
  assert.ok(o.additionalContext.includes('turns 4'));
  assert.ok(o.additionalContext.includes('compactions 2'));
});

test('a raiseFor keyword adds the effort recommendation', () => {
  const s = sandbox();
  const o = hookOut(submit(s, 'help me debug this crash', { effort: { level: 'low' } }));
  assert.ok(/effort/.test(o.additionalContext));
  assert.ok(o.additionalContext.includes('/effort'));
});

test('override tokens are recorded for the session', () => {
  const s = sandbox();
  submit(s, 'go on !reads=off and !cap=off');
  const o = hookOut(submit(s, 'next'));
  assert.ok(o.additionalContext.includes('overrides: reads, cap'));
});

test('the cap injects the handoff instruction and sets capReached', () => {
  const s = sandbox({ session: { maxTurns: 2, maxCompactions: 99 } });
  const o = hookOut(submit(s, 'keep going', { transcript_path: FIXTURE }));
  assert.ok(o.additionalContext.includes('handoff'));
  assert.ok(/docs\/handoffs\/\d{4}-\d{2}-\d{2}-[a-z0-9-]+\.md/.test(o.additionalContext));
  assert.ok(o.additionalContext.includes('templates/handoff.md'));
});

test('the compaction cap also trips', () => {
  const s = sandbox({ session: { maxCompactions: 2, maxTurns: 99999 } });
  const o = hookOut(submit(s, 'keep going', { transcript_path: FIXTURE }));
  assert.ok(o.additionalContext.includes('handoff'));
});

test('!cap=off suppresses the handoff instruction', () => {
  const s = sandbox({ session: { maxTurns: 2 } });
  submit(s, 'noted !cap=off');
  const o = hookOut(submit(s, 'keep going', { transcript_path: FIXTURE }));
  assert.ok(!o.additionalContext.includes('write the handoff'));
});

test('a pending status stored by PreCompact is surfaced once', () => {
  const s = sandbox();
  runHook('pre-compact.mjs', { ...s, hook_event_name: 'PreCompact', reason: 'auto', transcript_path: FIXTURE });
  const first = hookOut(submit(s, 'after compaction')).additionalContext;
  assert.ok(first.includes('before compaction'));
  const second = hookOut(submit(s, 'again')).additionalContext;
  assert.ok(!second.includes('before compaction'));
});

test('a broken transcript path still returns a status line', () => {
  const s = sandbox();
  const o = hookOut(submit(s, 'hi', { transcript_path: '/nope/nope.jsonl' }));
  assert.ok(o.additionalContext.includes('turns 0'));
});
```

(The PreCompact case depends on Task 7; write it now as `test.skip` and un-skip it in Task 7.)

- [ ] **Step 2: Run the tests, expect failure**

Run: `cd governor && node --test tests/hook-prompt.test.mjs`
Expected: FAIL, no such file `scripts/user-prompt.mjs`.

- [ ] **Step 3: Write `governor/templates/handoff.md`**

```markdown
# Handoff: {{TITLE}}

Date: {{DATE}}
Branch: {{BRANCH}}
Session: {{SESSION}} ({{TURNS}} turns, {{COMPACTIONS}} compactions)

## What was asked

{{GOAL}}

## What is done

- 

## What is not done

- 

## Files that matter

| Path | Why |
|---|---|
|  |  |

## The next concrete step

1. 

## Traps found on the way

- 
```

- [ ] **Step 4: Write `governor/scripts/user-prompt.mjs`**

```js
#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { safeMain, prompt as promptOut } from './lib/io.mjs';
import { loadPolicy } from './lib/policy.mjs';
import { readState, writeState } from './lib/state.mjs';
import { countTranscript } from './lib/transcript.mjs';

export function branchSlug(cwd) {
  try {
    const b = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'],
      { cwd: cwd || '.', encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    return b.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'detached';
  } catch { return 'no-branch'; }
}

export function statusLine(s) {
  return `governor: turns ${s.turns} | compactions ${s.compactions} | profile ${s.profile}` +
    ` | effort ${s.effort || 'unknown'} | rewrites ${s.rewrites} | denials ${s.denials}`;
}

await safeMain('user-prompt', async (input) => {
  const policy = loadPolicy(input.cwd, input);
  const state = readState(input);
  const text = String(input.prompt || '');

  const counts = countTranscript(input.transcript_path);
  state.turns = counts.turns;
  state.compactions = counts.compactions;
  state.effort = (input.effort && input.effort.level) || state.effort;

  if (text.includes((policy.reads && policy.reads.override) || '!reads=off')) state.overrides.reads = true;
  if (text.includes((policy.session && policy.session.override) || '!cap=off')) state.overrides.cap = true;
  if (text.includes(policy.override || '!model=')) state.overrides.model = true;

  const lines = [];
  if (state.pendingStatus) { lines.push(state.pendingStatus); state.pendingStatus = null; }
  let status = statusLine(state);
  const active = Object.entries(state.overrides).filter(([, v]) => v).map(([k]) => k);
  if (active.length) status += ` | overrides: ${active.join(', ')}`;
  lines.push(status);

  const raise = (policy.effort && policy.effort.raiseFor) || [];
  const low = String(text).toLowerCase();
  if (raise.some((w) => low.includes(String(w).toLowerCase()))) {
    lines.push(`governor: this looks like ${raise.find((w) => low.includes(String(w).toLowerCase()))} work;` +
      ` effort is ${state.effort || 'unknown'} and the policy default is ${policy.effort.default}.` +
      ' Effort is per session: raise it with /effort if you need to.');
  }

  const maxTurns = policy.session.maxTurns;
  const maxComp = policy.session.maxCompactions;
  const over = state.turns >= maxTurns || state.compactions >= maxComp;
  if (over && !state.handoffWritten && !state.overrides.cap) {
    state.capReached = true;
    const date = new Date().toISOString().slice(0, 10);
    const file = `${policy.session.handoffPath}${date}-${branchSlug(input.cwd)}.md`;
    lines.push(`governor: session cap reached (turns ${state.turns}/${maxTurns},` +
      ` compactions ${state.compactions}/${maxComp}). Stop the current work and write the handoff` +
      ` to ${file} from the template at ${join('${CLAUDE_PLUGIN_ROOT}', 'templates', 'handoff.md')}` +
      ` (governor/templates/handoff.md), then start a fresh session. Override with !cap=off.`);
  }

  writeState(input, state);
  return promptOut({ additionalContext: lines.join('\n') });
});
```

- [ ] **Step 5: Add the UserPromptSubmit registration to `hooks/hooks.json`**

```json
"UserPromptSubmit": [
  { "hooks": [ { "type": "command", "command": "node \"${CLAUDE_PLUGIN_ROOT}/scripts/user-prompt.mjs\"" } ] }
]
```

- [ ] **Step 6: Un-skip the `!reads=off` test in `tests/hook-read.test.mjs`**

Change `test.skip('!reads=off ...` back to `test('!reads=off ...`.

- [ ] **Step 7: Run the tests, expect pass**

Run: `cd governor && node --test tests/`
Expected: all PASS except the PreCompact case, still skipped.

- [ ] **Step 8: Commit**

```bash
git add governor/scripts governor/hooks governor/templates governor/tests
git commit -m "$(cat <<'EOF'
feat(governor): hook 3, prompt budget, override tokens and status injection

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Hook 4, the cap gate and the handoff flag

**Files:**
- Create: `governor/scripts/pre-tool-cap.mjs`, `governor/scripts/post-tool-write.mjs`
- Modify: `governor/hooks/hooks.json`
- Test: `governor/tests/hook-cap.test.mjs`

**Interfaces:**
- Consumes: `readState`, `updateState`, `loadPolicy`.
- Produces: `isUnderHandoff(path, policy, cwd) -> boolean`; `isSafeBash(command) -> boolean` (exported from `pre-tool-cap.mjs` for the test).
- Produces: state flag `handoffWritten` set by `post-tool-write.mjs`.

- [ ] **Step 1: Write the failing tests**

`governor/tests/hook-cap.test.mjs`:
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { runHook, sandbox, hookOut, ROOT } from './helpers.mjs';

const FIXTURE = join(ROOT, 'tests', 'fixtures', 'transcript-two-compactions.jsonl');
const CAPPED = { session: { maxTurns: 2 }, enforce: { cap: true } };

function trip(s) {
  runHook('user-prompt.mjs', {
    ...s, hook_event_name: 'UserPromptSubmit', prompt: 'go', transcript_path: FIXTURE
  });
}
function gate(s, tool_name, tool_input) {
  return runHook('pre-tool-cap.mjs', { ...s, hook_event_name: 'PreToolUse', tool_name, tool_input });
}

test('before the cap nothing is gated', () => {
  const s = sandbox(CAPPED);
  assert.equal(gate(s, 'Bash', { command: 'npm test' }).out, '');
});

test('after the cap an ordinary call is denied', () => {
  const s = sandbox(CAPPED); trip(s);
  const o = hookOut(gate(s, 'Bash', { command: 'npm test' }));
  assert.equal(o.permissionDecision, 'deny');
  assert.ok(o.permissionDecisionReason.includes('handoff'));
});

test('a Write under handoffPath passes', () => {
  const s = sandbox(CAPPED); trip(s);
  assert.equal(gate(s, 'Write', { file_path: 'docs/handoffs/2026-09-22-main.md' }).out, '');
  assert.equal(gate(s, 'Edit', { file_path: join(s.cwd, 'docs/handoffs/x.md') }).out, '');
});

test('a Write elsewhere is denied', () => {
  const s = sandbox(CAPPED); trip(s);
  assert.equal(hookOut(gate(s, 'Write', { file_path: 'src/app.js' })).permissionDecision, 'deny');
});

test('read-only git and any Read pass', () => {
  const s = sandbox(CAPPED); trip(s);
  for (const c of ['git status', 'git diff --stat', 'git log --oneline -5', 'git add -A', 'git commit -m "x"']) {
    assert.equal(gate(s, 'Bash', { command: c }).out, '', c);
  }
  assert.equal(gate(s, 'Read', { file_path: 'anything.js' }).out, '');
});

test('git push is still denied after the cap', () => {
  const s = sandbox(CAPPED); trip(s);
  assert.equal(hookOut(gate(s, 'Bash', { command: 'git push' })).permissionDecision, 'deny');
});

test('warn-only is the default: enforce.cap false never denies', () => {
  const s = sandbox({ session: { maxTurns: 2 } }); trip(s);
  assert.equal(gate(s, 'Bash', { command: 'npm test' }).out, '');
});

test('writing the handoff lifts the gate', () => {
  const s = sandbox(CAPPED); trip(s);
  runHook('post-tool-write.mjs', {
    ...s, hook_event_name: 'PostToolUse', tool_name: 'Write',
    tool_input: { file_path: 'docs/handoffs/2026-09-22-main.md', content: '# Handoff' },
    tool_result: 'ok'
  });
  assert.equal(gate(s, 'Bash', { command: 'npm test' }).out, '');
});

test('!cap=off lifts the gate', () => {
  const s = sandbox(CAPPED);
  runHook('user-prompt.mjs', {
    ...s, hook_event_name: 'UserPromptSubmit', prompt: 'go !cap=off', transcript_path: FIXTURE
  });
  assert.equal(gate(s, 'Bash', { command: 'npm test' }).out, '');
});
```

- [ ] **Step 2: Run the tests, expect failure**

Run: `cd governor && node --test tests/hook-cap.test.mjs`
Expected: FAIL, no such file.

- [ ] **Step 3: Write `governor/scripts/pre-tool-cap.mjs`**

```js
#!/usr/bin/env node
import { isAbsolute, relative } from 'node:path';
import { safeMain, pre } from './lib/io.mjs';
import { loadPolicy } from './lib/policy.mjs';
import { readState } from './lib/state.mjs';

const SAFE_BASH = ['git status', 'git diff', 'git log', 'git add', 'git commit'];

export function isSafeBash(command) {
  const c = String(command || '').trim();
  return SAFE_BASH.some((p) => c.startsWith(p));
}

export function isUnderHandoff(path, handoffPath, cwd) {
  if (!path) return false;
  const norm = (isAbsolute(path) && cwd ? relative(cwd, path) : path).split('\\').join('/');
  return norm.startsWith(String(handoffPath).replace(/^\.\//, ''));
}

await safeMain('pre-tool-cap', async (input) => {
  const policy = loadPolicy(input.cwd, input);
  if (!(policy.enforce && policy.enforce.cap === true)) return null;
  const state = readState(input);
  if (!state.capReached || state.handoffWritten || state.overrides.cap) return null;

  const tool = input.tool_name;
  const ti = input.tool_input || {};
  if (tool === 'Read' || tool === 'Glob' || tool === 'Grep') return null;
  if ((tool === 'Write' || tool === 'Edit') &&
      isUnderHandoff(ti.file_path, policy.session.handoffPath, input.cwd)) return null;
  if (tool === 'Bash' && isSafeBash(ti.command)) return null;

  return pre({
    permissionDecision: 'deny',
    permissionDecisionReason:
      `governor: session cap reached (turns ${state.turns}, compactions ${state.compactions}).` +
      ` Write the handoff under ${policy.session.handoffPath} and start a fresh session,` +
      ` or override with ${policy.session.override} in your next prompt.`
  });
});
```

- [ ] **Step 4: Write `governor/scripts/post-tool-write.mjs`** (handoff flag only for now; the memory indexer lands in Task 8)

```js
#!/usr/bin/env node
import { safeMain } from './lib/io.mjs';
import { loadPolicy } from './lib/policy.mjs';
import { updateState } from './lib/state.mjs';
import { isUnderHandoff } from './pre-tool-cap.mjs';

await safeMain('post-tool-write', async (input) => {
  if (input.tool_name !== 'Write' && input.tool_name !== 'Edit') return null;
  const ti = input.tool_input || {};
  const policy = loadPolicy(input.cwd, input);
  if (isUnderHandoff(ti.file_path, policy.session.handoffPath, input.cwd)) {
    updateState(input, (s) => { s.handoffWritten = true; });
  }
  return null;
});
```

Note: importing `pre-tool-cap.mjs` runs its `safeMain`, which reads stdin. Avoid that — move `isSafeBash` and `isUnderHandoff` into a new `scripts/lib/paths.mjs` and import from there in both scripts. Do that now rather than later.

- [ ] **Step 5: Extract `governor/scripts/lib/paths.mjs`**

Move `SAFE_BASH`, `isSafeBash` and `isUnderHandoff` verbatim into `scripts/lib/paths.mjs` and import them in `pre-tool-cap.mjs` and `post-tool-write.mjs`. No hook script may import another hook script.

- [ ] **Step 6: Register in `hooks/hooks.json`**

Add a third `PreToolUse` entry with `"matcher": "*"` running `pre-tool-cap.mjs`, and a `PostToolUse` entry with `"matcher": "Write|Edit"` running `post-tool-write.mjs`.

- [ ] **Step 7: Run the tests, expect pass**

Run: `cd governor && node --test tests/`
Expected: all PASS.

- [ ] **Step 8: Commit**

```bash
git add governor/scripts governor/hooks governor/tests
git commit -m "$(cat <<'EOF'
feat(governor): hook 4, post-cap gate with handoff allowlist

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Hook 5, SessionStart scopes and PreCompact status carry-over

**Files:**
- Create: `governor/scripts/session-start.mjs`, `governor/scripts/pre-compact.mjs`, `governor/scripts/lib/areas.mjs`
- Modify: `governor/hooks/hooks.json`, `governor/tests/hook-prompt.test.mjs` (un-skip)
- Test: `governor/tests/hook-session.test.mjs`, `governor/tests/areas.test.mjs`

**Interfaces:**
- Consumes: `matchGlob`, `loadPolicy`, `updateState`, `branchSlug`.
- Produces: `areasFor(policy, changedPaths) -> string[]` (alias strings with `{1}` substituted from the first `*` capture); `gitBranch(cwd)`, `changedFiles(cwd)`.

- [ ] **Step 1: Write the failing tests**

`governor/tests/areas.test.mjs`:
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { defaults } from '../scripts/lib/policy.mjs';
import { areasFor } from '../scripts/lib/areas.mjs';

const P = defaults();

test('a game path resolves to a per-directory area alias', () => {
  assert.deepEqual(
    areasFor(P, ['apps/web-astro/public/games/tiny-tycoon-3d/game.js']),
    ['games/tiny-tycoon-3d']);
});

test('api and web paths resolve to their flat aliases', () => {
  assert.deepEqual(
    areasFor(P, ['apps/api/src/main.ts', 'apps/web-astro/src/pages/index.astro']).sort(),
    ['api', 'web']);
});

test('areas are deduplicated', () => {
  assert.deepEqual(areasFor(P, ['apps/api/a.ts', 'apps/api/b.ts']), ['api']);
});

test('an unmatched path yields no area', () => {
  assert.deepEqual(areasFor(P, ['README.md']), []);
});
```

`governor/tests/hook-session.test.mjs`:
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { runHook, sandbox, hookOut, ROOT } from './helpers.mjs';

const FIXTURE = join(ROOT, 'tests', 'fixtures', 'transcript-two-compactions.jsonl');

function repo(policy) {
  const s = sandbox(policy);
  const git = (...a) => execFileSync('git', a, { cwd: s.cwd, stdio: 'ignore' });
  git('init', '-b', 'main');
  git('config', 'user.email', 't@t'); git('config', 'user.name', 't');
  writeFileSync(join(s.cwd, 'README.md'), 'x');
  git('add', '-A'); git('commit', '-m', 'init');
  git('checkout', '-b', 'feat/tt3d-art');
  mkdirSync(join(s.cwd, 'apps/api/src'), { recursive: true });
  writeFileSync(join(s.cwd, 'apps/api/src/main.ts'), 'x');
  git('add', '-A'); git('commit', '-m', 'api');
  return s;
}

test('SessionStart reports branch, task memory pointer, profile and effort', () => {
  const s = repo();
  const o = hookOut(runHook('session-start.mjs', {
    ...s, hook_event_name: 'SessionStart', reason: 'startup',
    model: 'claude-opus-5', effort: { level: 'medium' }
  }));
  assert.equal(o.hookEventName, 'SessionStart');
  assert.ok(o.additionalContext.includes('feat/tt3d-art'));
  assert.ok(o.additionalContext.includes('.claude/memory/tasks/feat-tt3d-art'));
  assert.ok(o.additionalContext.includes('profile default'));
  assert.ok(o.additionalContext.includes('effort medium'));
});

test('SessionStart names the touched areas and only the rule files that exist', () => {
  const s = repo();
  mkdirSync(join(s.cwd, '.claude/rules'), { recursive: true });
  writeFileSync(join(s.cwd, '.claude/rules/api.md'), '---\npaths: apps/api/**\n---\nrule');
  const o = hookOut(runHook('session-start.mjs', {
    ...s, hook_event_name: 'SessionStart', reason: 'startup', effort: { level: 'high' }
  }));
  assert.ok(o.additionalContext.includes('.claude/rules/api.md'));
  assert.ok(!o.additionalContext.includes('.claude/rules/web.md'));
});

test('SessionStart outside a git repo still returns context', () => {
  const s = sandbox();
  const o = hookOut(runHook('session-start.mjs', { ...s, hook_event_name: 'SessionStart', reason: 'startup' }));
  assert.ok(o.additionalContext.includes('governor'));
});

test('PreCompact stores the status for the next turn', () => {
  const s = sandbox();
  const res = runHook('pre-compact.mjs', {
    ...s, hook_event_name: 'PreCompact', reason: 'auto', transcript_path: FIXTURE
  });
  assert.equal(res.code, 0);
  const o = hookOut(runHook('user-prompt.mjs', {
    ...s, hook_event_name: 'UserPromptSubmit', prompt: 'next', effort: { level: 'medium' }
  }));
  assert.ok(o.additionalContext.includes('before compaction'));
});
```

- [ ] **Step 2: Run the tests, expect failure**

Run: `cd governor && node --test tests/areas.test.mjs tests/hook-session.test.mjs`
Expected: FAIL, module not found.

- [ ] **Step 3: Write `governor/scripts/lib/areas.mjs`**

```js
import { execFileSync } from 'node:child_process';
import { globToRegExp } from './glob.mjs';

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
  return execFileSync('git', args, { cwd: cwd || '.', encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
}

export function gitBranch(cwd) {
  try { return git(cwd, ['rev-parse', '--abbrev-ref', 'HEAD']); } catch { return null; }
}

export function slug(branch) {
  return String(branch || 'no-branch').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/** Files the branch changed against its base, plus uncommitted changes. */
export function changedFiles(cwd) {
  const bases = ['origin/main', 'origin/master', 'main', 'master'];
  for (const base of bases) {
    try {
      const mb = git(cwd, ['merge-base', base, 'HEAD']);
      const names = git(cwd, ['diff', '--name-only', mb, 'HEAD']);
      const dirty = git(cwd, ['status', '--porcelain']).split('\n')
        .map((l) => l.slice(3).trim()).filter(Boolean);
      return [...new Set([...names.split('\n'), ...dirty])].filter(Boolean);
    } catch { /* try the next base */ }
  }
  try {
    return git(cwd, ['status', '--porcelain']).split('\n').map((l) => l.slice(3).trim()).filter(Boolean);
  } catch { return []; }
}
```

The `areaFor` regex builds capture groups from single `*` segments so `{1}` resolves; `apps/web-astro/public/games/*` must also match files under a game directory, hence the trailing `(?:/.*)?`.

- [ ] **Step 4: Write `governor/scripts/session-start.mjs`**

```js
#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { safeMain, sessionStart } from './lib/io.mjs';
import { loadPolicy } from './lib/policy.mjs';
import { readState, writeState } from './lib/state.mjs';
import { areasFor, gitBranch, slug, changedFiles } from './lib/areas.mjs';

await safeMain('session-start', async (input) => {
  const policy = loadPolicy(input.cwd, input);
  const state = readState(input);
  const cwd = input.cwd || '.';
  const branch = gitBranch(cwd);
  const areas = areasFor(policy, changedFiles(cwd));
  const effort = (input.effort && input.effort.level) || 'unknown';

  state.branch = branch; state.areas = areas;
  state.effort = effort;
  writeState(input, state);

  const lines = [`governor: branch ${branch || '(none)'} | profile ${state.profile} | effort ${effort}` +
    ` (policy default ${policy.effort.default})`];

  const taskDir = join(policy.memory.tasksDir, slug(branch));
  lines.push(existsSync(join(cwd, taskDir))
    ? `governor: task memory for this branch is ${taskDir}/ - read it before planning.`
    : `governor: task notes for this branch belong in ${taskDir}/ (not created yet).`);

  if (areas.length) {
    const rules = areas
      .map((a) => join(policy.memory.rulesDir, `${a.replace(/\//g, '-')}.md`))
      .filter((p) => existsSync(join(cwd, p)));
    lines.push(`governor: areas touched by this branch: ${areas.join(', ')}.` +
      (rules.length
        ? ` Rule files exist at ${rules.join(', ')}; they load on their own when a matching file is read.`
        : ' No area rule files exist yet.'));
  }

  if (effort !== 'unknown' && effort !== policy.effort.default) {
    lines.push(`governor: effort is ${effort}; the policy recommends ${policy.effort.default}.` +
      ' Effort is per session, set with /effort.');
  }

  return sessionStart({ additionalContext: lines.join('\n') });
});
```

- [ ] **Step 5: Write `governor/scripts/pre-compact.mjs`**

```js
#!/usr/bin/env node
import { safeMain } from './lib/io.mjs';
import { readState, writeState } from './lib/state.mjs';
import { countTranscript } from './lib/transcript.mjs';

await safeMain('pre-compact', async (input) => {
  const state = readState(input);
  const counts = countTranscript(input.transcript_path);
  state.turns = counts.turns;
  state.compactions = counts.compactions;
  state.pendingStatus =
    `governor: before compaction (${input.reason || 'auto'}) - turns ${state.turns} |` +
    ` compactions ${state.compactions} | profile ${state.profile} |` +
    ` rewrites ${state.rewrites} | denials ${state.denials}` +
    (state.branch ? ` | branch ${state.branch}` : '');
  writeState(input, state);
  return null;
});
```

- [ ] **Step 6: Register SessionStart and PreCompact in `hooks/hooks.json`, and un-skip the PreCompact test in `tests/hook-prompt.test.mjs`**

- [ ] **Step 7: Run the tests, expect pass**

Run: `cd governor && node --test tests/`
Expected: all PASS, nothing skipped.

- [ ] **Step 8: Commit**

```bash
git add governor/scripts governor/hooks governor/tests
git commit -m "$(cat <<'EOF'
feat(governor): hook 5, SessionStart scopes and PreCompact status carry-over

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Hook 6, the memory indexer on Write

**Files:**
- Modify: `governor/scripts/post-tool-write.mjs`
- Create: `governor/scripts/lib/extract.mjs`
- Test: `governor/tests/extract.test.mjs`, extend `governor/tests/hook-cap.test.mjs` with an indexer case in a new `governor/tests/hook-memory.test.mjs`

**Interfaces:**
- Consumes: `appendMemory`, `loadKg`, `matchGlob`.
- Produces: `extractRefs(body) -> { files: string[], symbols: string[] }`; `isMemoryPath(rel, policy) -> 'area'|'task'|'project'|null`; `memoryId(rel) -> string`; `titleOf(body, rel) -> string`.

- [ ] **Step 1: Write the failing tests**

`governor/tests/extract.test.mjs`:
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { defaults } from '../scripts/lib/policy.mjs';
import { extractRefs, isMemoryPath, titleOf, memoryId } from '../scripts/lib/extract.mjs';

test('backticked paths become files', () => {
  const r = extractRefs('The bug is in `apps/api/src/main.ts` and `src/game.js`.');
  assert.deepEqual(r.files, ['apps/api/src/main.ts', 'src/game.js']);
});

test('CamelCase and snake_case tokens become symbols', () => {
  const r = extractRefs('`AchievementsController` calls `unlock_achievement` once.');
  assert.ok(r.symbols.includes('AchievementsController'));
  assert.ok(r.symbols.includes('unlock_achievement'));
});

test('a backticked path is not also a symbol', () => {
  const r = extractRefs('`apps/api/main.ts`');
  assert.deepEqual(r.symbols, []);
});

test('isMemoryPath classifies the three scopes', () => {
  const P = defaults();
  assert.equal(isMemoryPath('.claude/rules/api.md', P), 'area');
  assert.equal(isMemoryPath('.claude/memory/tasks/feat-x/note.md', P), 'task');
  assert.equal(isMemoryPath('.claude/memory/archive/old.md', P), 'project');
  assert.equal(isMemoryPath('src/app.js', P), null);
});

test('the title is the first heading, else the file name', () => {
  assert.equal(titleOf('# Boat Jam pier grant\n\nbody', 'x.md'), 'Boat Jam pier grant');
  assert.equal(titleOf('no heading', '.claude/rules/api.md'), 'api');
});

test('the id is stable for a path', () => {
  assert.equal(memoryId('.claude/rules/api.md'), memoryId('.claude/rules/api.md'));
  assert.notEqual(memoryId('.claude/rules/api.md'), memoryId('.claude/rules/web.md'));
});
```

`governor/tests/hook-memory.test.mjs`:
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runHook, sandbox } from './helpers.mjs';

function withKg() {
  const s = sandbox();
  mkdirSync(join(s.cwd, '.claude/rules'), { recursive: true });
  writeFileSync(join(s.cwd, '.claude/knowledge_graph.json'), JSON.stringify({
    meta: { project: 'x' },
    files: { 'apps/api/src/main.ts': { lines: 10, symbols: ['bootstrap'] } },
    symbols: { bootstrap: { file: 'apps/api/src/main.ts' } }
  }));
  return s;
}

function write(s, rel, content) {
  writeFileSync(join(s.cwd, rel), content);
  return runHook('post-tool-write.mjs', {
    ...s, hook_event_name: 'PostToolUse', tool_name: 'Write',
    tool_input: { file_path: join(s.cwd, rel), content }, tool_result: 'ok'
  });
}

test('writing an area rule appends a memories entry checked against the graph', () => {
  const s = withKg();
  write(s, '.claude/rules/api.md',
    '# Api rules\n\nThe entry point is `apps/api/src/main.ts`, symbol `bootstrap`, and `NotIndexed`.');
  const kg = JSON.parse(readFileSync(join(s.cwd, '.claude/knowledge_graph.json'), 'utf8'));
  assert.equal(kg.memories.length, 1);
  const m = kg.memories[0];
  assert.equal(m.scope, 'area');
  assert.equal(m.title, 'Api rules');
  assert.deepEqual(m.files, ['apps/api/src/main.ts'], 'only files the graph knows');
  assert.deepEqual(m.symbols, ['bootstrap'], 'NotIndexed is dropped');
});

test('writing an ordinary source file indexes nothing', () => {
  const s = withKg();
  mkdirSync(join(s.cwd, 'src'), { recursive: true });
  write(s, 'src/app.js', 'const a = 1;');
  const kg = JSON.parse(readFileSync(join(s.cwd, '.claude/knowledge_graph.json'), 'utf8'));
  assert.equal(kg.memories, undefined);
});

test('the indexer never throws when there is no graph', () => {
  const s = sandbox();
  mkdirSync(join(s.cwd, '.claude/rules'), { recursive: true });
  assert.equal(write(s, '.claude/rules/api.md', '# x').code, 0);
});
```

- [ ] **Step 2: Run the tests, expect failure**

Run: `cd governor && node --test tests/extract.test.mjs tests/hook-memory.test.mjs`
Expected: FAIL.

- [ ] **Step 3: Write `governor/scripts/lib/extract.mjs`**

```js
import { createHash } from 'node:crypto';
import { basename } from 'node:path';

const PATHY = /[\\/]|\.[a-z]{1,5}$/i;

export function extractRefs(body) {
  const text = String(body || '');
  const files = [];
  const symbols = [];
  for (const m of text.matchAll(/`([^`\n]+)`/g)) {
    const tok = m[1].trim();
    if (PATHY.test(tok) && !/\s/.test(tok)) { if (!files.includes(tok)) files.push(tok); continue; }
    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(tok) && (/[A-Z]/.test(tok.slice(1)) || tok.includes('_'))) {
      if (!symbols.includes(tok)) symbols.push(tok);
    }
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
  if (m) return m[1].trim();
  return basename(String(rel || 'memory'), '.md');
}

export function memoryId(rel) {
  return 'mem-' + createHash('sha1').update(String(rel)).digest('hex').slice(0, 12);
}
```

- [ ] **Step 4: Extend `governor/scripts/post-tool-write.mjs`**

After the handoff flag block, add:
```js
  const rel = relPath(input.cwd, ti.file_path);
  const scope = isMemoryPath(rel, policy);
  if (!scope) return null;
  const kg = loadKg(input.cwd, policy);
  if (!kg) return null;
  let body = ti.content;
  if (body === undefined) { try { body = readFileSync(ti.file_path, 'utf8'); } catch { body = ''; } }
  const refs = extractRefs(body);
  const knownFiles = kg.files ? Object.keys(kg.files) : [];
  const knownSymbols = kg.symbols ? Object.keys(kg.symbols) : [];
  appendMemory(input.cwd, policy, {
    id: memoryId(rel), scope, path: rel, title: titleOf(body, rel),
    files: refs.files.filter((f) => knownFiles.includes(f)),
    symbols: refs.symbols.filter((sym) => knownSymbols.includes(sym))
  }, input);
  return null;
```
with the matching imports (`readFileSync`, `relPath`, `loadKg`, `appendMemory`, `extractRefs`, `isMemoryPath`, `titleOf`, `memoryId`). The `Write|Edit` matcher already registered in Task 6 covers this; no hooks.json change.

- [ ] **Step 5: Run the tests, expect pass**

Run: `cd governor && node --test tests/`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add governor/scripts governor/tests
git commit -m "$(cat <<'EOF'
feat(governor): hook 6, memory indexer appending to the knowledge graph

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: fold.mjs, the memory and task fold engine

**Files:**
- Create: `governor/scripts/fold.mjs`, `governor/scripts/status.mjs`
- Test: `governor/tests/fold.test.mjs` with a fixture memory directory built at test time

**Interfaces:**
- Consumes: `loadPolicy`, `areasFor`, `slug`, `appendMemory`.
- Produces CLI:
  - `node fold.mjs memory --cwd <dir> --memory-dir <dir>` prints `{ "aliases": {...}, "assignments": [ { "file", "slug", "area", "rollup", "reason" } ], "rollups": { "<name>": ["file", ...] }, "rules": ["..."], "moves": [ { "from", "to" } ] }` and moves nothing.
  - `node fold.mjs memory --cwd <dir> --memory-dir <dir> --apply --approved <plan.json>` performs the moves in the approved plan.
  - `node fold.mjs task --cwd <dir> --branch <name>` prints the task's notes and a proposed disposition; `--apply --approved <plan.json>` moves them.
- Produces: `status.mjs` printing the state JSON plus orphan memories for `/governor status`.

- [ ] **Step 1: Write the failing tests**

`governor/tests/fold.test.mjs`:
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { sandbox, ROOT } from './helpers.mjs';

function fold(args) {
  const r = spawnSync(process.execPath, [join(ROOT, 'scripts', 'fold.mjs'), ...args], { encoding: 'utf8' });
  return { code: r.status, out: r.stdout.trim(), err: r.stderr,
    json: r.stdout.trim().startsWith('{') ? JSON.parse(r.stdout.trim()) : null };
}

function fixtureMemory() {
  const s = sandbox({ memory: { areas: { 'games/*': 'games/{1}' } } });
  mkdirSync(join(s.cwd, 'games/tiny-tycoon-3d'), { recursive: true });
  mkdirSync(join(s.cwd, 'games/boat-jam'), { recursive: true });
  const mem = join(s.cwd, 'fixture-memory');
  mkdirSync(mem, { recursive: true });
  writeFileSync(join(mem, 'MEMORY.md'), '# Memory Index\n\n- [tt3d gate traps](reference_tt3d_gate_traps.md)\n');
  writeFileSync(join(mem, 'reference_tt3d_gate_traps.md'), '# TT3D gate traps\n\nSilent until the end.\n');
  writeFileSync(join(mem, 'project_boatjam_pier_grant.md'), '# Boat Jam pier grant\n\nThe row re-lays.\n');
  writeFileSync(join(mem, 'project_api_thing.md'), '# Api thing\n\nSee `games/boat-jam/main.js`.\n');
  writeFileSync(join(mem, 'feedback_no_em_dash.md'), '# No em dash\n\nNever.\n');
  return { s, mem };
}

test('propose prints a plan and moves nothing', () => {
  const { s, mem } = fixtureMemory();
  const before = readdirSync(mem).sort();
  const r = fold(['memory', '--cwd', s.cwd, '--memory-dir', mem]);
  assert.equal(r.code, 0);
  assert.ok(r.json.aliases);
  assert.ok(Array.isArray(r.json.assignments));
  assert.deepEqual(readdirSync(mem).sort(), before, 'propose is read-only');
});

test('assignment by alias: tt3d maps to the tiny-tycoon-3d area', () => {
  const { s, mem } = fixtureMemory();
  const a = fold(['memory', '--cwd', s.cwd, '--memory-dir', mem]).json
    .assignments.find((x) => x.file === 'reference_tt3d_gate_traps.md');
  assert.equal(a.area, 'games/tiny-tycoon-3d');
  assert.equal(a.reason, 'alias');
});

test('assignment by slug: boatjam maps to boat-jam', () => {
  const { s, mem } = fixtureMemory();
  const a = fold(['memory', '--cwd', s.cwd, '--memory-dir', mem]).json
    .assignments.find((x) => x.file === 'project_boatjam_pier_grant.md');
  assert.equal(a.area, 'games/boat-jam');
});

test('assignment by a path in the body when the slug does not match', () => {
  const { s, mem } = fixtureMemory();
  const a = fold(['memory', '--cwd', s.cwd, '--memory-dir', mem]).json
    .assignments.find((x) => x.file === 'project_api_thing.md');
  assert.equal(a.area, 'games/boat-jam');
  assert.equal(a.reason, 'path');
});

test('feedback memories stay top level in the feedback rollup', () => {
  const { s, mem } = fixtureMemory();
  const a = fold(['memory', '--cwd', s.cwd, '--memory-dir', mem]).json
    .assignments.find((x) => x.file === 'feedback_no_em_dash.md');
  assert.equal(a.area, null);
  assert.equal(a.rollup, 'rollup_feedback.md');
});

test('--apply without --approved refuses and moves nothing', () => {
  const { s, mem } = fixtureMemory();
  const before = readdirSync(mem).sort();
  const r = fold(['memory', '--cwd', s.cwd, '--memory-dir', mem, '--apply']);
  assert.notEqual(r.code, 0);
  assert.deepEqual(readdirSync(mem).sort(), before);
});

test('--apply with an approved plan writes rollups and rule files but deletes nothing', () => {
  const { s, mem } = fixtureMemory();
  const plan = fold(['memory', '--cwd', s.cwd, '--memory-dir', mem]).json;
  const planPath = join(s.cwd, 'plan.json');
  writeFileSync(planPath, JSON.stringify(plan));
  const r = fold(['memory', '--cwd', s.cwd, '--memory-dir', mem, '--apply', '--approved', planPath]);
  assert.equal(r.code, 0);
  assert.ok(existsSync(join(mem, 'rollup_feedback.md')));
  assert.ok(existsSync(join(s.cwd, '.claude/rules/games-tiny-tycoon-3d.md')));
  assert.ok(existsSync(join(mem, 'reference_tt3d_gate_traps.md')), 'existing memory files are never deleted');
  const idx = require('node:fs').readFileSync(join(mem, 'MEMORY.md'), 'utf8');
  assert.ok(idx.includes('rollup_feedback.md'));
  assert.ok(Buffer.byteLength(idx) <= 8192);
});

test('the rule file carries a paths frontmatter derived from the area glob', () => {
  const { s, mem } = fixtureMemory();
  const plan = fold(['memory', '--cwd', s.cwd, '--memory-dir', mem]).json;
  const planPath = join(s.cwd, 'plan.json');
  writeFileSync(planPath, JSON.stringify(plan));
  fold(['memory', '--cwd', s.cwd, '--memory-dir', mem, '--apply', '--approved', planPath]);
  const rule = require('node:fs').readFileSync(join(s.cwd, '.claude/rules/games-tiny-tycoon-3d.md'), 'utf8');
  assert.ok(rule.startsWith('---\n'));
  assert.ok(rule.includes('paths:'));
  assert.ok(rule.includes('games/tiny-tycoon-3d/**'));
});

test('task fold lists a branch note set and proposes a disposition', () => {
  const { s } = fixtureMemory();
  mkdirSync(join(s.cwd, '.claude/memory/tasks/feat-x'), { recursive: true });
  writeFileSync(join(s.cwd, '.claude/memory/tasks/feat-x/note.md'), '# Note\n\n`games/boat-jam/main.js`\n');
  const r = fold(['task', '--cwd', s.cwd, '--branch', 'feat/x']);
  assert.equal(r.code, 0);
  assert.equal(r.json.notes.length, 1);
  assert.equal(r.json.notes[0].proposed, 'games/boat-jam');
  assert.ok(existsSync(join(s.cwd, '.claude/memory/tasks/feat-x/note.md')), 'nothing moved');
});

test('task fold --apply archives the notes not kept', () => {
  const { s } = fixtureMemory();
  mkdirSync(join(s.cwd, '.claude/memory/tasks/feat-x'), { recursive: true });
  writeFileSync(join(s.cwd, '.claude/memory/tasks/feat-x/note.md'), '# Note\n');
  const plan = fold(['task', '--cwd', s.cwd, '--branch', 'feat/x']).json;
  plan.notes[0].keep = false;
  const planPath = join(s.cwd, 'taskplan.json');
  writeFileSync(planPath, JSON.stringify(plan));
  fold(['task', '--cwd', s.cwd, '--branch', 'feat/x', '--apply', '--approved', planPath]);
  assert.ok(existsSync(join(s.cwd, '.claude/memory/archive/feat-x/note.md')));
});

test('the fold adds the tasks dir to .gitignore once', () => {
  const { s, mem } = fixtureMemory();
  const plan = fold(['memory', '--cwd', s.cwd, '--memory-dir', mem]).json;
  const planPath = join(s.cwd, 'plan.json');
  writeFileSync(planPath, JSON.stringify(plan));
  fold(['memory', '--cwd', s.cwd, '--memory-dir', mem, '--apply', '--approved', planPath]);
  fold(['memory', '--cwd', s.cwd, '--memory-dir', mem, '--apply', '--approved', planPath]);
  const gi = require('node:fs').readFileSync(join(s.cwd, '.gitignore'), 'utf8');
  assert.equal(gi.split('\n').filter((l) => l.trim() === '.claude/memory/tasks/').length, 1);
});
```

(Replace every `require('node:fs')` with a top-level `import { readFileSync } from 'node:fs';` — ESM has no `require`.)

- [ ] **Step 2: Run the tests, expect failure**

Run: `cd governor && node --test tests/fold.test.mjs`
Expected: FAIL, `Cannot find module '.../scripts/fold.mjs'`.

- [ ] **Step 3: Write `governor/scripts/fold.mjs`**

Structure (full implementation, no placeholders):

```js
#!/usr/bin/env node
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync, appendFileSync, copyFileSync, rmSync } from 'node:fs';
import { join, basename, dirname } from 'node:path';
import { loadPolicy } from './lib/policy.mjs';
import { slug } from './lib/areas.mjs';

const SEED_ALIASES = { boatjam: 'boat-jam', tt3d: 'tiny-tycoon-3d', vb2: 'voidbreak-2',
  voidbreak2: 'voidbreak-2', dd: 'doodle-dash', wa: 'weekly-arcade' };

function argv() {
  const a = process.argv.slice(2);
  const out = { _: [] };
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith('--')) {
      const k = a[i].slice(2);
      out[k] = (a[i + 1] && !a[i + 1].startsWith('--')) ? a[++i] : true;
    } else out._.push(a[i]);
  }
  return out;
}

/** Every directory that matches a single-* area glob is an area; flat globs are areas by alias. */
function discoverAreas(cwd, policy) {
  const areas = [];
  for (const [pattern, alias] of Object.entries(policy.memory.areas || {})) {
    if (pattern.includes('*') && alias.includes('{1}')) {
      const base = pattern.slice(0, pattern.indexOf('*')).replace(/\/$/, '');
      let entries = [];
      try { entries = readdirSync(join(cwd, base), { withFileTypes: true }); } catch { entries = []; }
      for (const e of entries) {
        if (!e.isDirectory()) continue;
        areas.push({ name: alias.replace('{1}', e.name), dir: `${base}/${e.name}`,
          glob: `${base}/${e.name}/**` });
      }
    } else {
      areas.push({ name: alias.replace(/\{\d+\}/g, ''), dir: pattern.replace(/\/?\*+$/, ''), glob: pattern });
    }
  }
  return areas;
}

function aliasTable(areas) {
  const table = { ...SEED_ALIASES };
  for (const a of areas) {
    const dir = basename(a.dir);
    table[dir.replace(/-/g, '')] = dir;                                   // boatjam -> boat-jam
    const initials = dir.split('-').map((w) => w[0]).join('');
    if (initials.length >= 2) table[initials] = dir;                      // tt3 style
    const numTail = dir.match(/^([a-z]+)-?([a-z]*)-?(\d+)$/);
    if (numTail) table[numTail[1].slice(0, 2) + numTail[3]] = dir;        // vb2 -> voidbreak-2
  }
  return table;
}

function tokens(file) {
  return basename(file, '.md').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

function rollupFor(file, area) {
  if (area) return `rollup_${area.replace(/\//g, '_')}.md`;
  const n = basename(file).toLowerCase();
  if (n.startsWith('feedback_')) return 'rollup_feedback.md';
  if (n.startsWith('reference_')) return 'rollup_reference.md';
  return 'rollup_project.md';
}

function firstLine(body) {
  for (const l of String(body).split('\n')) {
    const t = l.trim();
    if (t && !t.startsWith('#')) return t.replace(/\s+/g, ' ').slice(0, 120);
  }
  return '';
}

function assign(file, body, areas, table) {
  const name = basename(file).toLowerCase();
  if (name.startsWith('feedback_')) return { area: null, reason: 'feedback' };
  const toks = tokens(file);
  for (const a of areas) {
    const dir = basename(a.dir);
    if (toks.includes(dir.replace(/-/g, ''))) return { area: a.name, reason: 'alias' };
    for (const t of toks) if (table[t] === dir) return { area: a.name, reason: 'alias' };
    if (toks.join('-').includes(dir)) return { area: a.name, reason: 'slug' };
  }
  for (const m of String(body).matchAll(/`([^`\n]+)`/g)) {
    const p = m[1].trim();
    for (const a of areas) if (p.startsWith(a.dir + '/') || p === a.dir) return { area: a.name, reason: 'path' };
  }
  return { area: null, reason: 'unmatched' };
}
```

`proposeMemory(cwd, memDir, policy)` builds `{ aliases, assignments, rollups, rules, index }` where each assignment is `{ file, slug, area, rollup, reason, hook }` (`hook` = `firstLine(body)`), `rollups` maps a rollup file name to its member files, `rules` maps an area name to `{ path: '.claude/rules/<area-with-slashes-as-dashes>.md', glob }`, and `index` is the MEMORY.md body: one line per rollup, truncated to `policy.memory.indexBudgetBytes`.

`applyMemory(cwd, memDir, plan, policy)`:
- For each rollup, write `<memDir>/<rollup>` containing `# <rollup title>` and one bullet per member: `- [[<file-without-.md>]] - <hook>` so every existing `[[name]]` still resolves.
- For each area in `plan.rules`, `mkdirSync(.claude/rules)` and write the rule file: frontmatter `---\npaths: <glob>\n---\n# <area>\n` followed by its members' bullets. Never overwrite an existing rule file's body: if it exists, append a `## governor fold <date>` section instead.
- Rewrite `<memDir>/MEMORY.md` to `plan.index`.
- Append `.claude/memory/tasks/` to `.gitignore` if not already a line there.
- Never delete or move an original memory file. Report `{ wrote: [...], skipped: [...] }` on stdout.

`proposeTask(cwd, branch, policy)`: lists `<tasksDir>/<slug(branch)>/*.md`, and for each returns `{ file, title, proposed, keep: true }` where `proposed` is the area from `assign(...)` or `'rollup_project.md'`.

`applyTask(cwd, branch, plan, policy)`: for each note with `keep === true`, append its body under a `## <title>` section of the area rule (or the project rollup); for each with `keep === false`, copy to `<archiveDir>/<slug(branch)>/<file>` and remove the original from the tasks dir. Notes kept are also archived after being folded in.

Guard, at the top of both apply paths:
```js
if (args.apply && !args.approved) {
  process.stderr.write('governor fold: --apply requires --approved <plan.json>\n');
  process.exit(2);
}
```

- [ ] **Step 4: Write `governor/scripts/status.mjs`**

Reads `--session <id> --scratchpad <dir> --cwd <dir>`, loads the state and the KG, and prints JSON `{ turns, compactions, profile, effort, rewrites, denials, warnings, overrides, capReached, handoffWritten, branch, areas, orphanMemories }` where `orphanMemories` are `kg.memories` entries whose `path` no longer exists on disk or whose `files` include a path that no longer exists.

- [ ] **Step 5: Run the tests, expect pass**

Run: `cd governor && node --test tests/`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add governor/scripts governor/tests
git commit -m "$(cat <<'EOF'
feat(governor): fold engine for memory and task scopes, propose-then-apply only

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: Command, skill and README

**Files:**
- Create: `governor/commands/governor.md`, `governor/skills/governor-rules/SKILL.md`, `governor/README.md`
- Test: `governor/tests/docs.test.mjs`

**Interfaces:**
- Consumes: `scripts/fold.mjs`, `scripts/status.mjs` CLI contracts from Task 9.
- Produces: no code interface; the command file is the instruction surface.

- [ ] **Step 1: Write the failing test**

`governor/tests/docs.test.mjs`:
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './helpers.mjs';

test('the command file has frontmatter with a description and argument-hint', () => {
  const src = readFileSync(join(ROOT, 'commands', 'governor.md'), 'utf8');
  assert.ok(src.startsWith('---\n'));
  assert.match(src, /^description:/m);
  assert.match(src, /^argument-hint:/m);
  for (const sub of ['status', 'profile', 'memory fold', 'task fold', 'handoff']) {
    assert.ok(src.includes(sub), `missing subcommand ${sub}`);
  }
});

test('the command never tells the model to apply a fold without approval', () => {
  const src = readFileSync(join(ROOT, 'commands', 'governor.md'), 'utf8');
  assert.ok(src.includes('--approved'));
  assert.ok(/never.*--apply/i.test(src) || /approval/i.test(src));
});

test('the skill has name and description frontmatter', () => {
  const src = readFileSync(join(ROOT, 'skills', 'governor-rules', 'SKILL.md'), 'utf8');
  assert.ok(src.startsWith('---\n'));
  assert.match(src, /^name: governor-rules$/m);
  assert.match(src, /^description:/m);
});

test('the README records the harness contract shapes the hooks rely on', () => {
  const src = readFileSync(join(ROOT, 'README.md'), 'utf8');
  for (const k of ['updatedInput', 'permissionDecision', 'additionalContext', 'systemMessage',
    'hookSpecificOutput', 'scratchpad_dir', 'transcript_path', 'compact_boundary']) {
    assert.ok(src.includes(k), `README does not record ${k}`);
  }
});

test('every hook script named in hooks.json exists', () => {
  const hooks = JSON.parse(readFileSync(join(ROOT, 'hooks', 'hooks.json'), 'utf8'));
  const cmds = JSON.stringify(hooks).match(/scripts\/[a-z-]+\.mjs/g) || [];
  assert.ok(cmds.length >= 8, `expected at least 8 registrations, found ${cmds.length}`);
  for (const c of cmds) assert.ok(existsSync(join(ROOT, c)), `${c} is registered but missing`);
});
```

- [ ] **Step 2: Run, expect failure**

Run: `cd governor && node --test tests/docs.test.mjs`
Expected: FAIL, ENOENT on `commands/governor.md`.

- [ ] **Step 3: Write `governor/commands/governor.md`**

Frontmatter:
```markdown
---
description: Inspect and drive the governor - session status, plugin profiles, the memory and task folds, and the handoff
argument-hint: status | profile <name|off> | memory fold | task fold [branch] | handoff
---
```
Body: `**Arguments**: $ARGUMENTS`, then one `## <subcommand>` section each, in the hplugins command style:
- `status`: run `node "${CLAUDE_PLUGIN_ROOT}/scripts/status.mjs" --cwd "$(pwd)"`, print turns, compactions, profile, effort, rewrites, denials, active overrides, orphan memories.
- `profile <name|off>`: read `profiles` from the merged policy, compute the set (`default` plus each `+plugin`), diff it against `claude plugin list`, run `claude plugin enable|disable` per difference, then tell the user to run `/reload-plugins`. `off` restores `baselinePlugins` recorded at session start. State the plugin set before changing anything and ask for confirmation.
- `memory fold`: run `fold.mjs memory` without `--apply`, show the alias table and the assignments as a table, **ask the user to approve or edit**, write the approved plan to the scratchpad, then run with `--apply --approved <path>`. Never pass `--apply` before approval. Never run against the user's real memory directory without naming the directory first.
- `task fold [branch]`: same propose/approve/apply cycle with `fold.mjs task`.
- `handoff`: read `${CLAUDE_PLUGIN_ROOT}/templates/handoff.md`, fill it from the session, write it to `<handoffPath><yyyy-mm-dd>-<branch-slug>.md`, and say the session is done.

- [ ] **Step 4: Write `governor/skills/governor-rules/SKILL.md`**

```markdown
---
name: governor-rules
description: >
  The cost rules the governor plugin enforces in hooks, in human-readable form.
  Applied when a subagent model, a repeated whole-file read, session length,
  compaction, handoff timing or memory scope is in question, and when a governor
  hook has rewritten or denied a call and the reason needs explaining.
---
```
Body sections: the tier table and how a tier is resolved; the override tokens `!model=<name>`, `!reads=off`, `!cap=off` and that an override is a prompt token, never a settings edit; the read rules (three whole reads warn, the fourth denies above the large-file line count, offset/limit always passes); the budget and what the handoff must contain; the three memory scopes and which one a new memory belongs to; effort being per session; what the plugin will never do (deny an Agent call, delete a memory file, move a file without `--apply`, edit settings.json).

- [ ] **Step 5: Write `governor/README.md`**

Sections: what it does; install and enable; the policy file with every key and its default; the six hooks with the exact stdin fields each reads and the exact stdout shape each returns (the harness contract block from this plan's Global Constraints, verbatim, with the docs URL and the date checked, so a harness change is one diff away from visible); fail-open behaviour and the log path; the rollout stages and which switches `0.1.0` ships off (`enforce.reads`, `enforce.cap`); running the tests; the e2e procedure with `claude -p --plugin-dir`.

- [ ] **Step 6: Run the tests, expect pass**

Run: `cd governor && node --test tests/`
Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add governor/commands governor/skills governor/README.md governor/tests
git commit -m "$(cat <<'EOF'
docs(governor): /governor command, governor-rules skill and README harness contract

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: Marketplace registration

**Files:**
- Modify: `.claude-plugin/marketplace.json`
- Test: `governor/tests/marketplace.test.mjs`

**Interfaces:**
- Consumes: `governor/.claude-plugin/plugin.json` version.
- Produces: an installable `governor@hplugins`.

- [ ] **Step 1: Write the failing test**

`governor/tests/marketplace.test.mjs`:
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './helpers.mjs';

const mp = JSON.parse(readFileSync(join(ROOT, '..', '.claude-plugin', 'marketplace.json'), 'utf8'));
const plugin = JSON.parse(readFileSync(join(ROOT, '.claude-plugin', 'plugin.json'), 'utf8'));

test('governor is registered', () => {
  const e = mp.plugins.find((p) => p.name === 'governor');
  assert.ok(e, 'no governor entry');
  assert.equal(e.source, './governor');
  assert.equal(e.version, '0.1.0');
  assert.equal(e.version, plugin.version, 'marketplace and plugin versions agree');
  assert.ok(e.description && e.description.length > 20);
  assert.ok(e.author && e.author.name);
  assert.equal(e.category, 'productivity');
  assert.ok(Array.isArray(e.tags) && e.tags.length >= 3);
});

test('the marketplace metadata version was bumped past 1.1.0', () => {
  const [maj, min] = mp.metadata.version.split('.').map(Number);
  assert.ok(maj > 1 || min >= 2, `metadata.version is ${mp.metadata.version}`);
});
```

- [ ] **Step 2: Run, expect failure**

Run: `cd governor && node --test tests/marketplace.test.mjs`
Expected: FAIL, "no governor entry".

- [ ] **Step 3: Add the entry to `.claude-plugin/marketplace.json`**

Append after the last plugin, following the existing entries' key order exactly:
```json
{
  "name": "governor",
  "source": "./governor",
  "description": "Cost governance hooks: subagent model tiers, whole-file read limits, a turn and compaction budget with a handoff cap, scoped memory and plugin profiles",
  "version": "0.1.0",
  "author": { "name": "Himanshu Singh" },
  "homepage": "https://github.com/HimanshuSingh2308/claude-code-plugins",
  "repository": "https://github.com/HimanshuSingh2308/claude-code-plugins",
  "license": "MIT",
  "keywords": ["governance", "cost", "hooks", "subagents", "context", "memory", "budget"],
  "category": "productivity",
  "tags": ["governance", "cost", "hooks", "memory"]
}
```
and set `metadata.version` to `"1.2.0"`.

- [ ] **Step 4: Run the full suite, expect pass**

Run: `cd governor && node --test tests/`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add .claude-plugin/marketplace.json governor/tests
git commit -m "$(cat <<'EOF'
chore(marketplace): register governor 0.1.0 and bump metadata version

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```

---

### Task 12: End-to-end verification under the real harness

**Files:**
- Create (scratchpad only, not committed): `<scratchpad>/governor/e2e/` temp git repo
- Modify: `governor/README.md` (record the result and the command)

**Interfaces:**
- Consumes: the whole plugin.
- Produces: transcript evidence paths pasted into the README's e2e section.

- [ ] **Step 1: Build the temp repo**

```bash
E2E=/private/tmp/claude-502/-Users-hsingh1/a0d1f9a1-ebc0-4e00-8b12-aeb2197e921e/scratchpad/governor/e2e
rm -rf "$E2E" && mkdir -p "$E2E/.claude"
cd "$E2E" && git init -b main -q && git config user.email t@t && git config user.name t
printf '{\n  "enforce": { "reads": false, "cap": false }\n}\n' > .claude/governor.json
node -e 'const fs=require("fs");let s="";for(let i=1;i<=3000;i++)s+=`// line ${i}\n`;fs.writeFileSync("dummy.js",s)'
git add -A && git commit -qm init
```

- [ ] **Step 2: Run the scripted prompt with the plugin loaded**

```bash
cd "$E2E" && claude -p --plugin-dir /Users/hsingh1/.claude/plugins/marketplaces/hplugins/governor \
  --permission-mode bypassPermissions \
  'Use the Explore agent to list the files here, then read dummy.js in full four separate times with the Read tool (no offset, no limit). Do not summarise between reads.' \
  > "$E2E/run1.txt" 2>&1
```
If `--plugin-dir` is rejected, stop and record in the README that the e2e could not run under the harness, and that each hook was verified instead through `tests/hook-*.test.mjs`, which drive the real scripts over real stdin JSON recorded from the hooks reference.

- [ ] **Step 3: Assert the model rewrite from the transcript**

```bash
SAN=$(node -e 'console.log(process.argv[1].replace(/[^A-Za-z0-9]/g,"-"))' "$E2E")
T=$(ls -t ~/.claude/projects/$SAN/*.jsonl | head -1); echo "$T"
node -e '
const fs=require("fs");const lines=fs.readFileSync(process.argv[1],"utf8").split("\n");
for(const l of lines){if(!l.trim())continue;let j;try{j=JSON.parse(l)}catch{continue}
 const c=j.message&&j.message.content;if(!Array.isArray(c))continue;
 for(const b of c){if(b.type==="tool_use"&&(b.name==="Agent"||b.name==="Task"))
   console.log("AGENT model=",b.input.model,"type=",b.input.subagent_type);}}' "$T"
```
Expected: `AGENT model= haiku type= Explore`.

- [ ] **Step 4: Assert the fourth Read carried the warning**

```bash
grep -c 'read 3x in full' "$T"; grep -o 'governor: [^"]\{0,120\}' "$T" | sort | uniq -c
```
Expected: at least one `governor: dummy.js read 3x in full` string, and no `permissionDecision":"deny"` for the Read.

- [ ] **Step 5: Run once more with denial on**

```bash
printf '{\n  "enforce": { "reads": true, "cap": false }\n}\n' > "$E2E/.claude/governor.json"
cd "$E2E" && claude -p --plugin-dir /Users/hsingh1/.claude/plugins/marketplaces/hplugins/governor \
  --permission-mode bypassPermissions \
  'Read dummy.js in full five separate times with the Read tool. No offset, no limit.' \
  > "$E2E/run2.txt" 2>&1
grep -o 'use offset/limit[^"]\{0,60\}' "$E2E"/run2.txt ~/.claude/projects/$SAN/*.jsonl | head -3
```
Expected: the denial reason appears as a tool result.

- [ ] **Step 6: Record the evidence in the README**

Add an `## End-to-end verification` section naming: the command run, the transcript path, the observed `AGENT model=haiku` line, the warning string on the fourth read, and the denial string with `enforce.reads: true`.

- [ ] **Step 7: Commit**

```bash
git add governor/README.md
git commit -m "$(cat <<'EOF'
docs(governor): record the end-to-end harness verification and its evidence

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```

---

## Self-review against the spec

- Section 1 layout: Tasks 1, 3-10 create every listed path. Policy schema is Task 1 Step 5 verbatim plus `enforce` and `harnessSkill`.
- Tier resolution order (type glob, keyword, default, `!model=` wins): Task 3, six tests.
- Effort per session, reported at SessionStart and on a `raiseFor` keyword: Tasks 5 and 7.
- Hook 1 rewrite + harness marker: Task 3. Hook 2 counter: Task 4. Hook 3 budget: Task 5. Hook 4 cap: Task 6. Hook 5 SessionStart/PreCompact: Task 7. Hook 6 memory indexer: Task 8.
- Section 3 memory: area rules with `paths:` frontmatter, task dir plus gitignore, rollups that keep `[[name]]` resolvable, alias approval, KG `memories` key, `meta.schemaVersion` guard: Tasks 8 and 9.
- Section 4: commands (Task 10), marketplace (Task 11), the full Testing list (Tasks 1-11), rollout 0.1.0 switches (`enforce` off, Task 1), e2e (Task 12).
- Deliberately deferred, and said so in the README: `/governor profile` performs plugin enable/disable through the command's instructions rather than a script, because the spec places profiles at 0.4.0 "once the runtime reload is proven"; no test can prove `claude plugin enable` inside `node --test` without mutating the user's installation.
