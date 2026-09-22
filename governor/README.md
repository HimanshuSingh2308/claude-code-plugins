# governor

Cost governance for Claude Code, as hooks rather than prose. The governor rewrites
subagent models to a tier, counts whole-file re-reads, reports a turn and compaction
budget, gates a session once it passes its cap, and indexes memory into the project's
knowledge graph.

Nothing in the plugin names a project, a game or a user. A project opts in by having
`.claude/governor.json`; a project without one gets `policy/default.json`.

Version 0.1.2. Node 24, no npm dependencies.

## Install

```
/plugin marketplace add HimanshuSingh2308/claude-code-plugins   # if hplugins is not added yet
/plugin install governor@hplugins
```

Then reload plugins (`/reload-plugins`) or restart the session.

## The policy file

`.claude/governor.json` in the project. Every missing key falls back to
`policy/default.json`, so a real file can be three lines:

```json
{
  "harnessSkill": "tt3d-harness",
  "memory": { "areas": { "apps/web-astro/public/games/*": "games/{1}" } }
}
```

| Key | Default | Meaning |
|---|---|---|
| `tiers` | implement/debug opus, verify/review/gate sonnet, lookup/explore haiku | tier to model |
| `agentTypes` | `Explore: lookup`, `*-reviewer: review`, `kg-*: lookup`, … | subagent_type glob to tier |
| `keywords` | verify/review/lookup/debug/implement word lists | fallback tier by description or prompt |
| `defaultTier` | `implement` | an unclassified agent is never downgraded |
| `respectExplicitModel` | `true` | **the cost lever, since 0.1.2**: when an Agent call already carries an explicit `model`, keep it rather than rewriting it to the tier's model (no rewrite counted, `governor.log` gets one `explicit model kept` line). Set `false` to force the tier model even over an explicit one |
| `override` | `!model=` | prompt token that wins over the tier - the `!` is optional, see **Override tokens** below |
| `effort.default` | `medium` | what SessionStart reports against |
| `effort.raiseFor` | `["debug", "design"]` | prompt words that re-print the recommendation |
| `reads.wholeFileLimit` | `3` | whole reads of one path before the warning |
| `reads.largeFileLines` | `2000` | a shorter file is never denied |
| `reads.override` | `!reads=off` | disables read denial for the session - the `!` is optional |
| `session.maxTurns` | `2500` | cap on assistant turns |
| `session.maxCompactions` | `2` | cap on compactions |
| `session.handoffPath` | `docs/handoffs/` | where the handoff is written, and the cap allowlist - matched anywhere in a Write/Edit's path since 0.1.2, not only relative to `cwd` (see **Rollout** below) |
| `session.override` | `!cap=off` | lifts the cap gate for the session - the `!` is optional |
| `memory.areas` | three globs | path glob to area alias; `{1}` is the first `*` |
| `memory.rulesDir` | `.claude/rules` | area rule files, committed |
| `memory.tasksDir` | `.claude/memory/tasks` | per-branch notes, gitignored by the fold |
| `memory.archiveDir` | `.claude/memory/archive` | where the task fold retires notes |
| `memory.kgPath` | `.claude/knowledge_graph.json` | the graph governor appends to |
| `memory.indexBudgetBytes` | `8192` | MEMORY.md index budget |
| `profiles` | default + game-art, backend, content | plugin sets for `/governor profile` |
| `enforce.reads` | `false` | **still warn-only in 0.1.1**; true turns the fourth read into a denial |
| `enforce.cap` | `true` | **enforced by default since 0.1.1**; the cap gate denies non-allowlisted tools once reached. `!cap=off` for the session, or a project `.claude/governor.json` with `"enforce": {"cap": false}`, turns it back off |
| `harnessSkill` | `null` | skill named in place of a `<!-- harness-rules -->` block |

The Agent model rewrite is always on; it is not behind an `enforce` switch.

## The hooks

All nine registrations are in `hooks/hooks.json` and run as
`node "${CLAUDE_PLUGIN_ROOT}/scripts/<script>.mjs"`.

