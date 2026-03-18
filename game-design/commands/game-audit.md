---
description: Run comprehensive quality audit on any game - code review, QA testing, and security validation
argument-hint: <game-slug> [--review-only | --qa-only | --security-only | --fix]
---

# Game Audit

Run all quality agents on an existing game to assess its health and identify issues.

**Arguments**: $ARGUMENTS

## Overview

This command runs a comprehensive audit by invoking:
- `game-code-reviewer` - Code quality analysis
- `game-qa-tester` - Bug and UX testing
- `leaderboard-validator` - Security assessment

Use this to:
- Audit games before major updates
- Investigate reported issues
- Generate quality reports for stakeholders
- Identify technical debt

## Command Options

```
/game-audit <game-slug> [options]

Arguments:
  <game-slug>          The game folder name (e.g., "emoji-match", "word-stack")

Options:
  --review-only        Run code review only
  --qa-only            Run QA testing only
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

Output:
  - Overall score (/30)
  - Issues by category
  - Improvement suggestions
```

### Step 3: Run QA Testing

```yaml
Agent: game-qa-tester
Target: apps/web/src/games/{game-slug}/**

Output:
  - Bugs by severity
  - UX issues
  - Mobile compatibility
  - Accessibility findings
```

### Step 4: Run Security Validation

```yaml
Agent: leaderboard-validator
Target: apps/web/src/games/{game-slug}/**

Output:
  - Security assessment
  - Vulnerabilities found
  - Risk levels
```

### Step 5: Generate Report

```markdown
# Game Audit Report: {game-name}

**Date**: {date}
**Game**: {game-slug}
**Auditor**: Game Audit Command v2.0

---

## Summary

| Category | Score/Status | Issues |
|----------|--------------|--------|
| Code Quality | {score}/30 | {count} |
| QA Testing | {pass/fail} | {bug_count} |
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

## QA Test Results

### Bug Summary
| Severity | Count |
|----------|-------|
| CRITICAL | {n} |
| HIGH | {n} |
| MEDIUM | {n} |
| LOW | {n} |

### Detailed Bugs
{list of bugs with reproduction steps}

### UX Issues
{list of UX problems}

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
{numbered list}

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
