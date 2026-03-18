---
description: Revert a recent game deployment - emergency recovery with safety checks
argument-hint: <game-slug> [--to <commit> | --pr <number>] [--dry-run]
---

# Game Rollback

Emergency rollback of a recently deployed game to a previous working state.

**Arguments**: $ARGUMENTS

## Overview

Use this command when:
- A new release breaks the game
- Critical bugs discovered post-merge
- Need to quickly restore previous version
- Hotfix made things worse

**Safety Features**:
- Creates backup before rollback
- Requires explicit confirmation
- Generates rollback PR for review
- Preserves rollback history

## Command Options

```
/game-rollback <game-slug> [options]

Arguments:
  <game-slug>              Game to rollback

Options:
  --to <commit>            Rollback to specific commit
  --pr <number>            Rollback the changes from specific PR
  --steps <n>              Rollback n releases (default: 1)
  --dry-run                Preview rollback without applying
  --force                  Skip PR, direct push (dangerous)
  --preserve-scores        Don't rollback leaderboard changes
```

## Usage Examples

### Rollback Last Release
```bash
/game-rollback emoji-match
```

### Rollback Specific PR
```bash
/game-rollback word-stack --pr 47
```

### Rollback to Commit
```bash
/game-rollback puzzle-rush --to abc123f
```

### Preview First
```bash
/game-rollback memory-cards --dry-run
```

---

## Workflow

### Step 1: Identify Rollback Target

```yaml
IF --pr specified:
  FIND merge commit for PR #{number}
  VERIFY PR affected the specified game

IF --to specified:
  VERIFY commit exists
  VERIFY commit contains game files

IF --steps specified:
  FIND last n release commits for game
  SELECT oldest as target

DEFAULT (no option):
  FIND most recent commit that modified game
  Use parent commit as target
```

### Step 2: Analyze Impact

```yaml
Current state:
  - List files in games/{game-slug}/
  - Get current commit hash

Target state:
  - List files at target commit
  - Identify differences

Impact analysis:
  - Files to revert
  - Files to delete (if added after target)
  - Files to restore (if deleted after target)
  - Integration file changes (index.html, etc.)
```

### Step 3: Pre-Rollback Checks

```yaml
Verify:
  - Main branch is clean
  - No pending PRs for this game
  - User has push permissions
  - Target commit is valid

Confirm game identification:
  SHOW: "Rolling back {game-name} from {current} to {target}"
  SHOW: Files affected
  CONFIRM: "Proceed with rollback? [Y/n]"
```

### Step 4: Create Backup

```bash
# Create backup branch before rollback
git checkout main
git checkout -b backup/game-{slug}-{timestamp}
git push origin backup/game-{slug}-{timestamp}

LOG: "Backup created: backup/game-{slug}-{timestamp}"
```

### Step 5: Execute Rollback

```yaml
Option A: PR-based (default, safer)

  1. Create rollback branch:
     git checkout -b rollback/game-{slug}-{timestamp}

  2. Revert changes:
     git revert {commit_range} --no-commit
     # OR
     git checkout {target_commit} -- apps/web/src/games/{slug}/

  3. Handle integration files:
     IF index.html/sitemap affected:
       SHOW diff
       CONFIRM: "Revert integration files too? [Y/n]"

  4. Commit:
     git commit -m "revert({slug}): Rollback to {target_short}"

  5. Push and create PR:
     git push origin rollback/game-{slug}-{timestamp}
     gh pr create --title "revert({slug}): Emergency rollback"

  6. Await merge:
     SHOW: "PR created: {url}"
     SHOW: "Review and merge to complete rollback"


Option B: Direct push (--force, dangerous)

  CONFIRM: "Direct push will immediately affect production. Are you sure? [Y/n]"
  CONFIRM: "Type 'ROLLBACK' to confirm: "

  IF confirmed:
    git checkout main
    git revert {commit_range}
    git push origin main

    LOG: "Rollback pushed directly to main"
```

### Step 6: Verify Rollback

```yaml
After merge/push:
  1. Verify game loads
  2. Check game functionality
  3. Verify leaderboard works
  4. Confirm no console errors

Report:
  "Rollback complete. Game restored to {target_commit}"
```

---

## Rollback Scenarios

### Scenario 1: Last Release Broke the Game