| Event | Matcher | Script | What it does |
|---|---|---|---|
| PreToolUse | `Agent` | `pre-tool-agent.mjs` | resolves the tier, returns `updatedInput` with the tier's model and a `governor: tier <t> -> <model>` line unless the call already carries an explicit model and `respectExplicitModel` is true; replaces a `<!-- harness-rules -->` block. Never denies. |
| PreToolUse | `Read` | `pre-tool-read.mjs` | third whole read warns with KG symbols and attached memories; fourth denies a large file when `enforce.reads` |
| PostToolUse | `Read` | `post-tool-read.mjs` | counts the read as whole or partial; records `lastRepoDir` from the file's git toplevel |
| UserPromptSubmit | — | `user-prompt.mjs` | counts turns and compactions, records override tokens, injects the status line, trips the cap (recording `capReachedAt`), also checks the filesystem for a handoff already on disk |
| PreToolUse | `*` | `pre-tool-cap.mjs` | after the cap, denies everything but Read/Glob/Grep, handoff writes and read-only git; also checks the filesystem for a handoff already on disk before denying |
| PostToolUse | `Write\|Edit` | `post-tool-write.mjs` | marks the handoff written; records `lastRepoDir`; indexes memory files into the graph |
| PostToolUse | `Bash` | `post-tool-bash.mjs` | rescans the handoff dir and marks the handoff written - a Bash heredoc never goes through the Write/Edit hook |
| SessionStart | — | `session-start.mjs` | branch, task memory pointer, touched areas and the rule files that exist, profile, effort |
| PreCompact | — | `pre-compact.mjs` | stores the status so the first post-compaction turn carries it |

### Override tokens

`!model=<name>`, `!reads=off` and `!cap=off` all work with or without the leading
`!`. Drop it - the recommended spelling is `governor cap=off`, a leading word so
there is nothing at position zero for Claude Code's run-a-shell-command shortcut to
catch. That shortcut fires whenever `!` is the very first character of the whole
prompt box, so `!cap=off` typed alone as the entire message never reaches the hook
at all; typed after other words (`noted, !cap=off`) it is fine, since the shortcut
only ever looks at position zero. Either spelling is matched word-bounded (start of
prompt or whitespace before, whitespace or end after), so `!cap=off`, `cap=off` and
`governor cap=off` all set the override, while `handicap=off` or `cap=offline` do
not. `model=` only accepts `haiku|sonnet|opus|fable|[a-z0-9.-]+` as the value, so a
stray `model=` in a pasted code block is never mistaken for the token.

When even that is inconvenient - or when driving the override from a command rather
than typing it - `/governor cap off|on` and `/governor reads off|on` write the
override directly into session state; see **Commands**.

### Harness contract this plugin relies on

Checked against https://code.claude.com/docs/en/hooks.md on 2026-09-22. If a harness
change breaks the plugin, these are the shapes to diff first.

Common stdin fields, every event:

```json
{
  "session_id": "abc123",
  "transcript_path": "/home/user/.claude/projects/.../transcript.jsonl",
  "cwd": "/home/user/my-project",
  "hook_event_name": "PreToolUse"
}
```

Per event, added to the above:

- PreToolUse: `tool_name`, `tool_input`, `tool_use_id`, `permission_mode`, `prompt_id`
- PostToolUse: `tool_name`, `tool_input`, `tool_use_id`, `tool_response`
- UserPromptSubmit: `prompt`, `prompt_id`, `permission_mode`
- SessionStart: `source` (`startup|resume|clear|compact|fork`)
- PreCompact: `trigger` (`manual|auto`), `custom_instructions`

Measured on CLI 2.1.280 by a throwaway probe plugin that dumped hook stdin (see
**End-to-end verification**), under `claude -p`. The keys actually delivered there
were, verbatim:

```
SessionStart      session_id,transcript_path,cwd,hook_event_name,source
UserPromptSubmit  session_id,transcript_path,cwd,prompt_id,permission_mode,hook_event_name,prompt
PreToolUse        session_id,transcript_path,cwd,prompt_id,permission_mode,hook_event_name,tool_name,tool_input,tool_use_id
```

