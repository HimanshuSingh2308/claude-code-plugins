---
description: Run comprehensive quality audit on one or more games - code review, visual QA, functional QA, accessibility, economy balance, and security validation. Supports batch mode for auditing multiple games in parallel.
argument-hint: <game-slug> [game-slug-2 ...] [--review-only | --visual-only | --qa-only | --accessibility-only | --economy-only | --security-only | --fix | --batch]
---

# Game Audit

Run all quality agents on an existing game to assess its health and identify issues.

**Arguments**: $ARGUMENTS

## Overview

This command runs a comprehensive audit by invoking all quality agents:

| Component | Type | Purpose |
|-----------|------|---------|
| `game-code-reviewer` | Agent | Code quality analysis (score /30) |
| `game-visual-tester` | Agent | Layout, responsiveness, visual regression |
| `game-qa-tester` | Agent | Bug detection, UX testing |
| `game-accessibility-auditor` | Agent | WCAG compliance, touch targets, reduced motion |
| `game-economy-validator` | Agent | Economy balance, dead zones, upgrade pricing |
| `leaderboard-validator` | Agent | Security assessment, anti-cheat |
| `game-balancing` | Knowledge | Evaluate difficulty/scoring findings |
| `economy-design` | Knowledge | Evaluate economy balance, pricing curves, faucet/sink ratios |
| `level-design` | Knowledge | Evaluate spatial layout, camera, zone progression |
| `performance-tuning` | Knowledge | Evaluate performance findings |
| `mobile-game-ux` | Knowledge | Evaluate mobile UX findings |
| `game-accessibility` | Knowledge | Context for accessibility findings |
| `playtesting` | Knowledge | Feel/pacing evaluation criteria |

Use this to:
- Audit games before major updates
- Investigate reported issues
- Generate quality reports for stakeholders
- Identify technical debt
- Validate economy balance post-tuning
- Check accessibility compliance

## Command Options

```
/game-audit <game-slug> [game-slug-2 ...] [options]

Arguments:
  <game-slug>          One or more game folder names (e.g., "emoji-match", "word-stack")

Options:
  --review-only        Run code review only
  --visual-only        Run visual QA only
  --qa-only            Run functional QA testing only
  --accessibility-only Run accessibility audit only
  --economy-only       Run economy validation only
  --security-only      Run security validation only
  --fix                Auto-fix issues found (requires confirmation)
  --output <path>      Save report to specific path
  --verbose            Show detailed findings
  --batch              Explicit batch mode (auto-enabled when multiple slugs provided)
```

## Usage Examples

### Full Audit (Single Game)
```bash
/game-audit emoji-match
```

### Batch Audit (Multiple Games)
```bash
/game-audit emoji-match word-stack puzzle-game
```

### Code Review Only
```bash
/game-audit word-stack --review-only
```

### Visual QA Only
```bash
/game-audit word-stack --visual-only
```

### Accessibility Audit Only
```bash
/game-audit word-stack --accessibility-only
```

### Economy Validation Only
```bash
/game-audit word-stack --economy-only
```

### Audit with Auto-Fix
```bash
/game-audit tetris-clone --fix
```

### Save Report
```bash
/game-audit puzzle-game --output ~/Documents/audits/puzzle-audit.md
```

---

## Workflow

### Step 1: Validate Game Exists

```bash
# Check game folder exists
ls apps/web-astro/src/pages/games/{game-slug}.astro

# If not found, list available games
ls apps/web-astro/src/pages/games/
```

### Step 2: Read Game Files Once (Shared Context)

```yaml
Purpose: Read all game files ONCE upfront and share the parsed context across all agents.
         This eliminates redundant file I/O — 6 agents reading the same files independently
         would cost 6x the read operations.

Files to read:
  - apps/web-astro/src/pages/games/{game-slug}.astro     (game page)
  - apps/web-astro/src/data/games/{game-slug}.json      (game metadata)
  - apps/web-astro/src/pages/index.astro                (integration check)
  - apps/web-astro/src/pages/leaderboard.astro          (leaderboard integration)

Store: game_context = { sourceFiles, htmlContent, fileCount, hasEconomy, hasLeaderboard }
```

### Step 3: Run ALL Agents in Parallel

**IMPORTANT**: Launch all 6 agents concurrently using parallel Agent tool calls in a single message.
Each agent is independent — they read the same game files and produce separate reports.
Running them sequentially wastes ~80% of the audit time.

