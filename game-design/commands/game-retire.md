---
description: Safely archive and retire an old game without breaking links or losing data
argument-hint: <game-slug> [--archive | --hide | --redirect <new-game>]
---

# Game Retire

Safely sunset a game while preserving data and avoiding broken links.

**Arguments**: $ARGUMENTS

## Overview

Use this command to:
- Remove underperforming games
- Sunset seasonal content
- Replace with newer versions
- Clean up test games

**Retirement Options**:
- **Archive**: Keep game playable but hidden from listings
- **Hide**: Remove from listings, show "retired" message
- **Redirect**: Send players to a replacement game

**What's Preserved**:
- Leaderboard data
- Player achievements (if any)
- URL (no broken links)
- Historical analytics

## Command Options

```
/game-retire <game-slug> [options]

Arguments:
  <game-slug>              Game to retire

Options:
  --archive                Keep playable, hide from listings (default)
  --hide                   Show retirement message, disable play
  --redirect <game>        Redirect to replacement game
  --preserve-leaderboard   Keep leaderboard visible
  --delete-leaderboard     Remove leaderboard data (dangerous)
  --reason "<text>"        Retirement reason (for records)
  --effective <date>       Schedule retirement for future date
  --dry-run                Preview changes
```

## Usage Examples

### Archive (Keep Playable)
```bash
/game-retire old-puzzle --archive
```

### Hide with Message
```bash
/game-retire seasonal-game --hide --reason "Seasonal event ended"
```

### Redirect to Replacement
```bash
/game-retire tetris-v1 --redirect tetris-v2
```

### Schedule Future Retirement
```bash
/game-retire holiday-game --hide --effective 2026-01-15
```

---

## Workflow

### Step 1: Validate Game

```yaml
Verify:
  - Game exists
  - Game is currently active
  - Not already retired

Gather info:
  - Current player activity
  - Leaderboard entries
  - Open issues
  - Last release date
```

### Step 2: Pre-Retirement Report

```
## Pre-Retirement Report: {game-name}

**Status**: Active
**Released**: Mar 1, 2026
**Last Activity**: 2 hours ago

### Usage Stats (Last 30 Days)
- Total Plays: 234
- Unique Players: 67
- Average Daily: 8

### Leaderboard
- Total Entries: 1,234
- Top Player: Player_A (score: 12,890)

### Open Issues
- #45: Minor display bug (LOW)

### Recommendation
Activity level: LOW
Suggested action: ARCHIVE (keep accessible for existing players)

Proceed with retirement? [Y/n]
```

### Step 3: Execute Retirement

#### Option A: Archive (--archive)

```yaml
Actions:
  1. Remove from index.html game grid
  2. Remove from sitemap.xml (or mark as low priority)
  3. Keep game files intact
  4. Keep leaderboard entry
  5. Add "archived" meta tag to game

Result:
  - Game still playable via direct URL
  - Not discoverable from homepage
  - Leaderboard still works
  - No broken links
```

#### Option B: Hide (--hide)

```yaml
Actions:
  1. Remove from index.html game grid
  2. Remove from sitemap.xml
  3. Modify game to show retirement message
  4. Keep leaderboard visible (if --preserve-leaderboard)
  5. Disable score submission

Retirement message:
  """
  <div class="retirement-notice">
    <h2>Game Retired</h2>
    <p>{reason}</p>
    <p>This game is no longer available for play.</p>
    <a href="/">Browse other games</a>
  </div>
  """
```

#### Option C: Redirect (--redirect)

```yaml
Actions:
  1. Remove from index.html game grid
  2. Update sitemap.xml with redirect
  3. Replace game content with redirect
  4. Show brief redirect message
  5. Optionally migrate leaderboard

Redirect implementation:
  """
  <script>
    // Show message briefly, then redirect
    setTimeout(() => {
      window.location.href = '/games/{new-game}/';
    }, 3000);
  </script>
  <div class="redirect-notice">
    <h2>This game has moved!</h2>
    <p>Redirecting to {new-game-name}...</p>
    <a href="/games/{new-game}/">Click here if not redirected</a>
  </div>
  """
```

### Step 4: Update Integration Files

```yaml
index.html:
  - Remove game card from grid
  - Remove from JSON-LD ItemList
  - Update total game count

sitemap.xml:
  - Archive: Set priority to 0.1
  - Hide/Redirect: Remove entry or add redirect

leaderboard/index.html:
  - Archive: Keep entry, add "(archived)" label
  - Hide: Remove from active list, keep data
  - Redirect: Optionally migrate to new game
```

### Step 5: Leaderboard Handling

