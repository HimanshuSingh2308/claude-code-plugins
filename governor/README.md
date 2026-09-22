# governor

Cost governance for Claude Code, as hooks rather than prose. The governor rewrites
subagent models to a tier, counts whole-file re-reads, reports a turn and compaction
budget, gates a session once it passes its cap, and indexes memory into the project's
knowledge graph.

Nothing in the plugin names a project, a game or a user. A project opts in by having
`.claude/governor.json`; a project without one gets `policy/default.json`.

Version 0.1.0. Node 24, no npm dependencies.

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
| `override` | `!model=` | prompt token that wins over the tier |
| `effort.default` | `medium` | what SessionStart reports against |
| `effort.raiseFor` | `["debug", "design"]` | prompt words that re-print the recommendation |
| `reads.wholeFileLimit` | `3` | whole reads of one path before the warning |
| `reads.largeFileLines` | `2000` | a shorter file is never denied |
| `reads.override` | `!reads=off` | disables read denial for the session |
| `session.maxTurns` | `2500` | cap on assistant turns |
| `session.maxCompactions` | `2` | cap on compactions |
| `session.handoffPath` | `docs/handoffs/` | where the handoff is written, and the cap allowlist |
| `session.override` | `!cap=off` | lifts the cap gate for the session |
| `memory.areas` | three globs | path glob to area alias; `{1}` is the first `*` |
| `memory.rulesDir` | `.claude/rules` | area rule files, committed |
| `memory.tasksDir` | `.claude/memory/tasks` | per-branch notes, gitignored by the fold |
| `memory.archiveDir` | `.claude/memory/archive` | where the task fold retires notes |
| `memory.kgPath` | `.claude/knowledge_graph.json` | the graph governor appends to |
| `memory.indexBudgetBytes` | `8192` | MEMORY.md index budget |
| `profiles` | default + game-art, backend, content | plugin sets for `/governor profile` |
| `enforce.reads` | `false` | **0.1.0 ships warn-only**; true turns the fourth read into a denial |
| `enforce.cap` | `false` | **0.1.0 ships warn-only**; true turns the cap into a gate |
| `harnessSkill` | `null` | skill named in place of a `<!-- harness-rules -->` block |

The Agent model rewrite is always on; it is not behind an `enforce` switch.

## The hooks

All eight registrations are in `hooks/hooks.json` and run as
`node "${CLAUDE_PLUGIN_ROOT}/scripts/<script>.mjs"`.

| Event | Matcher | Script | What it does |
|---|---|---|---|
| PreToolUse | `Agent` | `pre-tool-agent.mjs` | resolves the tier, returns `updatedInput` with the tier's model and a `governor: tier <t> -> <model>` line; replaces a `<!-- harness-rules -->` block. Never denies. |
| PreToolUse | `Read` | `pre-tool-read.mjs` | third whole read warns with KG symbols and attached memories; fourth denies a large file when `enforce.reads` |
| PostToolUse | `Read` | `post-tool-read.mjs` | counts the read as whole or partial |
| UserPromptSubmit | — | `user-prompt.mjs` | counts turns and compactions, records override tokens, injects the status line, trips the cap |
| PreToolUse | `*` | `pre-tool-cap.mjs` | after the cap, denies everything but Read/Glob/Grep, handoff writes and read-only git |
| PostToolUse | `Write\|Edit` | `post-tool-write.mjs` | marks the handoff written; indexes memory files into the graph |
| SessionStart | — | `session-start.mjs` | branch, task memory pointer, touched areas and the rule files that exist, profile, effort |
| PreCompact | — | `pre-compact.mjs` | stores the status so the first post-compaction turn carries it |

### Harness contract this plugin relies on

Checked against https://code.claude.com/docs/en/hooks.md on 2026-09-22. If a harness
change breaks the plugin, these are the shapes to diff first.

Common stdin fields, every event:

```json
{
  "session_id": "abc123",
  "transcript_path": "/home/user/.claude/projects/.../transcript.jsonl",
  "cwd": "/home/user/my-project",
  "scratchpad_dir": "/tmp/claude-1000/-home-user-my-project/abc123/scratchpad",
  "permission_mode": "default",
  "effort": { "level": "medium" },
  "hook_event_name": "PreToolUse",
  "agent_id": "agent-123",
  "agent_type": "Explore"
}
```

Per event, added to the above:

- PreToolUse: `tool_name`, `tool_input`, `tool_use_id`
- PostToolUse: `tool_name`, `tool_input`, `tool_use_id`, `tool_result`
- UserPromptSubmit: `prompt`, `permission_mode`
- SessionStart: `reason` (`startup|resume|clear|compact|fork`), `model`
- PreCompact: `reason` (`manual|auto`)

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

Session state is one file per session, `<scratchpad_dir>/governor-<session_id>.json`:
turns, compactions, per-file read counts, rewrites, denials, warnings, active
overrides, cap reached, handoff written, profile, branch and areas.

## Commands

`/governor status | profile <name|off> | memory fold | task fold [branch] | handoff`

The folds are propose-then-apply. `fold.mjs` prints a JSON plan and moves nothing;
only `--apply --approved <plan.json>` acts, and `--apply` alone exits non-zero. The
fold never deletes an original memory file.

## Tests

```bash
cd governor && node --test tests/*.test.mjs
```

The hook tests spawn the real scripts and feed them hook-input JSON on stdin, so they
test the stdin/stdout contract above rather than internal functions.

## Rollout

- 0.1.0 (this version): the Agent rewrite, the budget and status, SessionStart and
  PreCompact, the read counter in warn-only mode, `status`, the harness skill marker,
  the fold engine and the memory indexer. `enforce.reads` and `enforce.cap` ship false.
- 0.2.0: turn on read denial and the cap.
- 0.3.0: run the folds for real, once the alias table is approved.
- 0.4.0: profiles, once the runtime reload is proven.