```yaml
# Launch ALL of these agents in a SINGLE message with parallel tool calls:

Agent 1 - Code Review:
  agent: game-code-reviewer
  target: apps/web-astro/src/pages/games/{game-slug}.astro**
  knowledge: game-balancing, performance-tuning
  output: Overall score (/30), issues by category, improvement suggestions

Agent 2 - Visual QA:
  agent: game-visual-tester
  target: apps/web-astro/src/pages/games/{game-slug}.astro
  knowledge: mobile-game-ux
  output: Viewport pass/fail matrix, Lighthouse scores, console errors

Agent 3 - Functional QA:
  agent: game-qa-tester
  target: apps/web-astro/src/pages/games/{game-slug}.astro**
  knowledge: playtesting
  output: Bugs by severity, UX issues, mobile compatibility

Agent 4 - Accessibility Audit:
  agent: game-accessibility-auditor
  target: apps/web-astro/src/pages/games/{game-slug}.astro
  knowledge: game-accessibility
  output: Accessibility score (/65), WCAG compliance, issues by severity

Agent 5 - Economy Validation (skip if no economy system):
  agent: game-economy-validator
  target: apps/web-astro/src/pages/games/{game-slug}.astro
  knowledge: game-balancing, economy-design
  output: Economy health, dead zone warnings, balance recommendations

Agent 6 - Security Validation:
  agent: leaderboard-validator
  target: apps/web-astro/src/pages/games/{game-slug}.astro**
  output: Security assessment, vulnerabilities, anti-cheat evaluation
```

**Why parallel**: Each agent analyzes different dimensions independently. No agent's output
feeds into another agent's input. Parallel execution reduces audit time from ~6x to ~1x
(bounded by the slowest agent).

### Step 4: Collect & Merge Results

```yaml
Wait for all 6 agents to complete, then merge results:

results = {
  codeReview:    agent1.output,   # score /30, issues
  visualQa:      agent2.output,   # viewport matrix, Lighthouse
  functionalQa:  agent3.output,   # bugs by severity
  accessibility:  agent4.output,   # score /65, WCAG
  economy:       agent5.output,   # health, dead zones (or "N/A")
  security:      agent6.output,   # assessment, vulns
}

# Cross-reference findings across agents for duplicates
# e.g., visual-tester and qa-tester may both flag the same mobile layout bug
deduplicate(results)
```

### Step 5: Generate Report

```markdown
# Game Audit Report: {game-name}

**Date**: {date}
**Game**: {game-slug}
**Auditor**: Game Audit Command v4.0 (parallel agents)

---

## Summary

| Category | Score/Status | Issues |
|----------|--------------|--------|
| Code Quality | {score}/30 | {count} |
| Visual QA | {pass/fail} | {issue_count} |
| Functional QA | {pass/fail} | {bug_count} |
| Accessibility | {score}/65 | {issue_count} |
| Economy | {healthy/warning/critical} | {issue_count} |
| Security | {assessment} | {vuln_count} |

**Overall Health**: {HEALTHY | NEEDS_ATTENTION | CRITICAL}

---

## Code Review Results

### Score Breakdown
| Category | Score |
|----------|-------|
| Architecture | {n}/5 |
| Performance | {n}/5 |
| Mobile | {n}/5 |
| Audio | {n}/5 |
| Animation | {n}/5 |
| Security | {n}/5 |

### Critical Issues
{list of critical issues with file:line}

### Improvements Needed
{list of improvements}

---

## Visual QA Results

### Viewport Matrix
| Viewport | Load | Menu | Gameplay | Game Over | Issues |
|----------|------|------|----------|-----------|--------|
| Desktop 1920x1080 | {status} | {status} | {status} | {status} | {n} |
| iPhone 14 Pro | {status} | {status} | {status} | {status} | {n} |
| iPhone SE | {status} | {status} | {status} | {status} | {n} |
| Pixel 7 | {status} | {status} | {status} | {status} | {n} |

### Lighthouse Scores
| Metric | Desktop | Mobile |
|--------|---------|--------|
| Performance | {n} | {n} |
| Accessibility | {n} | {n} |
| FPS (gameplay) | {n} | {n} |
| Console Errors | {n} | {n} |

### Visual Issues
{list of visual bugs with viewport, screenshot, and suggested fix}

---

## Functional QA Results

### Bug Summary
| Severity | Count |
|----------|-------|
| CRITICAL | {n} |
| HIGH | {n} |
| MEDIUM | {n} |
| LOW | {n} |

### Detailed Bugs
{list of bugs with reproduction steps}

### UX & Feel Assessment
{pacing, first-30s clarity, "one more round" factor, skill expression — informed by playtesting knowledge}

---

## Accessibility Audit Results

### Score: {n}/65

| Dimension | Score | Status |
|-----------|-------|--------|
| Color Contrast (WCAG AA) | {status} | {pass/fail} |
| prefers-reduced-motion | {status} | {pass/fail} |
| Touch Targets >= 44px | {status} | {pass/fail} |
| Keyboard Navigation | {status} | {pass/fail} |
| Screen Reader ARIA | {status} | {pass/fail} |
| Non-color Indicators | {status} | {pass/fail} |

### Issues
{list of accessibility issues by severity}

---

## Economy Validation Results

{Skip this section if game has no economy/upgrade system}

| Check | Status | Details |
|-------|--------|---------|
| Dead Zones | {pass/warn/fail} | {details} |
| Upgrade Payback (1.5-4 sessions) | {pass/warn/fail} | {details} |
| Dominant Upgrade | {pass/warn/fail} | {details} |
| Score Spread (10-30x) | {pass/warn/fail} | {details} |
| Revenue Projection | {healthy/grindy/trivial} | {details} |

### Balance Recommendations
{list of tuning suggestions}

---

## Security Assessment

### Validation Results
| Area | Status |
|------|--------|
| Client-Side | {PASS/FAIL} |
| Server-Side | {PASS/FAIL} |
| Anti-Cheat | {PASS/FAIL} |
| Data Integrity | {PASS/FAIL} |

### Vulnerabilities
{list of vulnerabilities with risk levels}

---

## Recommendations

### Immediate Actions (CRITICAL/HIGH)
{numbered list — aggregated across all audit categories}

### Short-term Improvements
{numbered list}

### Long-term Considerations
{numbered list}

---

## Fix Commands

To auto-fix identified issues:
\`\`\`bash
/game-audit {game-slug} --fix
\`\`\`

To create issues for tracking:
\`\`\`bash
gh issue create --title "[{game-slug}] Audit findings" --body "..."
\`\`\`
```

