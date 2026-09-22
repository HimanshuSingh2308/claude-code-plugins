# governor plugin design

Date: 2026-09-22. Marketplace: hplugins. Status: approved in review, awaiting implementation plan.

## Why

A measurement of 1,366 Claude Code transcripts (209 sessions, 6.5 GB) put the last
fortnight's spend at about $39.6k. Five drivers accounted for most of it:

| Driver | Measured | Share |
|---|---|---|
| Context re-read per turn (avg 144k cached tokens, sessions up to 26,258 turns, 79 compactions) | $40.2k all time | 59% |
| Opus subagents ($0.34/turn against $0.06 on Sonnet) | $18.3k / 14 days | 46% of the fortnight |
| Bash output inline (42M tokens) plus 123 MB spilled | 93,604 calls | |
| Whole-file re-reads (game.js 302x in one session, a subagent report 304x) | 770 reads over 20k chars | |
| Thinking at effort high on every turn | 41% of output tokens | |

The rules that should have prevented this existed as prose in CLAUDE.md and memory. Prose
was not followed under load. The governor turns the rules into hooks that rewrite, count and
deny, with a one-token override, and gives memory a shape that loads only what the current
work needs.

The plugin is generic. Nothing in it names a project, a game or a user. Projects opt in with
a small policy file; a project with no file gets the plugin defaults.

## Decisions taken in review

- Standalone plugin `governor` in hplugins, not part of project-manager. Either can be
  enabled alone. project-manager keeps load-project and owns the knowledge graph.
- Handoff trigger: phase boundary plus a hard cap (default second compaction or 2,500 turns).
- Task scope for memory is the git branch or worktree.
- Enforcement with override: hooks rewrite or deny; one token in the prompt overrides for the
  session; overrides are never a settings edit.
- fast-jev-compaction and any third-party compaction service are out of scope.

## Facts the design rests on (Claude Code 2.1.278, from the docs)

- PreToolUse hooks can return `updatedInput` to rewrite a tool call, or deny with a reason.
  Hook input carries `session_id`, `transcript_path`, `cwd`, `effort.level`, `agent_type`.
- Effort is per session (`effortLevel`, `maxEffortLevel` settings; `/effort`), not per agent.
- Agent model precedence: per-call `model` parameter beats agent frontmatter, which beats
  `CLAUDE_CODE_SUBAGENT_MODEL`, which beats the main model.
- Plugins switch at runtime with `/plugin enable|disable` followed by `/reload-plugins`;
  `enabledPlugins` in a project's `.claude/settings.json` overrides the user's set.
- Only MEMORY.md loads at start, capped at 25 KB or 200 lines. `autoMemoryDirectory` is
  configurable. Worktrees share the project's memory directory.
- `.claude/rules/*.md` with a `paths:` frontmatter loads only when a matching file is read.
  Nested CLAUDE.md loads lazily in the same way.
- No hook receives context size or cost. Compactions and turns are countable from the
  transcript JSONL a hook is given.
- Nothing reads `knowledge_graph.json` today; its use is instructed, not enforced.

## Section 1: shape and policy

Layout:

```
governor/
  .claude-plugin/plugin.json          name governor, version 0.1.0
  hooks/hooks.json                    the five hooks below
  scripts/                            node, no dependencies, one file per hook + lib/
  commands/governor.md                /governor <status|profile|memory|task|handoff>
  skills/governor-rules/SKILL.md      the human-readable rules the hooks enforce
  policy/default.json                 defaults every key falls back to
  templates/handoff.md                the handoff file template
  tests/                              node --test with recorded hook-input fixtures
```

