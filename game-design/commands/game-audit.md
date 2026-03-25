---
description: Run comprehensive quality audit on any game - code review, visual QA, functional QA, accessibility, economy balance, and security validation
argument-hint: <game-slug> [--review-only | --visual-only | --qa-only | --accessibility-only | --economy-only | --security-only | --fix]
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
/game-audit <game-slug> [options]

Arguments:
  <game-slug>          The game folder name (e.g., "emoji-match", "word-stack")

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
```

## Usage Examples

### Full Audit
```bash
/game-audit emoji-match
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
ls apps/web/src/games/{game-slug}/

# If not found, list available games
ls apps/web/src/games/
```

### Step 2: Run Code Review

```yaml
Agent: game-code-reviewer
Target: apps/web/src/games/{game-slug}/**
Knowledge: game-balancing, performance-tuning

Output:
  - Overall score (/30)
  - Issues by category (architecture, performance, mobile, audio, animation, security)
  - Improvement suggestions
  - Difficulty/scoring assessment (informed by game-balancing knowledge)
  - Performance evaluation (informed by performance-tuning knowledge)
```

### Step 3: Visual QA

```yaml
Agent: game-visual-tester
Target: apps/web/src/games/{game-slug}/
Knowledge: mobile-game-ux

Steps:
  1. Desktop testing (1920x1080) — screenshot load, menu, gameplay, game over
  2. Mobile testing (iPhone 14 Pro, iPhone SE, Pixel 7) — emulate + screenshot all states
  3. Responsive breakpoints (320, 375, 414, 768, 1024, 1920)
  4. Console/network error check
  5. Lighthouse performance + accessibility scores

Output:
  - Visual QA report with screenshot inventory
  - Viewport pass/fail matrix
  - Console errors found
  - Lighthouse scores
  - Mobile UX assessment (informed by mobile-game-ux knowledge)
```

### Step 4: Functional QA

```yaml
Agent: game-qa-tester
Target: apps/web/src/games/{game-slug}/**
Knowledge: playtesting

Output:
  - Bugs by severity
  - UX issues
  - Mobile compatibility
  - Feel/pacing assessment (informed by playtesting knowledge)
```

### Step 5: Accessibility Audit

```yaml
Agent: game-accessibility-auditor
Target: apps/web/src/games/{game-slug}/
Knowledge: game-accessibility

Checks:
  - Lighthouse accessibility score (target: 90+)
  - Color contrast (WCAG AA)
  - prefers-reduced-motion support
  - Touch targets >= 44px
  - Keyboard navigation
  - Screen reader ARIA labels
  - Non-color state indicators

Target score: 45/65+

Output:
  - Accessibility score and breakdown
  - Issues by severity
  - WCAG compliance status
```

### Step 6: Economy Validation

```yaml
Agent: game-economy-validator
Target: apps/web/src/games/{game-slug}/
Knowledge: game-balancing

Checks:
  - Revenue projection (no upgrades) for 20 sessions
  - Revenue projection (with optimal upgrades)
  - Dead zone detection (can't afford anything for 3+ sessions)
  - Upgrade payback analysis (target: 1.5-4 sessions)
  - Dominant upgrade check
  - Score spread ratio (target: 10-30x)

Output:
  - Economy health assessment
  - Dead zone warnings
  - Balance recommendations

Note: Skip if game has no economy/upgrade system
```

### Step 7: Security Validation

```yaml
Agent: leaderboard-validator
Target: apps/web/src/games/{game-slug}/**

Output:
  - Security assessment
  - Vulnerabilities found
  - Risk levels
  - Anti-cheat evaluation
```

### Step 8: Generate Report

```markdown
# Game Audit Report: {game-name}

**Date**: {date}
**Game**: {game-slug}
**Auditor**: Game Audit Command v3.0

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

## Notes

- Audit is read-only by default (no changes made)
- Use `--fix` to enable auto-fixing with confirmations
- All fixes follow `orchestrator-guardrails` rules
- Audit results can be used for sprint planning
