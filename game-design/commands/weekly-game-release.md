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
| `game-design-prd` | Skill | Generate complete PRD |
| `add-new-game` | Skill | Implement game in monorepo |
| `mobile-game-ux` | Knowledge | Mobile UX patterns |
| `animation-patterns` | Knowledge | Animation best practices |
| `sound-design` | Knowledge | Audio implementation |
| `performance-tuning` | Knowledge | Optimization patterns |
| `game-code-reviewer` | Agent | Code quality scoring |
| `game-qa-tester` | Agent | Bug detection |
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
Skill: game-design-prd
Input: Selected concept from Phase 1
Output: ~/Documents/weekly-games/{game-slug}-prd.md

Validation:
  - All 14 PRD sections present
  - Core loop diagram included
  - Scoring system defined
  - Extractable values (GAME_NAME, GAME_SLUG, etc.)
```

### Phase 3: Build

```yaml
Skills: add-new-game + knowledge skills
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

### Phase 5: QA Loop

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
```

### Phase 6: Security Validation

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

### Phase 7: PR & Merge

```yaml
GitHub Operations:
  1. CONFIRM: "Push to origin/{branch}?"
  2. Create PR with summary
  3. Wait for CI checks
  4. CONFIRM: "Merge PR #{n}?"
  5. Squash merge and delete branch

Abort if: CI checks fail after fix attempt
```

### Phase 8: Post-Release

```yaml
Actions:
  - Verify game in main branch
  - Generate release notes
  - Calculate workflow metrics
  - Save final state

Output:
  - Release notes: ~/Documents/weekly-games/releases/{slug}-release-notes.md
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
| QA | Estimated | Testing pending |
| Security | Estimated | Validation pending |
| PR | Planned | Would create PR |

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
