---
name: bug-fixing
description: >
  Structured bug-fixing methodology for browser games. Enforces a strict reproduce-first
  workflow: reproduce the bug with evidence, identify the root cause through code tracing,
  then apply a minimal targeted fix. Prevents guessing, scope creep, and cosmetic refactors
  during bug fixes. Applied when fixing bugs, debugging issues, or investigating broken
  game behavior.
---

# Frontend Bug-Fixing Methodology

This skill enforces a disciplined bug-fixing workflow for browser games. The cardinal rule:
**never guess — always prove.**

## The 5-Phase Workflow

Every bug fix MUST follow these phases in order. Skipping a phase is not allowed.

### Phase 1: Understand the Report

Before touching any code, clarify:

- **What is the expected behavior?**
- **What is the actual behavior?**
- **What are the reproduction steps?** (device, browser, viewport, user state)
- **Is this a regression?** Check `git log` for recent changes to the affected file

If the report is vague, ask the user for clarification. Do NOT start investigating until the bug is clearly defined.

### Phase 2: Reproduce the Bug

**You MUST reproduce the bug before attempting any fix.**

#### Browser Games (Chrome DevTools MCP)

1. Load the game page using `navigate_page`
2. Follow the exact reproduction steps
3. Check for console errors using `list_console_messages`
4. Take a screenshot as **before evidence** using `take_screenshot`
5. Check network requests if relevant using `list_network_requests`

#### What Counts as Reproduction

- Console error that matches the report
- Visual evidence (screenshot) showing the broken state
- Network failure visible in DevTools
- Game state inspection via `evaluate_script` showing incorrect values

#### If You Cannot Reproduce

- Try different viewport sizes (mobile: 375x667, tablet: 768x1024, desktop: 1440x900)
- Try with/without authentication
- Try clearing game state: `evaluate_script('localStorage.clear()')`
- Check if it's timing-dependent (race condition)
- Report back to user: "I cannot reproduce this bug with these steps. Can you provide more detail?"

**DO NOT proceed to Phase 3 if the bug is not reproduced.**

### Phase 3: Identify Root Cause

Trace the bug to its exact source. Do not hypothesize — read the code.

#### Tracing Strategy

1. **Start from the symptom** — find the code that produces the broken output
2. **Trace backwards** — follow the data flow to where it goes wrong
3. **Identify the exact line(s)** that cause the issue
4. **Understand WHY** — what assumption is violated? What edge case is unhandled?

#### Common Root Cause Categories (Browser Games)

| Category | Symptoms | Investigation |
|----------|----------|---------------|
| **Event handler** | Click/touch not responding | Check `addEventListener`, event delegation, z-index overlap, pointer-events CSS |
| **Game loop** | Freezing, stuttering, not updating | Check `requestAnimationFrame` chain, deltaTime calculation, pause/resume logic |
| **State management** | Wrong values, stale data | Trace variable mutations, check initialization order, look for race conditions |
| **Rendering** | Visual glitch, wrong position | Check canvas coordinates, CSS transforms, viewport calculations, device pixel ratio |
| **Mobile** | Works on desktop, broken on mobile | Check touch events vs mouse events, viewport meta tag, CSS media queries, safe area insets |
| **Audio** | No sound, audio errors | Check AudioContext resume on user gesture, mobile autoplay restrictions |
| **API/Cloud** | Save/load failures, auth errors | Check `window.apiClient` calls, auth state, network tab, CORS |
| **Collision** | Objects passing through each other | Check hitbox coordinates, collision detection frequency vs object speed |
| **Memory** | Slowdown over time | Check for event listener leaks, growing arrays, un-disposed objects |
| **3D (Babylon.js)** | Mesh issues, camera problems | Check scene.dispose(), material references, engine resize handlers |

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
- Do NOT restyle or reformat unchanged code
- Do NOT add features or "improvements"
- Do NOT change function signatures unless required for the fix
- Do NOT delete or rewrite functional code during cosmetic fixes
- Preserve the existing game loop, collision detection, and core mechanics

#### Fix Pattern

```
1. Read the file(s) that need changes
2. Identify the exact edit(s) — ideally a single Edit call per file
3. Make the change
4. State what you changed and why
```

#### If the Fix Requires Multiple Files

List all files that need changes BEFORE making any edits. Get user confirmation if the change spans more than 3 files.

### Phase 5: Verify the Fix

**You MUST verify the fix before reporting completion.**

#### Browser Games (Chrome DevTools MCP)

1. Reload the page using `navigate_page`
2. Follow the same reproduction steps from Phase 2
3. Confirm the bug no longer occurs
4. Check for console errors — there should be none
5. Take a screenshot as **after evidence** using `take_screenshot`
6. Test adjacent functionality to ensure no regressions

#### Verification Checklist

- [ ] Bug no longer reproduces with original steps
- [ ] No new console errors introduced
- [ ] Game loop still runs correctly
- [ ] Core mechanics (scoring, collision, controls) unaffected
- [ ] Mobile behavior unchanged (if applicable)
- [ ] Screenshot evidence captured (before/after)

#### If Verification Fails

- DO NOT stack more changes on top
- Revert the change: `git checkout -- <file>`
- Re-analyze the root cause — your diagnosis was wrong
- Start Phase 3 again with the new information

## Anti-Patterns (What NOT To Do)

### The Shotgun Fix
Changing multiple things at once hoping one of them fixes the bug. This introduces regressions and makes it impossible to know what actually fixed the issue.

### The Assumption Fix
"I think this might be the issue..." without reproducing or tracing. This is the #1 cause of fix cycles that create new bugs.

### The Cosmetic Creep
Fixing the bug AND reformatting code, adding comments, renaming variables, or "cleaning up" nearby code. Scope the change to the bug only.

### The Full Rewrite
Rewriting an entire function or module to fix a single bug. Unless the code is fundamentally broken at an architectural level, patch the specific issue.

### The Blind Retry
If the first fix attempt fails, trying the same approach with minor variations. If it didn't work, your root cause analysis is wrong — go back to Phase 3.

## Reporting Template

After completing all 5 phases, report:

```markdown
## Bug Fix: [short description]

**Reported:** [what the user reported]
**Reproduced:** [yes/no + evidence]
**Root Cause:** [exact cause with file:line]
**Fix:** [what was changed and why]
**Verified:** [yes/no + evidence]
**Files Changed:** [list]
```
