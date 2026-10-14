---
description: View history and status of orchestrator workflows
argument-hint: [<workflow-id> | --running | --failed | --completed | --all]
---

# Workflow Status

View the status and history of release orchestrator runs: `/weekly-game-release` (Weekly Arcade)
and `/game-release` (standalone games).

**Arguments**: $ARGUMENTS

## Step 0: Game context

Load `game-context` first. WA-specific steps below are marked (WA only); skip them for standalone games.

The context only sets the default source: Weekly Arcade shows weekly runs, standalone shows
`/game-release` runs for this game's repo. `--source` overrides it, and when no game context
resolves (for example run from the home directory) default to `--source all` instead of asking.

## Overview

Track orchestrator workflows to:
- Monitor running workflows
- Debug failed workflows
- Review completed releases
- Access workflow artifacts
- Resume interrupted workflows

## Command Options

```
/workflow-status [options]

Arguments:
  <workflow-id>          View specific workflow details

Options:
  --running              Show only running workflows
  --failed               Show only failed workflows
  --completed            Show only completed workflows
  --all                  Show all workflows (default: last 10)
  --limit <n>            Limit results (default: 10)
  --since <date>         Filter by date (YYYY-MM-DD)
  --json                 Output as JSON
  --source <weekly|game|all>  Which workflows to list (default: from the game context)
```

## Usage Examples

### List Recent Workflows
```bash
/workflow-status
```

### View Specific Workflow
```bash
/workflow-status 2026-03-18-143022
```

### Show Failed Only
```bash
/workflow-status --failed
```

### Last 30 Days
```bash
/workflow-status --all --since 2026-02-18
```

---

## Workflow

### Step 1: Locate Workflow Data

```bash
# (WA only) weekly releases
WEEKLY_DIR=~/Documents/weekly-games/workflows/
ls -la $WEEKLY_DIR/*.json

# standalone game releases (ids start with gr-)
GAME_DIR=~/Documents/game-releases/workflows/
ls -la $GAME_DIR/gr-*.json
```

Standalone default: keep only files whose `repoPath` is the current game's repo; `--source game`
shows all standalone runs, `--source all` shows both directories in one table with a Type column.

### Step 2: Parse Workflow States

```yaml
FOR each workflow file:
  PARSE JSON
  EXTRACT:
    - id
    - currentPhase
    - startedAt
    - lastUpdated
    - game name (if available)
    - final status
    - workflow type: weekly (from WEEKLY_DIR) or game-release (`workflow: "game-release"`)
    - game-release only: mode (new | version), version, repoPath, targets, skippedGates
```

### Step 3: Apply Filters

```yaml
IF --running:
  FILTER where currentPhase NOT IN ['completed', 'aborted']
  (game-release runs with status 'awaiting_merge' count as running and show "awaiting merge")

IF --failed:
  FILTER where currentPhase == 'aborted' OR errors.length > 0

IF --completed:
  FILTER where currentPhase == 'completed'

IF --since:
  FILTER where startedAt >= {since_date}
```

### Step 4: Display Results

---

## Output Format

### List View (Default)

```
## Workflow History

| ID | Game | Status | Phase | Duration | Date |
|----|------|--------|-------|----------|------|
| 2026-03-18-143022 | Emoji Match | completed | post-release | 52m | Mar 18 |
| 2026-03-17-091534 | Word Stack | aborted | review | 23m | Mar 17 |
| 2026-03-15-160012 | Puzzle Rush | completed | post-release | 67m | Mar 15 |

Showing 3 of 3 workflows.

### Quick Actions
- View details: `/workflow-status <id>`
- Resume failed: `/weekly-game-release --resume <id>` (WA only), or `/game-release --resume <gr-id>`
  for standalone runs (add `--merge` to merge an awaiting PR, then tag and release)
- Show failed only: `/workflow-status --failed`
```

### Detail View (Specific Workflow)

