---
description: Configure auto-update and other hplugins settings
argument-hint: [setting] [value]
---

# HPlugins Config

Configure auto-update and other settings for hplugins.

**Arguments**: $ARGUMENTS

## Workflow

### Step 1: Load Current Configuration

Read config from `~/.claude/hplugins-config.json`:

```bash
cat ~/.claude/hplugins-config.json 2>/dev/null || echo "{}"
```

Default configuration:
```json
{
  "autoUpdate": {
    "enabled": false,
    "checkInterval": "weekly",
    "autoApply": false,
    "notifyOnly": true,
    "lastCheck": null
  },
  "preferences": {
    "verboseOutput": false,
    "showChangelogOnUpdate": true
  }
}
```

### Step 2: Process Arguments

#### No Arguments - Show Current Config

Display current settings in a readable format:

```
## HPlugins Configuration

### Auto-Update Settings
| Setting | Value | Description |
|---------|-------|-------------|
| enabled | false | Check for updates automatically |
| checkInterval | weekly | How often to check (daily/weekly/manual) |
| autoApply | false | Apply updates automatically |
| notifyOnly | true | Only notify, don't auto-apply |
| lastCheck | never | Last time updates were checked |

### Preferences
| Setting | Value | Description |
|---------|-------|-------------|
| verboseOutput | false | Show detailed output |
| showChangelogOnUpdate | true | Display changelog after updates |

### Config File Location
~/.claude/hplugins-config.json

### Quick Commands
- Enable auto-update: `/hplugins-config autoUpdate.enabled true`
- Set daily checks: `/hplugins-config autoUpdate.checkInterval daily`
- Enable auto-apply: `/hplugins-config autoUpdate.autoApply true`
```

#### Single Argument - Show Specific Setting

If argument is a setting path (e.g., `autoUpdate.enabled`):
- Display current value
- Show description
- Show valid options

#### Two Arguments - Update Setting

If two arguments provided (setting and value):

1. Validate the setting path exists
2. Validate the value is appropriate:
   - `enabled`: boolean (true/false)
   - `checkInterval`: string (daily/weekly/manual)
   - `autoApply`: boolean (true/false)
   - `notifyOnly`: boolean (true/false)
   - `verboseOutput`: boolean (true/false)
   - `showChangelogOnUpdate`: boolean (true/false)

3. Update the config file
4. Confirm the change

### Step 3: Interactive Mode

If called without arguments and user wants to configure:

Present options:
```
What would you like to configure?

1. Enable auto-update checks
2. Set check interval (daily/weekly/manual)
3. Enable auto-apply updates
4. Configure notifications
5. Reset to defaults
6. View current config

Enter choice (1-6):
```

### Step 4: Save Configuration

Write updated config to `~/.claude/hplugins-config.json`:

```bash
echo '$CONFIG_JSON' > ~/.claude/hplugins-config.json
```

### Step 5: Confirm Changes

```
## Configuration Updated

**Changed**: autoUpdate.enabled
**Old Value**: false
**New Value**: true

Auto-update checks are now enabled. Updates will be checked weekly.

To apply pending updates: `/hplugins-sync`
```

## Available Settings

### autoUpdate.enabled
- **Type**: boolean
- **Default**: false
- **Description**: Enable automatic update checking

### autoUpdate.checkInterval
- **Type**: string
- **Options**: "daily", "weekly", "manual"
- **Default**: "weekly"
- **Description**: How often to check for updates

### autoUpdate.autoApply
- **Type**: boolean
- **Default**: false
- **Description**: Automatically apply updates when found (use with caution)

### autoUpdate.notifyOnly
- **Type**: boolean
- **Default**: true
- **Description**: Only notify about updates, don't apply automatically

### preferences.verboseOutput
- **Type**: boolean
- **Default**: false
- **Description**: Show detailed output for all commands

### preferences.showChangelogOnUpdate
- **Type**: boolean
- **Default**: true
- **Description**: Display changelog after applying updates

## Examples

```bash
# Enable auto-update
/hplugins-config autoUpdate.enabled true

# Check daily
/hplugins-config autoUpdate.checkInterval daily

# Enable auto-apply (careful!)
/hplugins-config autoUpdate.autoApply true

# Reset to defaults
/hplugins-config --reset

# View all settings
/hplugins-config
```

## Security Note

When `autoApply` is enabled, updates from the repository will be applied automatically. Only enable this if you trust the repository source completely.