So under `claude -p` the harness sends **no** `scratchpad_dir`. A live interactive
session on the same CLI version was measured separately (2026-09-22) and does send
it: hook stdin there carried `scratchpad_dir`, and the state file landed at
`<scratchpad_dir>/governor-<session_id>.json`, for example
`/private/tmp/claude-502/-Users-hsingh1/<session_id>/scratchpad/governor-<session_id>.json` -
that is, `<root>/<session_id>/scratchpad`, the layout `status.mjs` relies on to
derive the session id when it is not passed one (see **Commands**).

Neither delivery sends `effort`, `agent_id` or `agent_type`. The plugin treats
`scratchpad_dir` and these three as optional:

- state and the log fall back from `scratchpad_dir` to `os.tmpdir()` when it is
  absent (`claude -p`), keyed by `session_id`, so nothing collides and nothing
  is lost; when it is present (interactive), state lands under the scratchpad
  as measured above;
- effort reads as `unknown` and the status line prints
  `effort unknown (policy default medium)` rather than a false level;
- `PreCompact` reads `trigger` first and `reason` second, so either spelling works.

If a later version starts sending `effort.level`, the plugin picks it up with no
change.

**The version that actually runs is the plugin cache copy**,
`~/.claude/plugins/cache/hplugins/governor/<version>/`, not this repository. After
pushing a change here, pick it up with:

```
/plugin marketplace update hplugins
```

then reinstall the plugin or run `/reload-plugins` - the cache is not refreshed
otherwise, and a session started before that will keep running the old version's
hooks for its lifetime.

Stdout, exit 0, a single JSON object:

```json
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": "...",
    "updatedInput": { "model": "haiku", "prompt": "..." },
    "additionalContext": "...",
    "systemMessage": "..."
  }
}
```

- `permissionDecision` is `allow`, `deny` or `ask`. Only `pre-tool-read.mjs` and
  `pre-tool-cap.mjs` ever emit `deny`.
- `updatedInput` rewrites the tool call. `pre-tool-agent.mjs` is the only user of it.
- `additionalContext` is honoured on `UserPromptSubmit`, `SessionStart` and
  `PostToolUse`; the read hook also attaches it to a `PreToolUse` result as a warning
  that does not block.
- `systemMessage` is available but this plugin does not use it: everything it says is
  meant for the model, not only for the user's terminal.
- Exit 0 with empty stdout means no decision. Exit 2 would block regardless of JSON,
  so the governor never exits 2 — a bug must not become a block.

Transcript counting reads the JSONL at `transcript_path`: an assistant turn is
`{"type":"assistant"}` without `isSidechain`, and a compaction is
`{"type":"system","subtype":"compact_boundary"}` or a record with
`isCompactSummary: true`. Both shapes are counted and the larger taken, so a harness
that writes one, the other or both never double counts.

### Fail-open

Every hook body runs inside `safeMain()`. Any exception exits 0 with no decision and
appends one line to `<scratchpad_dir>/governor.log`, falling back to `os.tmpdir()`
when the harness sends no scratchpad. A missing or malformed `.claude/governor.json`
logs and uses the defaults. A missing knowledge graph is a skip, not an error. A graph
whose `meta.schemaVersion` is not one governor knows is left untouched and logged: the
graph stays owned by project-manager.

Session state is one file per session,
`<scratchpad_dir or os.tmpdir()>/governor-<session_id>.json`:
turns, compactions, per-file read counts, rewrites, denials, warnings, active
overrides, cap reached (and when, `capReachedAt`), handoff written, profile, branch,
areas, and `lastRepoDir` (the git toplevel of the last file read or written).

## Commands

`/governor status | cap off|on | reads off|on | profile <name|off> | memory fold | task fold [branch] | handoff`

