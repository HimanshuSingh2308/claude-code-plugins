---
description: Autonomous weekly game release workflow - scouts trends, designs PRD, builds game, reviews, QA tests, validates security, creates PR, and merges
argument-hint: [--dry-run | --execute | --resume <id> | --skip-scout --game "<concept>"]
---

# Weekly Game Release

Execute the complete autonomous weekly game release workflow.

**Arguments**: $ARGUMENTS

## Overview

This command orchestrates the entire weekly game release by coordinating:

| Component | Type | Purpose |
|-----------|------|---------|
| `game-trend-scout` | Skill | Research trends, rank game concepts |
| `product-designer` | Agent | Web research + competitive analysis + PRD creation |
| `game-design-prd` | Skill | PRD template (used by product-designer agent) |
| `add-game-orchestrator` | Agent | Implement game in monorepo (coordinates 6 sub-agents) |
| `mobile-game-ux` | Knowledge | Mobile UX patterns |
| `animation-patterns` | Knowledge | Animation best practices |
| `sound-design` | Knowledge | Audio implementation |
| `performance-tuning` | Knowledge | Optimization patterns |
| `level-design` | Knowledge | Zone layout, NPC paths, spatial design |
| `game-theory` | Knowledge | Flow theory, player psychology |
| `economy-design` | Knowledge | Currency balance, upgrade pricing |
| `game-balancing` | Knowledge | Difficulty curves, scoring formulas, XP tuning |
| `css-game-art` | Knowledge | CSS character/environment art |
| `game-accessibility` | Knowledge | Inclusive design patterns |
| `playtesting` | Knowledge | Self-testing methodology, feel/pacing evaluation |
| `post-launch` | Knowledge | Post-release monitoring, iteration priorities |
| `game-code-reviewer` | Agent | Code quality scoring |
| `game-qa-tester` | Agent | Bug detection |
| `game-visual-tester` | Agent | Screenshot-based visual QA |
| `game-accessibility-auditor` | Agent | Accessibility scoring (target: 45/65+) |
| `game-economy-validator` | Agent | Economy balance validation |
| `leaderboard-validator` | Agent | Security assessment |
| GitHub MCP | External | PRs, issues, merging |

## Command Options

```
/weekly-game-release [options]

Options:
  --dry-run              Preview all operations without executing
  --execute              Execute workflow (default behavior)
  --resume <id>          Resume failed workflow from checkpoint
  --skip-scout           Skip scouting, use provided concept
  --game "<concept>"     Game concept (requires --skip-scout)
  --no-merge             Stop before merge (create PR only)
  --verbose              Show detailed progress logs
```

## Usage Examples

### Standard Release (Recommended First Run)
```
/weekly-game-release --dry-run
```
Preview the entire workflow, then execute with `--execute`.

### Execute Release
```
/weekly-game-release --execute
```
Run the full autonomous workflow.

### With Specific Game Concept
```
/weekly-game-release --skip-scout --game "Emoji Memory Match"
```
Skip trend scouting and use the provided concept.

### Resume Failed Workflow
```
/weekly-game-release --resume 2026-03-18-143022
```
Continue from the last successful phase.

### Create PR Only (No Auto-Merge)
```
/weekly-game-release --no-merge
```
Stop after PR creation for manual review.

---

## Workflow Execution

### Pre-Flight Checks

Before any workflow starts, verify:

```bash
# Repository state
git status --porcelain                    # Must be clean
git branch --show-current                 # Must be 'main'
git fetch && git status                   # Must be up to date

# No conflicts
git branch --list "feature/game-*"        # Should be empty
gh pr list --state open                   # No conflicting PRs

# Build health
npm install && npm run build              # Must succeed

# Permissions
gh auth status                            # Must be authenticated
```

If any check fails, abort before making changes.

### Phase 1: Scout & Select

```yaml
Skill: game-trend-scout
Output: ~/Documents/weekly-games/{topic}-scout-{month}-{year}.md

Selection Criteria:
  - Score >= 7.0: Select immediately
  - Score 6.5-6.9: Select with warning
  - Score < 6.5: Abort workflow
```

### Phase 2: Design

```yaml
Agent: product-designer
Mode: create
Input: Selected concept from Phase 1
Output: ~/Documents/weekly-games/{game-slug}-prd.md

Steps:
  - Web research: competitors, market trends, player expectations
  - Check existing PRDs in docs/ for overlap
  - Generate PRD using game-design-prd template
  - Add Section 18: Research & Competitive Analysis

Validation:
  - All 14 PRD sections present + Section 18 (Research)
  - Core loop diagram included
  - Scoring system defined
  - Competitive analysis with 3+ competitors
  - Extractable values (GAME_NAME, GAME_SLUG, etc.)
```