```bash
/game-rollback emoji-match

# Output:
Rolling back: emoji-match
Current: abc123f (feat: Add new levels - Mar 18)
Target:  def456a (previous working state - Mar 11)

Files to revert:
  - apps/web/src/games/emoji-match/index.html

Integration files:
  - apps/web/src/index.html (game card update)
  - apps/web/src/sitemap.xml (entry added)

Proceed with rollback? [Y/n]
```

### Scenario 2: Hotfix Made Things Worse

```bash
/game-rollback word-stack --pr 52

# Output:
Rolling back PR #52: "hotfix(word-stack): Fix score bug"
Merge commit: ghi789b
Changes in PR:
  - Modified: games/word-stack/index.html (+15/-8 lines)

This will revert the hotfix changes only.
Proceed? [Y/n]
```

### Scenario 3: Rollback Multiple Releases

```bash
/game-rollback puzzle-rush --steps 3

# Output:
Rolling back 3 releases for puzzle-rush:

1. jkl012c - feat: Add power-ups (Mar 17)
2. mno345d - feat: Add sound effects (Mar 15)
3. pqr678e - feat: Add leaderboard (Mar 12)

Target: stu901f (Initial release - Mar 10)

Warning: This is a significant rollback.
Proceed? [Y/n]
```

---

## Integration File Handling

When rollback affects integration files:

```yaml
index.html:
  - Game card may need removal/update
  - "New" badge may need adjustment
  - JSON-LD entry may need update

sitemap.xml:
  - URL entry may need removal

leaderboard/index.html:
  - GAMES array entry may need removal

Options:
  1. Revert integration files too (full rollback)
  2. Keep integration files (game hidden but entry remains)
  3. Manual adjustment (edit specific lines)
```

---

## Dry Run Output

```
## Rollback Preview (Dry Run)

**Game**: emoji-match
**Current**: abc123f (Mar 18, 14:30)
**Target**: def456a (Mar 11, 10:15)

---

### Changes to Revert

| File | Action | Lines |
|------|--------|-------|
| games/emoji-match/index.html | REVERT | -234/+189 |
| index.html | REVERT | -15/+0 |
| sitemap.xml | REVERT | -1/+0 |

### Git Operations (would execute)

```bash
git checkout -b rollback/emoji-match-20260318-143500
git revert abc123f --no-commit
git commit -m "revert(emoji-match): Rollback to def456a"
git push origin rollback/emoji-match-20260318-143500
gh pr create --title "revert(emoji-match): Emergency rollback"
```

---

To execute: `/game-rollback emoji-match`
```

---

## Safety Guardrails

### Blocked Operations

```yaml
BLOCKED:
  - Rollback to commit before game existed
  - Rollback affecting other games
  - Direct push without explicit --force
  - Rollback during active workflow
```

### Required Confirmations

```yaml
Always confirm:
  - "Proceed with rollback?"
  - Integration file changes
  - Force push (if --force)

Double confirm for --force:
  - Standard confirmation
  - Type "ROLLBACK" to proceed
```

### Automatic Backup

Every rollback creates a backup branch:
```
backup/game-{slug}-{timestamp}
```

To restore from backup:
```bash
git checkout backup/game-emoji-match-20260318-143500
```

---

## Rollback History

All rollbacks are logged:

```json
{
  "id": "rollback-{slug}-{timestamp}",
  "game": "{slug}",
  "fromCommit": "{current}",
  "toCommit": "{target}",
  "reason": "{pr_number or manual}",
  "method": "pr|direct",
  "prNumber": {n},
  "backupBranch": "backup/game-{slug}-{timestamp}",
  "executedAt": "{iso_date}",
  "executedBy": "{user}"
}
```

Location: `~/Documents/weekly-games/rollbacks/`

---

## Recovery from Failed Rollback

If rollback itself fails:

```yaml
1. Check backup branch exists:
   git branch -a | grep backup/game-{slug}

2. Restore from backup:
   git checkout main
   git reset --hard backup/game-{slug}-{timestamp}
   git push origin main --force  # Requires confirmation

3. Or create recovery PR:
   git checkout -b recover/game-{slug}
   git cherry-pick backup/game-{slug}-{timestamp}
   git push && gh pr create
```

---

## Notes

- Always use dry-run first for complex rollbacks
- PR-based rollback is safer (allows review)
- Direct push only for true emergencies
- Backup branches kept for 30 days
- Consider `/game-hotfix` if fix is simple
