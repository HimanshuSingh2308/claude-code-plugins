---
name: governor-rules
description: >
  The cost rules the governor plugin enforces in hooks, in human-readable form.
  Applied when a subagent model, a repeated whole-file read, session length,
  compaction, handoff timing or memory scope is in question, and when a governor
  hook has rewritten or denied a call and the reason needs explaining.
---

# Governor rules

The governor turns cost rules into hooks so they hold under load. Everything here is
enforced by `governor/scripts/*.mjs`; this file is the explanation, not the mechanism.

## Model tiers

An Agent call's model is chosen by tier, not by habit.

| Tier | Model | For |
|---|---|---|
| implement, debug | opus | writing code, root-causing |
| verify, review, gate | sonnet | checking, reviewing, gate runs |
| lookup, explore | haiku | finding, listing, inventory |

The tier is resolved in this order:

1. `subagent_type` against `agentTypes` in the policy: exact key, then glob
   (`*-reviewer`, `kg-*`). This always beats a keyword match.
2. `keywords`: when several groups match the description or the first 400
   characters of the prompt, the highest tier wins, not the first one found - a
   description matching both "verify" and "fix" resolves to `implement`, not
   `verify`. The priority order is implement/debug, then verify/review/gate, then
   lookup/explore.
3. `defaultTier`, which is `implement`. An unclassified agent is never silently
   downgraded.

The hook rewrites the call with `updatedInput` and appends one line to the prompt:
`governor: tier <t> -> <model>`. It never denies an Agent call.

**The cost lever**: when the call already carries an explicit `model` and
`respectExplicitModel` (default `true`) is on, the tier is resolved for reporting but
the call's own model is kept - nothing is rewritten and it is not counted as a
rewrite. A dispatcher that picked "opus" on purpose keeps opus even if the prompt
happens to match a lower tier's keywords. Set `respectExplicitModel: false` in a
project's `.claude/governor.json` to force the tier model even over an explicit one.

## The harness block

A prompt may carry a block between `<!-- harness-rules -->` and
`<!-- /harness-rules -->`. The hook replaces the whole block with one line pointing at
the project's `harnessSkill`. Put the boilerplate in that skill once instead of in
every prompt.

## Reads

- A read with `offset` or `limit` always passes and is never counted.
- The third whole-file read of one path is allowed with a warning that names the
  file's symbols from `knowledge_graph.json` and any memories attached to it.
- The fourth whole-file read of a file longer than `reads.largeFileLines` is denied
  with the symbols in the reason — but only when `enforce.reads` is true. It ships
  false, so the fourth read warns instead unless a project turns it on.
- A file under `largeFileLines` is never denied, however often it is read.

When you get the warning, the answer is a targeted read: `offset`/`limit` around the
symbol you need, or Grep. Re-reading a 3,000 line file to find one function is the
single most expensive habit the measurements found.

## Budget, cap and handoff

Every prompt gets one status line: turns, compactions, profile, effort, rewrites,
denials. When turns reach `session.maxTurns` or compactions reach
`session.maxCompactions`, the cap trips: the session must write a handoff to
`<handoffPath><yyyy-mm-dd>-<branch-slug>.md` and continue in a fresh session.

`enforce.cap` is true by default since 0.1.1. While the cap holds and `enforce.cap`
is true, only these pass: Read, Glob, Grep; Write or Edit whose path contains
`handoffPath` anywhere, not only relative to the hook's `cwd`; Bash starting with
`git status`, `git diff`, `git log`, `git add`, `git commit`. Everything else is
denied with the reason - the gate only starts denying once the cap-reached status
line has been shown once, on the prompt where turns or compactions first cross their
limit, so it is never a surprise on the very first tool call after upgrading into a
session that was already over the cap. `cap=off` for the session (see **Overrides**),
or `"enforce": {"cap": false}` in a project's `.claude/governor.json`, turns it back
off.

Since 0.1.2, the gate and the status line also check the filesystem itself for a
handoff that already exists - written by a Bash heredoc, or from before the plugin
loaded this session - so state never having seen a Write/Edit for it does not keep
denying everything forever. A file counts once its mtime is at or after the session's
recorded `capReachedAt`, so a stale handoff left over from an unrelated past session
is never credited. `lastRepoDir` (the git toplevel of the last file read or written)
is preferred over `cwd` when locating the handoff dir and when suggesting the handoff
path and branch slug, since `cwd` can drift.

A handoff says what is done, what is not, which files matter and why, the next
concrete step, and the traps found. It is not a summary of the conversation.

## Overrides

Overrides are prompt tokens, never settings edits, and they last the session. The
recommended spelling drops the leading `!` and puts a word in front - `governor
cap=off` - because Claude Code treats a bare `!` as the very first character of the
whole prompt box as its run-a-shell-command shortcut, so `!cap=off` typed alone as
the entire message never reaches the hook at all. Both spellings work, matched
word-bounded anywhere in the prompt:

- `model=<name>` (or `!model=<name>`) - this Agent call keeps the model you asked
  for. Only `haiku`, `sonnet`, `opus`, `fable` or an arbitrary lowercase
  `[a-z0-9.-]+` id is accepted as the value.
- `reads=off` (or `!reads=off`) - no read denials.
- `cap=off` (or `!cap=off`) - no cap gate.

When typing the token is inconvenient, `/governor cap off|on` and `/governor reads
off|on` write the override directly into session state via `scripts/override.mjs`.

## Effort

Effort is per session, not per agent: the plugin cannot raise it for one subagent.
The SessionStart hook prints the current level and the policy default; a `raiseFor`
keyword in a prompt prints the recommendation again. Changing it is `/effort`.

## Memory scopes

- **Project memory** lives in the auto-memory directory. `MEMORY.md` is an index of
  rollups within `indexBudgetBytes`; the rollups list their members so every
  `[[name]]` still resolves.
- **Area memory** is `.claude/rules/<area>.md` with a `paths:` frontmatter, committed
  to the repo. Claude Code loads it only when a matching file is read.
- **Task memory** is `<tasksDir>/<branch-slug>/`, gitignored. New memories written
  during a task default here.

A new memory belongs to the area whose files and symbols its body names; failing that,
an area the branch touched; failing that, task scope.

## What the governor never does

- Deny an Agent call.
- Delete or move a memory file without `--apply` and an approved plan.
- Edit `settings.json`.
- Block anything when it hits an error: every hook fails open, exits 0 and writes one
  line to `<scratchpad>/governor.log`.
