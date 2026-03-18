---
description: Check health and status of deployed games - errors, uptime, recent issues
argument-hint: [<game-slug> | --all] [--verbose]
---

# Game Status

Check the health and operational status of deployed games.

**Arguments**: $ARGUMENTS

## Overview

Monitor deployed games for:
- Runtime errors and crashes
- Loading/performance issues
- Recent bug reports
- Leaderboard connectivity
- Asset availability

## Command Options

```
/game-status [options]

Arguments:
  <game-slug>              Check specific game status
  --all                    Check all games (default if no argument)

Options:
  --verbose                Show detailed diagnostics
  --check-assets           Verify all assets load correctly
  --check-leaderboard      Test leaderboard API connectivity
  --watch                  Continuous monitoring (refresh every 30s)
```

## Usage Examples

### Check All Games
```bash
/game-status
```

### Check Specific Game
```bash
/game-status emoji-match
```

### Detailed Diagnostics
```bash
/game-status word-stack --verbose
```

### Continuous Monitoring
```bash
/game-status --all --watch
```

---

## Workflow

### Step 1: Enumerate Games

```bash
# List all deployed games
ls apps/web/src/games/

# Get game metadata from each index.html
FOR each game:
  EXTRACT: title, description, theme-color
```

### Step 2: Health Checks

```yaml
For each game, verify:

1. File Integrity:
   - index.html exists and is valid HTML
   - All script references resolve
   - All CSS references resolve

2. Asset Availability:
   - Images load (if any)
   - Audio files accessible (if any)
   - Fonts load correctly

3. JavaScript Health:
   - No syntax errors
   - Required functions defined
   - Event listeners attached

4. API Connectivity:
   - api-client.js loaded
   - auth.js loaded
   - Leaderboard API reachable

5. Recent Issues:
   - Open GitHub issues for this game
   - Recent error reports
   - User complaints
```

### Step 3: Generate Status Report

---

## Output Format

### Overview (All Games)

```
## Game Status Overview

**Checked**: 8 games
**Timestamp**: 2026-03-18 14:30:22

---

### Health Summary

| Status | Count | Games |
|--------|-------|-------|
| Healthy | 6 | emoji-match, word-stack, puzzle-rush, tetris, color-match, snake |
| Warning | 1 | number-crunch |
| Critical | 1 | memory-cards |

---

### Status by Game

| Game | Status | Issues | Last Activity |
|------|--------|--------|---------------|
| emoji-match | HEALTHY | 0 | 2 min ago |
| word-stack | HEALTHY | 0 | 5 min ago |
| puzzle-rush | HEALTHY | 1 open | 8 min ago |
| tetris-clone | HEALTHY | 0 | 12 min ago |
| number-crunch | WARNING | 2 open | 1 hour ago |
| color-match | HEALTHY | 0 | 3 min ago |
| memory-cards | CRITICAL | 3 open | 4 hours ago |
| snake-redux | HEALTHY | 0 | 20 min ago |

---

### Issues Requiring Attention

#### CRITICAL: memory-cards
- Issue #52: Game freezes after level 3
- Issue #53: Score not saving
- Issue #54: Audio not playing on mobile
- **Last Score**: 4 hours ago (unusually quiet)

#### WARNING: number-crunch
- Issue #48: Slow loading on mobile
- Issue #49: Timer display glitch
- **Last Score**: 1 hour ago

---

### Quick Actions

- Investigate critical: `/game-audit memory-cards`
- Apply hotfix: `/game-hotfix memory-cards --issue 52`
- View details: `/game-status memory-cards --verbose`
```

### Single Game (Detailed)

