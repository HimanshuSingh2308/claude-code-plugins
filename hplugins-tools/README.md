# HPlugins Tools

Marketplace management tools for hplugins - auto-update, sync, status checking, and configuration management.

## Commands

| Command | Description |
|---------|-------------|
| `/hplugins-sync` | Update all plugins to latest version from GitHub |
| `/hplugins-status` | Show installed plugins, commands, and detect overrides |
| `/hplugins-check-updates` | Check if updates are available (without applying) |
| `/hplugins-config` | Configure auto-update and other settings |

## Quick Start

```bash
# Check current status
/hplugins-status

# Check for updates
/hplugins-check-updates

# Apply updates
/hplugins-sync

# Enable auto-update
/hplugins-config autoUpdate.enabled true
```

## Auto-Update Configuration

Create or edit `~/.claude/hplugins-config.json`:

```json
{
  "autoUpdate": {
    "enabled": true,
    "checkInterval": "weekly",
    "autoApply": false,
    "notifyOnly": true
  }
}
```

### Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `autoUpdate.enabled` | boolean | false | Enable automatic update checks |
| `autoUpdate.checkInterval` | string | "weekly" | Check frequency: daily, weekly, manual |
| `autoUpdate.autoApply` | boolean | false | Auto-apply updates (use with caution) |
| `autoUpdate.notifyOnly` | boolean | true | Only notify about updates |

## Command Details

### /hplugins-sync

Update all plugins from the GitHub repository.

```bash
# Normal update
/hplugins-sync

# Preview changes without applying
/hplugins-sync --dry-run

# Force update (discard local changes)
/hplugins-sync --force
```

### /hplugins-status

Show comprehensive status of installed plugins.

Output includes:
- Installed plugins with version
- Available commands, skills, and agents
- Local overrides detected
- Auto-update configuration

### /hplugins-check-updates

Check if updates are available without applying them.

```bash
# Quick check
/hplugins-check-updates

# Detailed check with file changes
/hplugins-check-updates --verbose
```

### /hplugins-config

Configure plugin settings.

```bash
# Show all settings
/hplugins-config

# Show specific setting
/hplugins-config autoUpdate.enabled

# Change a setting
/hplugins-config autoUpdate.enabled true
/hplugins-config autoUpdate.checkInterval daily

# Reset to defaults
/hplugins-config --reset
```

## How Updates Work

1. **Fetch**: Download latest changes from GitHub (`git fetch`)
2. **Compare**: Check if local is behind remote
3. **Preview**: Show what files will change
4. **Apply**: Reset to remote version (`git reset --hard`)
5. **Verify**: Confirm update succeeded

## Local Overrides

If you have local customizations in your project's `.claude/` directory, they will shadow global plugins. The status command detects these:

- **IDENTICAL**: Local matches global (can be removed)
- **OVERRIDE**: Local differs from global (active override)

## Troubleshooting

### "Not a git repository"

The plugins directory may be corrupted. Re-install:

```bash
rm -rf ~/.claude/plugins/marketplaces/hplugins
git clone --depth 1 https://github.com/HimanshuSingh2308/claude-code-plugins ~/.claude/plugins/marketplaces/hplugins
```

### "Local changes would be overwritten"

You have uncommitted changes. Options:
- Use `/hplugins-sync --force` to discard changes
- Manually stash changes: `cd ~/.claude/plugins/marketplaces/hplugins && git stash`

### Updates not showing

Try fetching manually:
```bash
cd ~/.claude/plugins/marketplaces/hplugins && git fetch origin main
```

## Security

- **Auto-apply is disabled by default** for safety
- Always review changes with `--dry-run` first
- Only sync from trusted repositories

## License

MIT
