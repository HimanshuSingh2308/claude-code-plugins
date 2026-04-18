---
description: Fix a browser game bug using the structured reproduce-first workflow. Reproduces with Chrome DevTools, traces root cause through code, applies minimal fix, and verifies with before/after evidence. Never guesses.
argument-hint: <game-slug> <bug-description> [--reproduce-only | --trace-only]
---

# Fix Game Bug

Fix a bug in a browser game using the disciplined 5-phase workflow.

**Arguments**: $ARGUMENTS

## Parse Arguments

Extract from `$ARGUMENTS`:
- **game-slug**: The game to fix (e.g., `chess-3d`, `drift-legends`, `bir-glider`)
- **bug-description**: What's broken
- **Flags**:
  - `--reproduce-only` — Stop after Phase 2 (reproduce and report findings)
  - `--trace-only` — Stop after Phase 3 (reproduce + root cause, no fix)

## Workflow

Spawn the `game-bug-fixer` agent with the full context:

```yaml
agent: game-bug-fixer
prompt: |
  Fix a bug in the game "{game-slug}".

  Bug report: {bug-description}

  Game file: apps/web-astro/public/games/{game-slug}/game.js
  Game page: apps/web-astro/src/pages/games/{game-slug}.astro
  Game URL: http://localhost:4201/games/{game-slug}/

  Follow the 5-phase workflow strictly:
  1. Understand the report
  2. Reproduce using Chrome DevTools (navigate, screenshot, console check)
  3. Trace root cause through code
  4. Apply minimal fix
  5. Verify with Chrome DevTools (reload, screenshot, console check)

  {if --reproduce-only: "Stop after Phase 2. Report what you found."}
  {if --trace-only: "Stop after Phase 3. Report root cause but do not fix."}
```

## After the Agent Completes

1. Review the agent's fix report
2. If CACHE_VERSION bump is needed (any change to `apps/web-astro/`), bump it in `sw.js`
3. Present the before/after evidence to the user
4. Ask if the user wants to commit