`status` is self-locating: `status.mjs` takes `--cwd` and `--scratchpad`, not a
session id. When `--session` is not given it derives the session id from the
scratchpad path's parent directory name (`<root>/<session_id>/scratchpad`, the
interactive-session layout above); failing that, it uses the newest
`governor-*.json` in the scratchpad directory, then the newest one in
`os.tmpdir()`. If none of that finds a state file, it prints a plain
`governor: no session state file found ...` line instead of a JSON zero state,
so a missing file is never mistaken for a session that has genuinely done
nothing yet. (The self-locating logic is shared with `override.mjs` via
`scripts/lib/session.mjs`.)

`cap off|on` and `reads off|on` run `scripts/override.mjs --scratchpad <dir> --cap
off|on` and/or `--reads off|on`, writing the override into session state directly -
the reliable alternative to the `cap=off`/`reads=off` prompt tokens (see **Override
tokens**).

The folds are propose-then-apply. `fold.mjs` prints a JSON plan and moves nothing;
only `--apply --approved <plan.json>` acts, and `--apply` alone exits non-zero. The
fold never deletes an original memory file.

## Tests

```bash
cd governor && node --test tests/*.test.mjs
```

The hook tests spawn the real scripts and feed them hook-input JSON on stdin, so they
test the stdin/stdout contract above rather than internal functions.

## End-to-end verification

Run on 2026-09-22 against Claude Code CLI 2.1.280 (`/Users/hsingh1/.local/bin/claude`),
in a throwaway git repo outside any project, with the plugin loaded for the session only:

```bash
E2E=<scratchpad>/governor-e2e
mkdir -p "$E2E/.claude" && cd "$E2E" && git init -b main -q
printf '{\n  "enforce": { "reads": false, "cap": false }\n}\n' > .claude/governor.json
node -e 'const fs=require("fs");let s="";for(let i=1;i<=3000;i++)s+=`// line ${i}\n`;fs.writeFileSync("dummy.js",s)'

claude -p --plugin-dir <repo>/governor --permission-mode bypassPermissions --model haiku \
  'Use the Explore agent to list the files here, then read dummy.js in full four separate
   times with the Read tool (no offset, no limit). Do not summarise between reads.'
```

Transcripts are under
`~/.claude/projects/-private-tmp-claude-502--Users-hsingh1-a0d1f9a1-ebc0-4e00-8b12-aeb2197e921e-scratchpad-governor-e2e/`.

**1. The Agent call was rewritten to the tier's model.** PASS. Session
`a7f5dfe2-4346-4014-81a1-af3f7c0cffc3`. The assistant emitted `Agent` with
`subagent_type: "Explore"` and no `model`; the `PreToolUse:Agent` hook returned:

```json
{"hookSpecificOutput":{"hookEventName":"PreToolUse","updatedInput":{
  "description":"List files in current directory",
  "prompt":"List all files in the current working directory. ...\n\ngovernor: tier lookup -> haiku",
  "subagent_type":"Explore","model":"haiku"}}}
```

State for that session ends `"rewrites":1`.

**2. The fourth whole-file Read carried the warning, warn-only.** PASS. Same session,
`enforce.reads: false`. The third read's hook output was
`governor: dummy.js read 2x in full already. Prefer offset/limit.` and the fourth's was

```json
{"hookSpecificOutput":{"hookEventName":"PreToolUse",
  "additionalContext":"governor: dummy.js read 3x in full; use offset/limit, or the KG symbols: (none indexed)"}}
