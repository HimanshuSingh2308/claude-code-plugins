---
name: auto-update
description: >
  Background knowledge for hplugins auto-update system. Applied automatically when
  checking for updates, syncing plugins, or configuring auto-update settings.
  Provides patterns for update detection, version comparison, and safe update application.
---

# HPlugins Auto-Update System

This skill provides background knowledge for the hplugins auto-update functionality.

## Architecture Overview

```
~/.claude/
├── plugins/
│   └── marketplaces/
│       └── hplugins/        # Git repository
│           ├── .git/                # Git metadata
│           ├── .claude-plugin/      # Marketplace config
│           │   └── marketplace.json
│           ├── game-design/         # Plugin
│           ├── project-manager/     # Plugin
│           └── hplugins-tools/      # This plugin
└── hplugins-config.json             # Auto-update configuration
```

## Configuration Schema

Location: `~/.claude/hplugins-config.json`

```json
{
  "version": "1.0",
  "autoUpdate": {
    "enabled": true,
    "checkInterval": "weekly",
    "autoApply": false,
    "notifyOnly": true,
    "lastCheck": "2026-03-18T10:30:00Z",
    "lastUpdate": "2026-03-15T14:00:00Z"
  },
  "preferences": {
    "verboseOutput": false,
    "showChangelogOnUpdate": true,
    "backupBeforeUpdate": true
  },
  "repository": {
    "url": "https://github.com/HimanshuSingh2308/claude-code-plugins",
    "branch": "main",
    "remote": "origin"
  }
}
```

## Update Check Algorithm

### Step 1: Fetch Remote

```bash
git fetch origin main --depth 1
```

### Step 2: Compare Commits

```bash
# Get local HEAD
LOCAL_HEAD=$(git rev-parse HEAD)

# Get remote HEAD
REMOTE_HEAD=$(git rev-parse origin/main)

# Count commits behind
BEHIND=$(git rev-list HEAD..origin/main --count)
```

### Step 3: Determine Update Status

- `BEHIND = 0`: Up to date
- `BEHIND > 0`: Updates available
- `BEHIND < 0`: Local ahead (unusual, may have local commits)

## Safe Update Process

### Pre-Update Checks

1. **Check for local modifications**:
   ```bash
   git status --porcelain
   ```
   If modifications exist:
   - Warn user
   - Require `--force` to proceed
   - Or stash changes

2. **Backup current state** (if configured):
   ```bash
   git stash push -m "hplugins-backup-$(date +%Y%m%d-%H%M%S)"
   ```

3. **Verify remote is reachable**:
   ```bash
   git ls-remote --exit-code origin main
   ```

### Apply Update

```bash
git reset --hard origin/main
```

### Post-Update Verification

1. **Verify HEAD matches remote**:
   ```bash
   [ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ]
   ```

2. **Validate plugin structure**:
   - Check all `plugin.json` files are valid JSON
   - Verify required directories exist

3. **Detect breaking changes**:
   - Check for removed commands
   - Check for renamed files
   - Parse commit messages for "BREAKING:" prefix

## Update Notification System

When updates are available and `notifyOnly` is true:

1. Store notification in `~/.claude/hplugins-notifications.json`:
   ```json
   {
     "pendingUpdates": {
       "detected": "2026-03-18T10:30:00Z",
       "commits": 3,
       "summary": "feat: add new-project command, fix: load-project path"
     }
   }
   ```

2. Display notification at start of session (via skill trigger)

3. Clear notification after update applied

## Version Tracking

Track versions using git commit hashes:

```json
{
  "currentVersion": "abc1234",
  "previousVersions": [
    {"hash": "def5678", "date": "2026-03-17", "note": "Before auto-update"},
    {"hash": "ghi9012", "date": "2026-03-10", "note": "Before manual sync"}
  ]
}
```

## Rollback Capability

If an update causes issues:

1. **Using git stash** (if backup was made):
   ```bash
   git stash pop
   ```

2. **Using git reset** (to specific commit):
   ```bash
   git reset --hard <previous-commit-hash>
   ```

3. **Using reflog** (emergency):
   ```bash
   git reflog
   git reset --hard HEAD@{1}
   ```

## Integration Points

### Session Start Hook

When a Claude Code session starts:

1. Check if auto-update is enabled
2. Check if check interval has passed
3. If yes, run silent update check
4. Display notification if updates available

### Command Execution

Before executing any hplugins command:

1. Verify plugin directory exists
2. Check git repository health
3. Proceed with command

## Error Handling

| Error | Cause | Resolution |
|-------|-------|------------|
| `fatal: not a git repository` | Plugins dir corrupted | Re-clone marketplace |
| `fatal: couldn't find remote ref` | Branch doesn't exist | Check repository URL |
| `error: Your local changes would be overwritten` | Local modifications | Use `--force` or stash |
| `fatal: unable to access` | Network issue | Check internet connection |
| `Permission denied` | File permissions | Fix with `chmod -R u+rwX` |

## Security Considerations

1. **Repository Trust**: Only sync from trusted repositories
2. **Auto-Apply Risk**: Disabled by default for safety
3. **Code Review**: Check diff before applying (`--dry-run`)
4. **Backup**: Enable `backupBeforeUpdate` for safety

## Best Practices

1. Use `--dry-run` first to preview changes
2. Keep `autoApply` disabled unless fully trusted
3. Review changelog after updates
4. Test commands after major updates
5. Report issues to repository maintainer