```
## Workflow: 2026-03-18-143022

**Status**: completed
**Game**: Emoji Match
**Started**: 2026-03-18 14:30:22
**Completed**: 2026-03-18 15:22:45
**Duration**: 52 minutes

---

### Phase Summary

| Phase | Status | Duration | Key Output |
|-------|--------|----------|------------|
| Scout | completed | 8m | Selected "Emoji Match" (score: 8.2) |
| Design | completed | 12m | PRD generated |
| Build | completed | 15m | 4 files created |
| Review | completed | 6m | Score: 24/30 (1 iteration) |
| QA | completed | 8m | 0 critical, 2 medium (deferred) |
| Security | completed | 3m | All checks passed |
| PR | completed | 2m | PR #47 merged |
| Post-Release | completed | 1m | Release notes saved |

---

### Artifacts

| Type | Location |
|------|----------|
| Scout Report | ~/Documents/weekly-games/casual-scout-march-2026.md |
| PRD | ~/Documents/weekly-games/emoji-match-prd.md |
| Release Notes | ~/Documents/weekly-games/releases/emoji-match-release-notes.md |
| Workflow State | ~/Documents/weekly-games/workflows/2026-03-18-143022.json |

---

### Metrics

| Metric | Value |
|--------|-------|
| Review Iterations | 1 |
| QA Iterations | 1 |
| Bugs Found | 4 |
| Bugs Fixed | 2 |
| Bugs Deferred | 2 |
| Review Score | 24/30 |
| Security Risks | 0 accepted |

---

### GitHub Links

- **PR**: https://github.com/user/weekly-arcade/pull/47
- **Deferred Issues**:
  - #48: [emoji-match] Animation stutters on older devices
  - #49: [emoji-match] Sound delay on first play

---

### Confirmations Log

| Time | Operation | Response |
|------|-----------|----------|
| 14:45:12 | Modify index.html | Approved |
| 14:45:18 | Modify sitemap.xml | Approved |
| 15:18:34 | Push to origin | Approved |
| 15:20:01 | Merge PR #47 | Approved |

---

### Commands

Resume (if applicable):
\`\`\`bash
/weekly-game-release --resume 2026-03-18-143022
\`\`\`

View full state:
\`\`\`bash
cat ~/Documents/weekly-games/workflows/2026-03-18-143022.json | jq
\`\`\`
```

### Failed Workflow View

```
## Workflow: 2026-03-17-091534 (FAILED)

**Status**: aborted
**Game**: Word Stack
**Started**: 2026-03-17 09:15:34
**Aborted**: 2026-03-17 09:38:12
**Duration**: 23 minutes

---

### Failure Details

**Failed Phase**: review
**Iteration**: 3 of 3
**Reason**: Code review score 12/30 below minimum threshold (15)

---

### Error Log

```
[09:35:22] [review] [ERROR] Score 14/30 - below threshold
[09:36:45] [review] [ERROR] Score 13/30 - below threshold
[09:38:10] [review] [ERROR] Score 12/30 - aborting after max iterations
[09:38:12] [review] [ABORT] Review score too low after 3 iterations
```

---

### Rollback Status

- Local branch: deleted
- Remote branch: not pushed
- PR: not created
- Issues: none created

---

### Recovery Options

1. **Resume with fixes**: Make manual improvements, then:
   ```bash
   /weekly-game-release --resume 2026-03-17-091534
   ```

2. **Start fresh**: Abandon this workflow:
   ```bash
   /weekly-game-release --skip-scout --game "Word Stack"
   ```

3. **Investigate**: View detailed review feedback:
   ```bash
   cat ~/Documents/weekly-games/workflows/2026-03-17-091534.json | jq '.review'
   ```
```

---

## JSON Output (--json)

```json
{
  "workflows": [
    {
      "id": "2026-03-18-143022",
      "game": "Emoji Match",
      "status": "completed",
      "currentPhase": "post-release",
      "startedAt": "2026-03-18T14:30:22Z",
      "completedAt": "2026-03-18T15:22:45Z",
      "duration": 3143000,
      "metrics": {
        "reviewScore": 24,
        "reviewIterations": 1,
        "qaIterations": 1,
        "bugsFound": 4,
        "bugsFixed": 2,
        "bugsDeferred": 2
      },
      "artifacts": {
        "prd": "~/Documents/weekly-games/emoji-match-prd.md",
        "releaseNotes": "~/Documents/weekly-games/releases/emoji-match-release-notes.md"
      },
      "github": {
        "pr": 47,
        "issues": [48, 49]
      }
    }
  ],
  "total": 1,
  "filtered": 1
}
```

---

## Notes

- Workflow state files are preserved indefinitely
- Use `--resume` only on failed workflows
- Completed workflows cannot be resumed
- Running workflows show real-time phase
