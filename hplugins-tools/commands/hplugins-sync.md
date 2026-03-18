---
description: Update all hplugins to the latest version from GitHub
argument-hint: [--force | --dry-run]
---

# HPlugins Sync

Update all globally installed hplugins to the latest version.

**Arguments**: $ARGUMENTS

## Workflow

### Step 1: Pre-flight Checks

1. Verify the marketplace is installed:
   ```bash
   ls ~/.claude/plugins/marketplaces/hplugins/.git
   ```

2. Check current version before update:
   ```bash
   cd ~/.claude/plugins/marketplaces/hplugins && git log -1 --format="%h %ci %s"
   ```

3. Check for local modifications:
   ```bash
   cd ~/.claude/plugins/marketplaces/hplugins && git status --porcelain
   ```

### Step 2: Handle Arguments

- **No argument**: Normal update with confirmation
- **`--force`**: Update without confirmation, discard local changes
- **`--dry-run`**: Show what would be updated without applying

### Step 3: Check for Updates

```bash
cd ~/.claude/plugins/marketplaces/hplugins && git fetch origin main --depth 1
```

Compare local vs remote:
```bash
cd ~/.claude/plugins/marketplaces/hplugins && git log HEAD..origin/main --oneline
```

If no updates available, report "Already up to date" and exit.

### Step 4: Show Pending Changes (if any)

Display what will change:
```bash
cd ~/.claude/plugins/marketplaces/hplugins && git diff --stat HEAD..origin/main
```

List new/modified files:
- New commands added
- New skills added
- Modified files

### Step 5: Apply Update

If not `--dry-run`:
```bash
cd ~/.claude/plugins/marketplaces/hplugins && git reset --hard origin/main
```

### Step 6: Post-Update Verification

1. Verify update succeeded:
   ```bash
   cd ~/.claude/plugins/marketplaces/hplugins && git log -1 --format="%h %ci %s"
   ```

2. List all plugins now available:
   ```bash
   ls -d ~/.claude/plugins/marketplaces/hplugins/*/
   ```

### Step 7: Detect Local Overrides

Check if current project has local overrides that may shadow global plugins:

1. Scan `.claude/commands/` for matching command names
2. Scan `.claude/skills/` for matching skill names
3. Scan `.claude/agents/` for matching agent names

Report any conflicts found.

### Step 8: Summary

Present results:

```
## Sync Complete

**Previous Version**: abc1234 (2026-03-17)
**Current Version**: def5678 (2026-03-18)

### Changes Applied
- Added: /new-project command
- Modified: /load-project command
- Added: project-templates skill

### Plugins Available
| Plugin | Commands | Skills | Agents |
|--------|----------|--------|--------|
| game-design | 3 | 3 | 0 |
| project-manager | 4 | 1 | 0 |
| hplugins-tools | 4 | 1 | 0 |

### Local Overrides Detected
None (or list any found)
```

## Auto-Update Configuration

To enable automatic update checks, create `~/.claude/hplugins-config.json`:

```json
{
  "autoUpdate": {
    "enabled": true,
    "checkInterval": "daily",
    "autoApply": false,
    "notifyOnly": true
  }
}
```

## Error Handling

- **Network error**: Suggest checking internet connection, retry later
- **Git conflict**: Suggest using `--force` to discard local changes
- **Permission denied**: Check file permissions on plugins directory
- **Repository not found**: Suggest reinstalling the marketplace