```

Every Read result came back `ok`; the session's state ends `"denials":0,"warnings":2`.

**3. With `enforce.reads: true` the fourth Read is denied.** PASS. Session
`b333d24e-3a7d-4b71-959d-8dbba45fb4d3`, same repo with
`{"enforce":{"reads":true,"cap":false}}` and a prompt asking for four reads one at a
time. Reads 1-3 returned `ok`, the third carrying the `read 2x` warning; the fourth came
back as an error tool result:

```
PreToolUse:Read hook error: governor: dummy.js read 3x in full; use offset/limit, or the KG symbols: (none indexed)
```

State ends `"reads":{".../dummy.js":{"full":3,"partial":0}},"denials":1,"warnings":1` -
the file was read three times, never a fourth.

### What the run also showed

- **Parallel reads under-counted before 0.1.1, fixed since.** In an earlier run of the
  same denial case the model issued three Reads in one assistant message. All three
  `PreToolUse` hooks ran before any `PostToolUse` had written the count, so they each
  saw zero and the denial landed on the fifth call rather than the fourth (session
  `baacbfef-418d-4fa3-93c1-dd24b354c2b9`, `"full":4,"denials":1`). The counter was a
  read-modify-write on one JSON file with no lock: a batch of N parallel reads of one
  path counted as one. It never over-counted, so it never denied a read it should have
  allowed, but it under-counted. Since 0.1.1, `pre-tool-read.mjs` claims each whole
  read's ordinal race-safely at `PreToolUse` time itself (see `scripts/lib/reads.mjs`
  and `tests/hook-read.test.mjs`'s concurrent-Reads test), so a batch of N parallel
  reads of one path counts as N, the same as N sequential reads.
- **A denial reaches the model as a tool error**, prefixed `PreToolUse:Read hook error:`,
  with the governor's reason intact. The model stopped re-reading and reported it.
- **`scratchpad_dir` and `effort` under `claude -p`**; see the harness contract
  above for the probe, what an interactive session sends instead, and the fallbacks.

## Rollout

- 0.1.0: the Agent rewrite, the budget and status, SessionStart and PreCompact, the
  read counter in warn-only mode, `status`, the harness skill marker, the fold engine
  and the memory indexer. `enforce.reads` and `enforce.cap` ship false.
- 0.1.1: `status` is self-locating from `--scratchpad` instead of
  needing `--session`; the whole-file read counter is race-safe against parallel
  Reads; the harness contract records that interactive sessions do send
  `scratchpad_dir` (only `claude -p` does not). `enforce.cap` turns on by default -
  the cap is now a real gate, not warn-only. `enforce.reads` still ships false.
- 0.1.2 (this version): five bugs found live in an interactive 0.1.1 session.
  (1) A handoff already on disk (a Bash heredoc, or a write from before the plugin
  loaded) was never credited - `pre-tool-cap.mjs` and `user-prompt.mjs` now also scan
  the filesystem (`lib/paths.mjs`'s `handoffOnDisk`, gated on `capReachedAt` so a
  stale file from an unrelated past session is never credited), and a new
  `PostToolUse:Bash` hook (`post-tool-bash.mjs`) rescans on every Bash call. (2) The
  handoff allowlist and suggested path/branch were resolved against the hook's stdin
  `cwd`, which drifts - `isUnderHandoff` now matches `handoffPath` anywhere in the
  file's path instead of a cwd-relative prefix, and a new `lastRepoDir` in state (set
  by `post-tool-read.mjs`/`post-tool-write.mjs` from the git toplevel of the last file
  touched) is preferred over `cwd` for the suggested handoff path and branch slug. (3)
  `!cap=off`/`!reads=off`/`!model=` typed alone never reached the hook - Claude Code's
  run-a-shell-command shortcut swallows a prompt that starts with `!`. All three
  tokens now match with or without the leading `!`, word-bounded (see **Override
  tokens**); `/governor cap off|on` and `/governor reads off|on`
  (`scripts/override.mjs`) write the override directly into state as a spelling-proof
  alternative. (4) A new `respectExplicitModel` policy key (default true) keeps an
  Agent call's explicit `model` instead of rewriting it to the tier's when the prompt
  happens to match a different tier's keywords. (5) `resolveTier` now ranks a
  multi-tier keyword match by `TIER_PRIORITY` (implement/debug > verify/review/gate >
  lookup/explore) instead of object-declaration order. `status` also now reports
  `capReachedAt`, a live `handoffOnDisk` filesystem check, and `lastRepoDir`.
- 0.2.0: turn on read denial by default too.
- 0.3.0: run the folds for real, once the alias table is approved.
- 0.4.0: profiles, once the runtime reload is proven.
