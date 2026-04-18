---
name: bug-fixing
description: >
  Structured bug-fixing methodology for NestJS backend applications. Enforces a strict
  reproduce-first workflow: reproduce the bug with a failing test or API call, identify the
  root cause through code and log tracing, then apply a minimal targeted fix verified by
  passing tests. Prevents guessing, scope creep, and speculative refactors during bug fixes.
  Applied when fixing bugs, debugging API issues, or investigating backend failures.
---

# Backend Bug-Fixing Methodology

This skill enforces a disciplined bug-fixing workflow for NestJS backends. The cardinal rule:
**never guess — always prove.**

## The 5-Phase Workflow

Every bug fix MUST follow these phases in order. Skipping a phase is not allowed.

### Phase 1: Understand the Report

Before touching any code, clarify:

- **What is the expected behavior?** (correct API response, data state, side effect)
- **What is the actual behavior?** (error message, wrong data, timeout, crash)
- **What are the reproduction steps?** (endpoint, payload, auth context, preconditions)
- **Is this a regression?** Check `git log` for recent changes to the affected module

If the report is vague, ask the user for clarification. Do NOT start investigating until the bug is clearly defined.

### Phase 2: Reproduce the Bug

**You MUST reproduce the bug before attempting any fix.**

#### Reproduction Methods (in priority order)

1. **Write a failing test** (preferred)
   ```typescript
   it('should [expected behavior] but [actual behavior]', async () => {
     // Setup: create the preconditions
     // Act: call the method/endpoint
     // Assert: verify the expected behavior
     // This test SHOULD FAIL — proving the bug exists
   });
   ```

2. **Call the API directly** (when test setup is complex)
   ```bash
   curl -X POST http://localhost:3000/api/endpoint \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"field": "value"}'
   ```

3. **Check logs/database** (for data-layer bugs)
   ```bash
   # Check recent logs
   npx nx run api:serve  # start server, observe output
   # Query database state
   ```

#### What Counts as Reproduction

- A failing test that demonstrates the incorrect behavior
- An API call that returns the wrong response/error
- Log output showing the error trace
- Database query showing incorrect state

#### If You Cannot Reproduce

- Check environment: are env vars set? Is the database seeded?
- Check auth: is the token valid? Does the user have the right role?
- Check data: does the referenced entity exist? Are foreign keys valid?
- Check timing: is this a race condition? Concurrent request issue?
- Report back: "I cannot reproduce this bug. Here's what I tried: [details]"

**DO NOT proceed to Phase 3 if the bug is not reproduced.**

### Phase 3: Identify Root Cause

Trace the bug to its exact source. Do not hypothesize — read the code.

#### Tracing Strategy

1. **Start from the error** — find the exact line that throws/returns the wrong result
2. **Trace the call chain** — controller → service → repository/provider
3. **Check the data flow** — are inputs validated? Are transforms correct?
4. **Identify the exact line(s)** that cause the issue
5. **Understand WHY** — what assumption is violated?

#### Common Root Cause Categories (NestJS Backend)

| Category | Symptoms | Investigation |
|----------|----------|---------------|
| **Validation** | 400 errors, wrong data accepted | Check DTOs, class-validator decorators, transform pipes |
| **Auth/Guards** | 401/403 errors, wrong access | Check guards, decorators, token extraction, role logic |
| **Query/ORM** | Wrong data returned, N+1 | Check QueryBuilder, relations, eager/lazy loading, WHERE clauses |
| **Transaction** | Partial writes, inconsistent state | Check transaction boundaries, isolation level, rollback handling |
| **Async/Race** | Intermittent failures, stale data | Check Promise chains, concurrent mutations, optimistic locking |
| **Serialization** | Wrong response shape, missing fields | Check interceptors, class-transformer, exclude/expose decorators |
| **External service** | Timeouts, unexpected responses | Check HTTP client config, retry logic, error mapping |
| **Migration** | Column missing, type mismatch | Check migration history, entity-DB alignment, pending migrations |
| **Dependency injection** | Provider not found, wrong scope | Check module imports/exports, provider scope (default/request/transient) |
| **WebSocket** | Connection drops, state desync | Check gateway lifecycle, room management, event naming |
| **Firestore** | Stale reads, permission denied | Check security rules, collection paths, batch write limits |
| **Cache** | Stale data, invalidation miss | Check TTL, cache key generation, invalidation triggers |

#### Evidence Required

Before proceeding, you must state:
```
ROOT CAUSE: [exact description]
FILE: [file path]
LINE(S): [line numbers]
WHY: [what assumption is violated]
```

### Phase 4: Apply Minimal Fix

**Fix ONLY the bug. Nothing else.**

#### Rules

- Change the minimum number of lines necessary
- Do NOT refactor surrounding code
- Do NOT add new abstractions, helpers, or utilities
- Do NOT change function signatures unless required for the fix
- Do NOT add error handling for unrelated scenarios
- Do NOT update imports, formatting, or comments on unchanged code
- Preserve existing patterns — match the style of surrounding code

#### Fix Pattern

```
1. Read the file(s) that need changes
2. Identify the exact edit(s)
3. Make the change
4. State what you changed and why
```

#### If the Fix Requires a Migration

- Confirm with the user before creating a migration
- Generate migration: `npx nx run api:migration:generate -- -n FixDescription`
- Verify the generated SQL is correct
- Check for rollback safety

### Phase 5: Verify the Fix

**You MUST verify the fix before reporting completion.**

#### Verification Methods

1. **Run the failing test from Phase 2** — it should now pass
   ```bash
   npx nx run api:test -- --testPathPattern="affected-file" --verbose
   ```

2. **Run the full test suite** — no regressions
   ```bash
   npx nx run api:test
   ```

3. **If no test exists, call the API** — confirm correct response

4. **Check for type safety**
   ```bash
   npx nx run api:build  # catches type errors
   ```

#### Verification Checklist

- [ ] Original failing test now passes
- [ ] No other tests broken (full suite green)
- [ ] Build succeeds with no type errors
- [ ] Fix addresses the EXACT reported issue
- [ ] No unrelated changes included

#### If Verification Fails

- DO NOT stack more changes on top
- Revert the change: `git checkout -- <file>`
- Re-analyze the root cause — your diagnosis was wrong
- Start Phase 3 again with the new information

## Anti-Patterns (What NOT To Do)

### The Shotgun Fix
Changing multiple things at once hoping one of them fixes the bug. This introduces regressions and makes it impossible to know what actually fixed the issue.

### The Assumption Fix
"I think this might be the issue..." without reproducing or tracing. This wastes cycles and often creates new bugs.

### The Defensive Bloat
Adding try/catch, null checks, fallbacks, and validation around the bug instead of fixing the actual cause. Band-aids hide bugs — they don't fix them.

### The ORM Workaround
Switching from QueryBuilder to raw SQL (or vice versa) to avoid understanding why the query is wrong. Fix the query, don't change the approach.

### The Scope Creep
Fixing the bug AND adding logging, updating error messages, refactoring the service, or "improving" the module. Scope the change to the bug only.

## Reporting Template

After completing all 5 phases, report:

```markdown
## Bug Fix: [short description]

**Reported:** [what the user reported]
**Reproduced:** [yes/no + method (test/API call/logs)]
**Root Cause:** [exact cause with file:line]
**Fix:** [what was changed and why]
**Verified:** [yes/no + test results]
**Files Changed:** [list]
```