### Phase 3: Build

```yaml
Agent: add-game-orchestrator (spawns sub-agents + knowledge skills)
Branch: feature/game-{slug}

Guardrails Applied:
  BLOCKED:
    - Changes to api-client.js, auth.js
    - Changes to other games
    - Force operations

  CONFIRM:
    - Modify index.html
    - Modify sitemap.xml
    - Modify leaderboard/index.html

  SAFE:
    - Create files in games/{new-slug}/
    - Read any file
    - Run build/test commands
```

### Phase 4: Review Loop

```yaml
Agent: game-code-reviewer
Max Iterations: 3
Pass Threshold: 20/30
Borderline Accept: 15/30 (after 3 iterations)

Per Iteration:
  1. Run code review
  2. If score >= 20: pass
  3. If score < 20 and iterations < 3:
     - Fix critical issues
     - Fix improvements
     - Commit and retry
  4. If score < 15 after 3 iterations: abort
```

### Phase 5: Visual QA

```yaml
Agent: game-visual-tester
Runs: After code review, before functional QA

Steps:
  1. Navigate to game on local dev server or file path
  2. Desktop testing (1920x1080):
     - Screenshot initial load, menu, gameplay, game over
     - Verify layout, text readability, no overflow
  3. Mobile testing (iPhone 14 Pro, iPhone SE, Pixel 7):
     - Emulate each device
     - Screenshot all game states
     - Verify touch targets >= 44px, no horizontal scroll
     - Check safe area / notch handling
  4. Responsive breakpoints (320, 375, 414, 768, 1024, 1920):
     - Screenshot each width
     - Flag layout jumps, overlapping elements, truncated text
  5. Console & network check:
     - list_console_messages — flag errors
     - list_network_requests — flag 404s
  6. Performance snapshot:
     - Lighthouse performance + accessibility scores
     - FPS during gameplay (target: 60 desktop, 30+ mobile)

CRITICAL issues (game unplayable at any viewport):
  - Fix immediately
  - Re-test that viewport

HIGH issues (major visual breakage):
  - Fix immediately
  - Commit and re-test

MEDIUM/LOW issues:
  - Create GitHub issue (deferred)
  - Label: visual, {severity}, {viewport}

Exit when: No CRITICAL/HIGH visual issues remain
Abort when: CRITICAL/HIGH persist after 2 iterations

Output: Visual QA report with screenshot inventory, included in PR description
```

### Phase 6: QA Loop

```yaml
Agent: game-qa-tester
Max Iterations: 3

Per Iteration:
  1. Run QA tests
  2. Categorize bugs by severity

  CRITICAL/HIGH bugs:
    - Fix immediately
    - Commit and re-test

  MEDIUM/LOW bugs:
    - Create GitHub issue (deferred)
    - Label: bug, {severity}, deferred

  Exit when: No CRITICAL/HIGH bugs remain
  Abort when: CRITICAL/HIGH persist after 3 iterations

Knowledge: playtesting
  - After QA bugs are resolved, run a structured self-playtest
  - Evaluate: first 30s clarity, "one more round" feel, skill expression moments
  - Check score fairness and curiosity signals
  - Log feel/pacing issues as MEDIUM GitHub issues for post-launch tuning
```

### Phase 7: Security Validation

```yaml
Agent: leaderboard-validator

HIGH-risk issues:
  - CONFIRM: "Fix security issue: {description}?"
  - Apply fix
  - Re-validate
  - Abort if still HIGH-risk

MEDIUM-risk issues:
  - Document as accepted risk
  - Include in PR description
```

### Phase 8: Economy Validation

```yaml
Agent: game-economy-validator

Checks:
  - Revenue projection (no upgrades) for 20 sessions
  - Revenue projection (with optimal upgrades)
  - Dead zone detection (can't afford anything for 3+ sessions)
  - Upgrade payback analysis (target: 1.5-4 sessions)
  - Dominant upgrade check
  - Score spread ratio (target: 10-30x)
  - Server-side game config exists

CRITICAL issues (dead zones, broken math):
  - Fix immediately
  - Re-validate

HIGH issues (dominant upgrades, grindy pacing):
  - Fix if straightforward
  - Document as known issue if complex

MEDIUM issues:
  - Document for post-launch tuning
```

### Phase 9: Accessibility Audit