---

## Fix Mode (--fix)

When `--fix` is specified:

### Guardrails Apply
- **CONFIRM** before any file modification
- **BLOCK** changes to shared code
- **SAFE** changes within game folder only

### Fix Priority
1. CRITICAL security issues
2. CRITICAL bugs
3. HIGH severity items
4. Code review critical issues

### Fix Workflow
```
FOR each fixable issue:
  SHOW: Issue description and proposed fix
  CONFIRM: "Apply fix for: {issue}? [Y/n/s(kip all)]"

  IF confirmed:
    APPLY fix
    LOG: "Fixed: {issue}"

  IF skip all:
    BREAK

After fixes:
  git add {modified_files}
  CONFIRM: "Commit fixes? [Y/n]"
  git commit -m "fix({game-slug}): Apply audit fixes"
```

---

## Output Location

Default: `~/Documents/weekly-games/audits/{game-slug}-audit-{date}.md`

Custom: Use `--output <path>` to specify location

---

## Batch Audit Mode (Multiple Games)

When multiple game slugs are provided, run audits in parallel for maximum efficiency.

### Batch Workflow

```
1. Validate all game slugs exist:
   FOR slug IN game_slugs (PARALLEL):
     ls apps/web-astro/src/pages/games/{slug}/
   IF any missing: report and continue with valid ones

2. Read all game files upfront (PARALLEL):
   FOR slug IN valid_slugs (PARALLEL):
     game_contexts[slug] = read(apps/web-astro/src/pages/games/{slug}.astro, apps/web-astro/src/data/games/{slug}.json)

3. Launch all audits in PARALLEL:
   # For N games × 6 agents = 6N agent calls, but organized as N parallel audit groups
   FOR slug IN valid_slugs (PARALLEL — each game's 6 agents also run in parallel):
     results[slug] = run_parallel_agents(slug)  # Same as single-game Step 3

4. Generate Comparative Report:
   Merge all individual reports into a side-by-side comparison
```

### Comparative Report Format

```markdown
# Batch Audit Report

**Date**: {date}
**Games Audited**: {count}

## Comparison Matrix

| Metric | {game1} | {game2} | {game3} | Average |
|--------|---------|---------|---------|---------|
| Code Quality (/30) | {n} | {n} | {n} | {avg} |
| Accessibility (/65) | {n} | {n} | {n} | {avg} |
| Lighthouse Perf | {n} | {n} | {n} | {avg} |
| Lighthouse A11y | {n} | {n} | {n} | {avg} |
| Bug Count (CRIT/HIGH) | {n} | {n} | {n} | — |
| Bug Count (MED/LOW) | {n} | {n} | {n} | — |
| Economy Health | {status} | {status} | {status} | — |
| Security | {status} | {status} | {status} | — |

## Common Patterns Across Games
{Issues that appear in multiple games — fix once, apply everywhere}

## Per-Game Details
{Individual audit reports follow}
```

### Batch Output Location

Default: `~/Documents/weekly-games/audits/batch-audit-{date}.md`

---

## Notes

- Audit is read-only by default (no changes made)
- Use `--fix` to enable auto-fixing with confirmations
- All fixes follow `orchestrator-guardrails` rules
- Audit results can be used for sprint planning
- Batch mode auto-enables when multiple game slugs are provided
