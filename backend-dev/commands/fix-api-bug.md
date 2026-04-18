---
description: Fix a NestJS backend bug using the structured reproduce-first workflow. Reproduces with a failing test, traces root cause through the NestJS call chain, applies minimal fix, and verifies with passing tests. Never guesses.
argument-hint: <module-or-file> <bug-description> [--reproduce-only | --trace-only]
---

# Fix API Bug

Fix a bug in the NestJS backend API using the disciplined 5-phase workflow.

**Arguments**: $ARGUMENTS

## Parse Arguments

Extract from `$ARGUMENTS`:
- **module-or-file**: The module or file path affected (e.g., `leaderboard`, `auth`, `multiplayer`, or a full path)
- **bug-description**: What's broken
- **Flags**:
  - `--reproduce-only` — Stop after Phase 2 (write failing test and report)
  - `--trace-only` — Stop after Phase 3 (reproduce + root cause, no fix)

## Resolve Module Path

If a module name is given (not a full path), resolve to:
- Service: `apps/api/src/{module}/{module}.service.ts`
- Controller: `apps/api/src/{module}/{module}.controller.ts`
- Module: `apps/api/src/{module}/{module}.module.ts`

For realtime server bugs, look in `apps/realtime/src/` instead.

## Workflow

Spawn the `api-bug-fixer` agent with the full context:

```yaml
agent: api-bug-fixer
prompt: |
  Fix a bug in the NestJS backend.

  Module/File: {module-or-file}
  Bug report: {bug-description}

  Project structure:
  - API source: apps/api/src/
  - Realtime source: apps/realtime/src/
  - Shared types: packages/shared/src/lib/
  - Tests: alongside source files (*.spec.ts)

  Follow the 5-phase workflow strictly:
  1. Understand the report
  2. Reproduce — write a failing test (preferred) or use API call
  3. Trace root cause through the NestJS call chain
  4. Apply minimal fix
  5. Verify — failing test passes, full suite passes, build succeeds

  {if --reproduce-only: "Stop after Phase 2. Report the failing test."}
  {if --trace-only: "Stop after Phase 3. Report root cause but do not fix."}
```

## After the Agent Completes

1. Review the agent's fix report
2. If a migration was created, verify the SQL
3. Present the test results to the user
4. Ask if the user wants to commit