```yaml
Agent: game-accessibility-auditor

Checks:
  - Lighthouse accessibility score (target: 90+)
  - Color contrast (WCAG AA)
  - prefers-reduced-motion support
  - Touch targets >= 44px
  - Keyboard navigation
  - Screen reader ARIA labels
  - Non-color state indicators

Target score: 45/65+

CRITICAL issues (no reduced-motion, contrast failures):
  - Fix immediately
  - Re-audit

HIGH issues (missing ARIA, small touch targets):
  - Fix if straightforward
  - Create GitHub issue if complex

MEDIUM/LOW issues:
  - Create GitHub issues for future improvement
```

### Phase 10: PR & Merge

```yaml
GitHub Operations:
  1. CONFIRM: "Push to origin/{branch}?"
  2. Create PR with summary
  3. Wait for CI checks
  4. CONFIRM: "Merge PR #{n}?"
  5. Squash merge and delete branch

Abort if: CI checks fail after fix attempt
```

### Phase 11: Post-Release

```yaml
Actions:
  - Verify game in main branch
  - Generate release notes
  - Calculate workflow metrics
  - Save final state

Knowledge: post-launch
  - Generate post-release monitoring plan:
    - What metrics to watch (session length, score spread, bounce rate)
    - What to improve first based on QA/playtest findings
    - What to cut if engagement is low
    - A/B test candidates from deferred issues
  - Include monitoring plan in release notes

Output:
  - Release notes: ~/Documents/weekly-games/releases/{slug}-release-notes.md
  - Monitoring plan: included in release notes under "Post-Launch" section
  - Workflow state: ~/Documents/weekly-games/workflows/{id}.json
```

---

## Guardrails Summary

| Category | Behavior |
|----------|----------|
| Database ops | BLOCKED |
| Force push | BLOCKED |
| Modify existing games | BLOCKED |
| Modify shared code | BLOCKED |
| Delete outside new game | CONFIRM |
| Modify integration files | CONFIRM |
| Git push | CONFIRM |
| Merge PR | CONFIRM |
| Create in new game folder | SAFE |
| Read operations | SAFE |
| Build/test | SAFE |
| Create issues/PRs | SAFE |

See `orchestrator-guardrails` skill for complete rules.

---

## Dry-Run Output

When using `--dry-run`, the orchestrator simulates all phases and outputs:

```
## Dry-Run Summary

### Phase Results
| Phase | Status | Key Output |
|-------|--------|------------|
| Scout | Simulated | Top concept: "Emoji Match" (score: 8.2) |
| Design | Simulated | PRD with 14 sections |
| Build | Simulated | 3 files to create, 3 to modify |
| Review | Estimated | Initial review pending |
| Visual QA | Estimated | Desktop + mobile screenshots pending |
| QA | Estimated | Testing pending |
| Security | Estimated | Validation pending |
| Economy | Estimated | Balance validation pending |
| Accessibility | Estimated | Audit pending |
| PR | Planned | Would create PR |
| Post-Release | Planned | Release notes + monitoring plan |

### Files to Create
- apps/web/src/games/emoji-match/index.html

### Files to Modify (require confirmation)
- apps/web/src/index.html
- apps/web/src/sitemap.xml
- apps/web/src/leaderboard/index.html

### Git Operations
1. Create branch: feature/game-emoji-match
2. Commit: "feat(game): Add Emoji Match game"
3. Push to origin (confirmation required)

### GitHub Operations
1. Create PR (confirmation required for merge)
2. Create issues for deferred bugs

---
To execute: /weekly-game-release --execute
```

---

## Error Handling

### Automatic Rollback

On workflow failure:

```
CONFIRM: "Workflow failed at {phase}. Rollback? [Y/n]"

Rollback actions:
1. Delete local feature branch
2. Delete remote feature branch (if pushed)
3. Close open PR (if created)
4. Cancel deferred issues (if created)
```

### Manual Recovery

If rollback is rejected or post-merge failure:

```
State file: ~/Documents/weekly-games/workflows/{id}.json
Contains: All phase data, files created, commits made

Manual steps may be needed for:
- Reverting merged commits
- Cleaning up partial deployments
```

---

## Workflow State

State is persisted throughout execution:

**Location**: `~/Documents/weekly-games/workflows/{workflow-id}.json`

**Contents**:
- Current phase and status
- All phase outputs and artifacts
- Files created/modified
- Commits made
- Issues created
- Confirmations logged
- Errors encountered

Use `--resume {id}` to continue from any checkpoint.

---

## Notes

- Average workflow duration: 45-90 minutes
- Requires: GitHub MCP, Weekly Arcade repo access
- All confirmations are logged for audit trail
- Metrics are captured for workflow optimization