```
## Game Status: Emoji Match

**Status**: HEALTHY
**Checked**: 2026-03-18 14:30:22

---

### Health Checks

| Check | Status | Details |
|-------|--------|---------|
| File Integrity | PASS | index.html valid |
| Scripts | PASS | All 3 scripts loaded |
| Styles | PASS | CSS valid |
| Assets | PASS | 12 images, 7 sounds |
| API Client | PASS | Connected |
| Auth | PASS | Initialized |
| Leaderboard | PASS | 89 entries today |

---

### Recent Activity

**Last 24 Hours**:
- Scores Submitted: 234
- Unique Players: 89
- Errors Reported: 0

**Activity Graph** (hourly):
```
00-04: ██ 12
04-08: █ 8
08-12: ████████ 45
12-16: ██████████████ 78
16-20: ████████████████████ 112
20-24: ██████████ 56
```

---

### Open Issues

No open issues for this game.

---

### Recent Releases

| Date | Type | Description |
|------|------|-------------|
| Mar 11 | Release | Initial deployment |
| Mar 13 | Hotfix | Fixed sound delay |

---

### Performance Metrics

| Metric | Value | Status |
|--------|-------|--------|
| Load Time | 1.2s | GOOD |
| First Paint | 0.4s | GOOD |
| Script Size | 45KB | GOOD |
| Asset Size | 1.2MB | OK |

---

### Diagnostics

```yaml
HTML: Valid (0 warnings)
CSS: Valid (0 warnings)
JS: No syntax errors
Console: No errors in last 24h
Network: All requests successful
```

---

### Quick Actions

- Run audit: `/game-audit emoji-match`
- View analytics: `/game-analytics emoji-match`
- Check workflow: `/workflow-status 2026-03-11-143022`
```

### Verbose Output (--verbose)

```
## Game Status: Emoji Match (Verbose)

### File Structure Verification

```
apps/web/src/games/emoji-match/
├── index.html (45.2 KB) ✓
└── [no subdirectories]

Scripts referenced:
├── ../../js/api-client.js ✓ (exists, 12.3 KB)
├── ../../js/auth.js ✓ (exists, 8.7 KB)
└── [inline script] ✓ (no syntax errors)

Styles referenced:
└── [inline styles] ✓ (valid CSS)
```

### Asset Verification

```
Images: 12 total
├── emoji-happy.svg ✓
├── emoji-sad.svg ✓
├── emoji-angry.svg ✓
├── ... (9 more) ✓

Sounds: 7 total
├── move.mp3 ✓
├── match.mp3 ✓
├── levelup.mp3 ✓
├── ... (4 more) ✓
```

### JavaScript Analysis

```
Functions defined: 24
├── initGame() ✓
├── handleClick() ✓
├── checkMatch() ✓
├── submitScore() ✓
├── ... (20 more) ✓

Event listeners: 8
├── DOMContentLoaded ✓
├── click (game board) ✓
├── authStateChanged ✓
├── ... (5 more) ✓

API integrations:
├── window.apiClient ✓ (defined)
├── window.authManager ✓ (defined)
└── submitScore() ✓ (calls apiClient correctly)
```

### Network Requests (Last 24h)

| Endpoint | Requests | Success | Avg Response |
|----------|----------|---------|--------------|
| /api/scores | 234 | 100% | 145ms |
| /api/auth | 89 | 100% | 98ms |
| /api/leaderboard | 156 | 100% | 178ms |

### Error Log

No errors in the last 24 hours.

### Console Output Sample

```
[INFO] Game initialized
[INFO] Auth state: authenticated
[INFO] Leaderboard loaded: 89 entries
```
```

---

## Watch Mode (--watch)

Continuous monitoring with 30-second refresh:

```
## Game Status Monitor

Press Ctrl+C to exit | Refresh: 30s | Last update: 14:30:22

| Game | Status | Players Now | Last Score | Issues |
|------|--------|-------------|------------|--------|
| emoji-match | ● | 12 | 2s ago | 0 |
| word-stack | ● | 8 | 15s ago | 0 |
| puzzle-rush | ● | 5 | 45s ago | 1 |
| memory-cards | ○ | 0 | 4h ago | 3 |

● = Active  ○ = Inactive  ◐ = Warning  ✕ = Error

[14:30:52] Refreshing...
```

---

## Status Definitions

| Status | Meaning | Criteria |
|--------|---------|----------|
| HEALTHY | Operating normally | No errors, recent activity |
| WARNING | Potential issues | Open bugs or reduced activity |
| CRITICAL | Needs attention | Errors, no activity, or severe bugs |
| UNKNOWN | Cannot determine | Missing data or unreachable |

---

## Notes

- Status checks are read-only (no changes made)
- Watch mode useful during releases
- Combine with `/game-audit` for deeper analysis
- Check after hotfixes to verify fix worked