A project opts in by having `.claude/governor.json`. Missing keys fall back to
`policy/default.json`, so a project file can be three lines. Schema (defaults shown):

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
    "areas": { "apps/web-astro/public/games/*": "games/{1}", "apps/api/**": "api", "apps/web-astro/src/**": "web" },
    "rulesDir": ".claude/rules", "tasksDir": ".claude/memory/tasks", "archiveDir": ".claude/memory/archive",
    "indexBudgetBytes": 8192
  },
  "profiles": {
    "default": ["project-manager", "superpowers", "remember", "governor"],
    "game-art": ["+game-design", "+chrome-devtools-mcp", "+blender-local"],
    "backend": ["+backend-dev", "+playwright"],
    "content": ["+content-studio", "+chrome-devtools-mcp"]
  }
}
```

Tier resolution for an Agent call: `subagent_type` matched against `agentTypes` (glob),
then the first keyword group that matches the description or the first 400 characters of
the prompt, then `defaultTier`. The default is `implement`, so an unclassified agent is
never silently downgraded. A prompt containing `!model=<name>` wins over everything.

Effort is per session. The policy's `effort.default` is what `/governor status` reports
against and what the SessionStart hook recommends; the plugin cannot set it per agent. The
hook prints the current level and the recommendation once, at session start, and again if
a `raiseFor` keyword appears in a prompt.

## Section 2: hooks

All hooks are Node scripts under the plugin root, invoked from `hooks/hooks.json` with
`${CLAUDE_PLUGIN_ROOT}`. Each reads the policy once per call and fails open: a missing or
malformed policy logs one line to `<scratchpad>/governor.log` and allows the call. State for
the session is one JSON file, `<scratchpad>/governor-<session_id>.json`: turn count,
compactions seen, per-file read counts, tier rewrites, denials, overrides active, handoff
written, profile.

1. **PreToolUse on Agent, model tier.** Resolves the tier. If the call's `model` differs
   from the tier's model and the prompt carries no `!model=` token, returns `updatedInput`
   with the model replaced and one line appended to the prompt: `governor: tier <t> ->
   <model>`. Never denies. If the prompt contains the marker `<!-- harness-rules -->` up to
   `<!-- /harness-rules -->`, the block is replaced by `Load the skill named in
   governor.json harnessSkill before any browser or gate work.` so a project's harness rules
   live in one skill instead of every prompt (weekly-arcade will set `harnessSkill` to a
   `tt3d-harness` skill created from the current boilerplate).

2. **Read counter.** PostToolUse on Read records path and whether `offset` or `limit` was
   passed. PreToolUse on Read consults the count: on the third whole-file read of one path it
   allows and adds `additionalContext` naming the file's symbols from `knowledge_graph.json`
   (if present) and any memories attached to it; on the fourth whole-file read of a file
   longer than `largeFileLines` it denies with reason `governor: <path> read 3x in full; use
   offset/limit, or the KG symbols: <top 10>`. Reads with offset or limit always pass. A file
   under `largeFileLines` is never denied. `!reads=off` in any prompt disables denial for the
   session.

3. **UserPromptSubmit, budget and status.** Counts assistant turns and compaction records in
   the transcript file, records override tokens, and injects one status line:
   `governor: turns 812 | compactions 1 | profile game-art | effort medium | rewrites 4 |
   denials 0`. When `turns >= maxTurns` or `compactions >= maxCompactions` and no handoff has
   been written, it injects the handoff instruction with the template path and the file name
   `docs/handoffs/<yyyy-mm-dd>-<branch-slug>.md`, and sets `capReached` in the state file.

4. **PreToolUse on every tool, after the cap.** While `capReached` and not `handoffWritten`,
   denies every call except: Write or Edit whose path is under `handoffPath`; Bash whose
   command starts with `git status`, `git diff`, `git log`, `git add`, `git commit`; Read of
   any file (reading is needed to write the handoff). PostToolUse on Write to `handoffPath`
   sets `handoffWritten`. `!cap=off` lifts it for the session.

5. **SessionStart and PreCompact, scopes and profile.** SessionStart resolves branch and
   worktree, computes the areas touched by the branch's diff against its base, and injects:
   the task memory pointer for this branch, the list of area rule files that exist for the
   touched areas (they load lazily on their own; the line just says they exist), the active
   profile, effort level and recommendation. PreCompact writes the same status into the state
   file so the post-compaction turn starts with it.

The PostToolUse on Write hook (section 3) is the sixth registration but belongs to memory.

## Section 3: memory scopes and the knowledge graph

Three scopes, each on a native loading mechanism, so no scope logic sits in the prompt.

**Project memory** stays in the auto-memory directory. MEMORY.md becomes an index of
rollups: one line per rollup file, budget `indexBudgetBytes` (8 KB), which keeps it far
under the 25 KB and 200-line cap. Existing memory files are never deleted. The one-time
`/governor memory fold` groups them into rollups by area alias and by prefix
(`rollup_<area>.md`, `rollup_reference.md`, `rollup_feedback.md`); each rollup lists its
member files with their one-line hooks and links, so every existing `[[name]]` still
resolves. Feedback and reference memories that apply everywhere keep a top-level line.

**Area memory** is committed to the repo as `.claude/rules/<area>.md` with a `paths:`
frontmatter derived from the `memory.areas` glob. Claude Code loads a rule only when a file
matching its paths is read. Areas are discovered from the glob, never listed by name: every
directory matching `apps/web-astro/public/games/*` is an area, so a game added later gets
its area the first time a memory is written about it, and the fold creates a rule file for
each existing game directory. Committed rules travel with the repo to any machine and user.

**Task memory** is `<tasksDir>/<branch-slug>/` in the repo, gitignored by the fold (it adds
the line if missing). Memories written during a task default to this scope. SessionStart
injects the pointer for the current branch only. `/governor task fold [branch]` runs when a
branch is merged or deleted: it lists the task's notes, asks which to keep, moves keepers to
the area rule or project rollup, and the rest to `archiveDir`.

**Assignment.** The fold matches a memory to an area by its slug against directory names,
with an alias table it proposes (boatjam to boat-jam, tt3d to tiny-tycoon-3d, vb2 to
voidbreak-2, and so on). The assignment is shown and approved before any file moves.
Unmatched memories stay in project rollups. New memories are assigned by the file paths and
symbols in their body, then by the branch's touched areas, then task scope.

**Knowledge graph.** `knowledge_graph.json` gains one additive key, `memories`: an array of
`{ id, scope, path, title, files, symbols, updatedAt }`. The fold commands and a
PostToolUse hook on Write into any memory or rules directory append to it, extracting
backticked paths and `CamelCase`/`snake_case` symbol tokens from the body and checking them
against `symbols` and `files`. Consumers: hook 2 names attached memories when it warns or
denies; `/governor status` reports orphan memories whose files no longer exist. The graph
stays owned by project-manager: governor appends only, and if `meta.schemaVersion` is
unknown it writes nothing and logs.

## Section 4: profiles, commands, testing, rollout

**Profiles.** `/governor profile <name>` computes the plugin set (`default` plus `+`
additions), runs `claude plugin enable|disable` for the difference against the enabled set,
then `/reload-plugins`, and records the profile in the state file. `/governor profile off`
restores the set recorded at session start. A project may pin its baseline in
`.claude/settings.json` `enabledPlugins`; the fold offers to write it. There is no
load-then-unload primitive in Claude Code, so unloading is the profile switch that the
handoff or task fold performs.

**Commands** (one file, subcommands):
- `status`: turns, compactions, profile, effort, rewrites, denials, active overrides,
  orphan memories.
- `profile <name|off>`.
- `memory fold`: the one-time project fold with alias approval.
- `task fold [branch]`.
- `handoff`: writes the handoff file from the template now and marks the session done.

**Marketplace registration.** Add `governor` to `.claude-plugin/marketplace.json` with
source, description, version 0.1.0, category and tags, and bump the marketplace
`metadata.version`. Without this the plugin cannot be installed or synced by
hplugins-tools.

**Testing.** Every hook script has `node --test` cases driven by recorded hook-input
fixtures: tier rewrite by type, by keyword, by default; override honoured; harness block
replaced; third read warns and fourth denies only above the line threshold; offset reads
pass; cap reached denies and the handoff Write passes; malformed policy fails open;
transcript counting on a fixture with two compactions; memory assignment by alias, by path,
by branch. One end-to-end check runs `claude -p` in a temp repo with the plugin enabled and
asserts from the transcript that a rewrite and a denial occurred.

**Rollout.**
- 0.1.0: hooks 1, 3, 5, the read counter in warn-only mode, `status`, the harness skill
  marker. One week in weekly-arcade; compare the aggregator's numbers before and after.
- 0.2.0: read denial and the cap (hook 4), `handoff`.
- 0.3.0: `memory fold` and `task fold` after the alias table is approved; the KG `memories`
  key.
- 0.4.0: profiles, once the runtime reload is proven on this version.

**Success measures** (from the aggregator, weekly): dollars per day; average cache-read per
turn under 100k (now 144k); Opus share of sidechain cost under 20% (now 46%); compactions per
session under 10; Reads over 20k characters at zero.

## Out of scope

- Per-agent effort (not supported by the harness).
- Splitting large game files into modules: weekly-arcade's games are classic scripts in an
  IIFE because `scripts/minify-dist.js` cannot rename top-level module declarations; a
  bundling step is a separate design.
- Third-party compaction services.
