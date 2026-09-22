---
description: Inspect and drive the governor - session status, plugin profiles, the memory and task folds, and the handoff
argument-hint: status | cap off|on | reads off|on | profile <name|off> | memory fold | task fold [branch] | handoff
---

# Governor

**Arguments**: $ARGUMENTS

The governor's hooks run on their own. This command is for the parts that need a
decision: reading the session's numbers, switching the plugin profile, folding
memory, and writing the handoff.

Policy comes from `.claude/governor.json` in the project, merged over
`${CLAUDE_PLUGIN_ROOT}/policy/default.json`. A project with no file gets the defaults.

## status

Run, passing the scratchpad directory named in your own system prompt
(`Scratchpad directory: ...`) - status.mjs is self-locating from it and does
not need you to know the session id:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/status.mjs" --cwd "$(pwd)" --scratchpad "<scratchpad directory>"
```

If your system prompt has no scratchpad directory (for example under `claude -p`),
omit `--scratchpad`; status.mjs then falls back to the newest state file in
`os.tmpdir()`. If you already know the session id, pass `--session <id>` instead
and it is used as-is.

If the output is a JSON object, report, in one short block: turns and compactions
against their caps, profile, effort against the policy default, rewrites, denials,
warnings, which overrides are active (`model=`, `reads=off`, `cap=off`), whether the
cap is reached (and, if so, `capReachedAt`) and the handoff written, `handoffOnDisk`
(a live filesystem check - a path if a handoff exists there whether or not state
knows about it yet, otherwise null), `lastRepoDir` (the git toplevel of the last file
read or written this session, used to resolve the handoff path and branch slug when
`cwd` has drifted), which enforcement switches are on, and any orphan memories
(memories in the knowledge graph whose file or referenced files no longer exist).

If the output is instead a single `governor: no session state file found ...` line,
say so plainly - do not report it as a zero state, that line means status.mjs could
not locate a state file at all, not that the session has done nothing.

`enforce.cap` is true by default since 0.1.1 (`enforce.reads` still ships false,
warn-only). If either is false, say so and name the reason if one is evident (a
project's `.claude/governor.json`, or the `cap=off` / `reads=off` override).

## cap off|on, reads off|on

The reliable way to set a session override - use this instead of the prompt tokens
when a bare `!cap=off` might not reach the hook at all: Claude Code treats a leading
`!` as its run-a-shell-command shortcut only when it is the very first character of
the whole prompt box, so typing the token alone as the entire message never gets to
the hook. The recommended prompt spelling sidesteps this too - `governor cap=off`,
bang-free, with a leading word so there is nothing at position zero for the shortcut
to catch - but this command always works regardless of spelling:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/override.mjs" --scratchpad "<scratchpad directory>" --cap off
node "${CLAUDE_PLUGIN_ROOT}/scripts/override.mjs" --scratchpad "<scratchpad directory>" --reads off
node "${CLAUDE_PLUGIN_ROOT}/scripts/override.mjs" --scratchpad "<scratchpad directory>" --cap on --reads on
```

Self-locating the same way `status` is: pass `--cwd` and `--scratchpad` from your own
system prompt, no session id needed (`--session <id>` also works if you know it). It
writes straight into session state and prints which overrides were set; run `status`
afterward to confirm.

## profile <name|off>

1. Read `profiles` from the merged policy. The set is `profiles.default` plus every
   `+plugin` entry of the named profile.
2. Run `claude plugin list` and compute the difference against that set.
3. Show the user the plugins that would be enabled and disabled, and ask before
   changing anything.
4. On approval, run `claude plugin enable <name>` / `claude plugin disable <name>`
   for each difference, then tell the user to run `/reload-plugins` — the plugin
   set only changes after that.
5. `off` restores the set recorded at session start.

Never edit `settings.json` to switch a profile. A project that wants a pinned
baseline sets `enabledPlugins` in its own `.claude/settings.json`, which the user
does, not this command.

## memory fold

The one-time project fold. It is propose, approve, then apply — never apply first.

1. Ask for or confirm the memory directory (the auto-memory directory; the user's
   real memory is never folded without them naming it).
2. Propose:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/fold.mjs" memory --cwd "$(pwd)" --memory-dir <dir>
```

3. Show the alias table and the assignments as a table: file, proposed area, rollup,
   and the reason (`alias`, `slug`, `path`, `feedback`, `unmatched`). Ask the user to
   approve or to correct individual rows.
4. Write the approved plan JSON to the scratchpad, then apply it:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/fold.mjs" memory --cwd "$(pwd)" --memory-dir <dir> \
  --apply --approved <scratchpad>/governor-fold-plan.json
```

The apply step writes rollup files, area rule files under `memory.rulesDir` with a
`paths:` frontmatter, a rebuilt `MEMORY.md` index within `indexBudgetBytes`, and adds
the tasks directory to `.gitignore`. It never deletes or moves an original memory
file. `--apply` without `--approved` exits non-zero and does nothing.

## task fold [branch]

Run when a branch is merged or deleted. Same propose, approve, apply cycle:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/fold.mjs" task --cwd "$(pwd)" --branch <branch>
```

Show each note with its proposed destination and ask which to keep. Set `keep: false`
on the rest, write the approved plan, then re-run with `--apply --approved <plan>`.
Keepers are folded into their area rule; everything is then archived under
`memory.archiveDir` and removed from the tasks directory.

## handoff

1. Read `${CLAUDE_PLUGIN_ROOT}/templates/handoff.md`.
2. Fill it from this session: the goal, what is done, what is not, the files that
   matter and why, the next concrete step, and any traps found.
3. Write it to `<session.handoffPath><yyyy-mm-dd>-<branch-slug>.md`.
4. Say the session is done and that the work continues in a fresh session. The
   PostToolUse hook sees the write and lifts the cap gate for any cleanup.
