---
description: Inspect and drive the governor - session status, plugin profiles, the memory and task folds, and the handoff
argument-hint: status | profile <name|off> | memory fold | task fold [branch] | handoff
---

# Governor

**Arguments**: $ARGUMENTS

The governor's hooks run on their own. This command is for the parts that need a
decision: reading the session's numbers, switching the plugin profile, folding
memory, and writing the handoff.

Policy comes from `.claude/governor.json` in the project, merged over
`${CLAUDE_PLUGIN_ROOT}/policy/default.json`. A project with no file gets the defaults.

## status

Run:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/status.mjs" --cwd "$(pwd)"
```

Report, in one short block: turns and compactions against their caps, profile,
effort against the policy default, rewrites, denials, warnings, which overrides
are active (`!model=`, `!reads=off`, `!cap=off`), whether the cap is reached and
the handoff written, which enforcement switches are on, and any orphan memories
(memories in the knowledge graph whose file or referenced files no longer exist).

If `enforce.reads` or `enforce.cap` is false, say so: those are warn-only in 0.1.0.

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