```yaml
Default (--preserve-leaderboard):
  - Keep all leaderboard data
  - Mark as "archived" in leaderboard page
  - Stop accepting new scores

With --delete-leaderboard (requires confirmation):
  CONFIRM: "Delete all leaderboard data for {game}? This cannot be undone."
  CONFIRM: Type 'DELETE LEADERBOARD' to confirm.

  IF confirmed:
    - Remove from GAMES array
    - Archive scores to backup file
    - Log deletion
```

### Step 6: Generate Retirement Record

```json
{
  "game": "{slug}",
  "gameName": "{name}",
  "retiredAt": "2026-03-18T14:30:00Z",
  "method": "archive|hide|redirect",
  "reason": "{reason}",
  "redirectTo": "{new-game or null}",
  "leaderboardPreserved": true,
  "stats": {
    "totalPlays": 5678,
    "totalPlayers": 1234,
    "leaderboardEntries": 4567,
    "topScore": 12890
  },
  "filesModified": [...],
  "backupLocation": "~/Documents/weekly-games/retired/{slug}/"
}
```

---

## Retirement Types Comparison

| Feature | Archive | Hide | Redirect |
|---------|---------|------|----------|
| Game playable | Yes | No | No |
| Shows in listings | No | No | No |
| Direct URL works | Yes (plays) | Yes (message) | Yes (redirects) |
| Leaderboard active | View only | View only | Migrated or view |
| Score submission | Disabled | Disabled | To new game |
| SEO preserved | Partial | No | Yes (via redirect) |

---

## Scheduled Retirement

With `--effective <date>`:

```yaml
Actions now:
  1. Create retirement schedule record
  2. Add warning banner to game (optional)
  3. Log scheduled retirement

On effective date:
  - Automated retirement executes
  - Or reminder to run command manually

Warning banner (optional):
  """
  <div class="sunset-warning">
    This game will be retired on {date}.
    <a href="/games/">Try our other games!</a>
  </div>
  """
```

---

## Backup and Recovery

### Automatic Backup

Before retirement:
```bash
~/Documents/weekly-games/retired/{slug}/
├── index.html.bak          # Original game file
├── leaderboard-export.json # All scores
├── retirement-record.json  # Metadata
└── screenshots/            # Game screenshots
```

### Recovery Command

To restore a retired game:
```bash
/game-restore {slug}
```

Or manually:
```bash
# Restore files
cp ~/Documents/weekly-games/retired/{slug}/index.html.bak \
   apps/web/src/games/{slug}/index.html

# Re-add to integration files manually
```

---

## Guardrails

### Blocked

```yaml
BLOCKED:
  - Retiring non-existent game
  - Retiring already retired game
  - Deleting leaderboard without explicit flag
  - Affecting other games
```

### Confirmations

```yaml
Always confirm:
  - "Retire {game-name}? [Y/n]"
  - Each integration file change

Extra confirmation for:
  - --delete-leaderboard (type confirmation)
  - Games with high recent activity
  - Games less than 7 days old
```

### Activity Warning

```yaml
IF game has > 50 plays in last 7 days:
  WARN: "This game has significant recent activity ({n} plays)."
  WARN: "Consider --archive instead of --hide."
  CONFIRM: "Proceed anyway? [Y/n]"
```

---

## Dry Run Output

```
## Retirement Preview (Dry Run)

**Game**: old-puzzle
**Method**: archive
**Reason**: Low engagement

---

### Changes Summary

| File | Action |
|------|--------|
| games/old-puzzle/index.html | Add archived meta |
| index.html | Remove game card |
| sitemap.xml | Set priority 0.1 |
| leaderboard/index.html | Add "(archived)" label |

### Leaderboard
- Entries preserved: 1,234
- Score submission: Will be disabled
- Visibility: View-only

### Backup Location
~/Documents/weekly-games/retired/old-puzzle/

---

To execute: `/game-retire old-puzzle --archive`
```

---

## Post-Retirement

### Verification Checklist

```yaml
After retirement:
  - [ ] Game removed from homepage grid
  - [ ] Direct URL behaves as expected
  - [ ] Leaderboard shows correct status
  - [ ] No console errors
  - [ ] Backup files created
  - [ ] Retirement logged
```

### Communication (Optional)

```yaml
If game had active players:
  - Consider announcement on social media
  - Add redirect to similar game
  - Thank players for participating
```

---

## Notes

- Archive is safest option (reversible, no broken links)
- Hide for definitive removal but keep URL working
- Redirect when replacing with better version
- Always preserve leaderboard unless specifically needed
- Backups kept indefinitely in retired/ folder
- Consider player communication for popular games
