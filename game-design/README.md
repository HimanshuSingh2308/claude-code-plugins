# Game Design Plugin

A comprehensive Claude Code plugin for game design workflows, featuring autonomous release orchestration, game lifecycle management, quality assurance, and analytics.

## Quick Start

```bash
# Run autonomous weekly release (recommended: dry-run first)
/weekly-game-release --dry-run

# Execute the release
/weekly-game-release --execute

# Check game health
/game-status --all
```

---

## Commands

### Orchestration

| Command | Description |
|---------|-------------|
| `/weekly-game-release` | Autonomous end-to-end weekly game release |
| `/workflow-status` | View history and status of orchestrator runs |

### Game Lifecycle

| Command | Description |
|---------|-------------|
| `/game-clone` | Clone existing game as template for variations |
| `/game-retire` | Safely archive/sunset old games |

### Operations

| Command | Description |
|---------|-------------|
| `/game-status` | Check health of deployed games |
| `/game-audit` | Run all quality agents on any game |
| `/game-hotfix` | Emergency fixes with enhanced safety |
| `/game-rollback` | Revert recent deployments |

### Analytics

| Command | Description |
|---------|-------------|
| `/game-analytics` | View performance metrics and stats |

---

## Command Details

### `/weekly-game-release`

**Flagship feature** - Autonomous orchestration of the entire weekly game release workflow.

```bash
/weekly-game-release [options]

Options:
  --dry-run              Preview all operations
  --execute              Execute workflow (default)
  --resume <id>          Resume failed workflow
  --skip-scout           Use provided concept
  --game "<concept>"     Specify game concept
  --no-merge             Create PR only
  --verbose              Detailed logging
```

**Workflow Phases**:
1. Scout - Research trends, select best concept
2. Design - Generate complete PRD
3. Build - Implement game with integrations
4. Review - Code quality loop (target: 20/30)
5. QA - Bug testing loop (fix CRITICAL/HIGH)
6. Security - Leaderboard validation
7. PR & Merge - Create and merge PR
8. Post-Release - Release notes, metrics

---

### `/game-status`

Monitor health of deployed games.

```bash
/game-status [<game-slug> | --all] [--verbose] [--watch]
```

Shows: Runtime errors, loading issues, recent activity, open bugs.

---

### `/game-audit`

Run comprehensive quality audit on any game.

```bash
/game-audit <game-slug> [--review-only | --qa-only | --security-only | --fix]
```

Invokes: `game-code-reviewer`, `game-qa-tester`, `leaderboard-validator`

---

### `/game-hotfix`

Emergency fixes with enhanced safety guardrails.

```bash
/game-hotfix <game-slug> [--issue <number> | --description "<bug>"]
```

Features: Minimal change principle, extra confirmations, automatic rollback prep.

---

### `/game-rollback`

Revert recent game deployments.

```bash
/game-rollback <game-slug> [--to <commit> | --pr <number>] [--dry-run]
```

Features: Creates backup before rollback, generates rollback PR, preserves history.

---

### `/game-clone`

Clone existing game as template.

```bash
/game-clone <source-game> <new-slug> [--strip-content | --keep-scores]
```

Modes: Standard clone, template (stripped), A/B test (shared leaderboard).

---

### `/game-retire`

Safely sunset games without breaking links.

```bash
/game-retire <game-slug> [--archive | --hide | --redirect <new-game>]
```

Options: Archive (keep playable), Hide (show message), Redirect (to replacement).

---

### `/workflow-status`

View orchestrator run history.

```bash
/workflow-status [<id> | --running | --failed | --completed]
```

Shows: Phase progress, duration, metrics, artifacts, error logs.

---

### `/game-analytics`

View game performance metrics.

```bash
/game-analytics <game-slug> [--period <7d|30d|90d>] [--compare <other>]
```

Shows: Plays, players, scores, retention, engagement trends.

---

## Safety Guardrails

All commands enforce safety rules:

| Category | Behavior |
|----------|----------|
| Database ops | BLOCKED |
| Force push | BLOCKED |
| Modify existing games | BLOCKED |
| Modify shared code | BLOCKED |
| Delete outside game folder | CONFIRM |
| Modify integration files | CONFIRM |
| Git push | CONFIRM |
| Merge PR | CONFIRM |
| Create in new game folder | SAFE |
| Read operations | SAFE |
| Build/test | SAFE |

---

## Skills

### Design Skills
- `/game-design:game-design-prd` - Create complete PRDs
- `/game-design:game-trend-scout` - Research trending games
- `/game-design:add-new-game` - Integrate games into monorepo

### Knowledge Skills
- `/game-design:mobile-game-ux` - Mobile UX patterns
- `/game-design:animation-patterns` - Animation best practices
- `/game-design:sound-design` - Audio implementation
- `/game-design:performance-tuning` - Optimization patterns
- `/game-design:game-balancing` - Balance tuning
- `/game-design:orchestrator-guardrails` - Safety rules

---

## Agents

| Agent | Purpose | Output |
|-------|---------|--------|
| `game-code-reviewer` | Code quality analysis | Score /30 + issues |
| `game-qa-tester` | Bug and UX testing | Bug reports by severity |
| `leaderboard-validator` | Security validation | Risk assessment |
| `weekly-release-orchestrator` | Workflow orchestration | Release artifacts |

---

## Installation

```bash
# Via marketplace
/plugin marketplace add HimanshuSingh2308/claude-code-plugins
/plugin install game-design@hplugins

# Or local development
claude --plugin-dir ./game-design
```

---

## Usage Examples

### Full Release Workflow
```bash
/weekly-game-release --dry-run     # Preview
/weekly-game-release --execute     # Execute
/weekly-game-release --resume <id> # Resume failed
```

### Game Operations
```bash
/game-status --all                 # Check all games
/game-audit emoji-match            # Full audit
/game-hotfix word-stack --issue 42 # Emergency fix
/game-rollback puzzle-rush         # Revert release
```

### Game Lifecycle
```bash
/game-clone emoji-match emoji-v2   # Create variation
/game-retire old-game --archive    # Sunset game
```

### Analytics
```bash
/game-analytics emoji-match --period 30d
/game-analytics all --period 7d
```

---

## Output Locations

| Artifact | Location |
|----------|----------|
| Scout Reports | `~/Documents/weekly-games/{topic}-scout-{month}-{year}.md` |
| PRD Documents | `~/Documents/weekly-games/{game-slug}-prd.md` |
| Release Notes | `~/Documents/weekly-games/releases/{slug}-release-notes.md` |
| Workflow State | `~/Documents/weekly-games/workflows/{id}.json` |
| Audit Reports | `~/Documents/weekly-games/audits/{slug}-audit-{date}.md` |
| Hotfix Logs | `~/Documents/weekly-games/hotfixes/` |
| Rollback Records | `~/Documents/weekly-games/rollbacks/` |
| Retired Games | `~/Documents/weekly-games/retired/{slug}/` |

---

## Version History

### v2.1.0
- Added `/game-status` - Health monitoring
- Added `/game-audit` - Comprehensive quality audits
- Added `/game-hotfix` - Emergency fixes with safety
- Added `/game-rollback` - Deployment recovery
- Added `/game-clone` - Game templating
- Added `/game-retire` - Game lifecycle management
- Added `/workflow-status` - Orchestrator history
- Added `/game-analytics` - Performance metrics

### v2.0.0
- Added `/weekly-game-release` autonomous orchestrator
- Added `orchestrator-guardrails` skill
- Added `weekly-release-orchestrator` agent
- Added safety guardrails system
- Added dry-run mode
- Added workflow state persistence and resume

### v1.1.0
- Added `leaderboard-validator` agent
- Added knowledge skills (mobile-ux, animations, sound, performance)

### v1.0.0
- Initial release with core skills and agents

---

## License

MIT
