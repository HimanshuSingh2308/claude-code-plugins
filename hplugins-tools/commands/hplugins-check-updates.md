---
description: Check if hplugins updates are available without applying them
argument-hint: [--verbose]
---

# HPlugins Check Updates

Check if updates are available for hplugins without applying them.

**Arguments**: $ARGUMENTS

## Workflow

### Step 1: Fetch Latest Info

```bash
cd ~/.claude/plugins/marketplaces/hplugins && git fetch origin main --depth 1
```

### Step 2: Compare Versions

Get current local version:
```bash
cd ~/.claude/plugins/marketplaces/hplugins && git log -1 --format="%h %ci"
```

Get remote version:
```bash
cd ~/.claude/plugins/marketplaces/hplugins && git log origin/main -1 --format="%h %ci"
```

Count commits behind:
```bash
cd ~/.claude/plugins/marketplaces/hplugins && git rev-list HEAD..origin/main --count
```

### Step 3: List Pending Changes

If updates available, show what changed:

```bash
cd ~/.claude/plugins/marketplaces/hplugins && git log HEAD..origin/main --oneline
```

With `--verbose`, show detailed diff:
```bash
cd ~/.claude/plugins/marketplaces/hplugins && git diff --stat HEAD..origin/main
```

### Step 4: Categorize Changes

Parse the changed files to categorize:

**New Plugins**:
- Check for new directories with `.claude-plugin/plugin.json`

**New Commands**:
- Files added to `*/commands/*.md`

**New Skills**:
- Directories added to `*/skills/`

**New Agents**:
- Files added to `*/agents/*.md`

**Modified Files**:
- Existing files that changed

### Step 5: Present Results

#### If No Updates Available:

```
## HPlugins Update Check

**Status**: Up to date
**Current Version**: abc1234 (2026-03-18 14:30:00)
**Remote Version**: abc1234 (2026-03-18 14:30:00)

No updates available. Your plugins are current!
```

#### If Updates Available:

```
## HPlugins Update Check

**Status**: Updates available
**Current Version**: abc1234 (2026-03-17 10:00:00)
**Remote Version**: def5678 (2026-03-18 14:30:00)
**Commits Behind**: 3

### Pending Changes

| Type | Count | Details |
|------|-------|---------|
| New Commands | 2 | /new-project, /hplugins-config |
| Modified Commands | 1 | /load-project |
| New Skills | 1 | auto-update |
| New Plugins | 0 | - |

### Commit History

- `def5678` feat: add auto-update functionality (2 hours ago)
- `cde4567` fix: load-project path resolution (5 hours ago)
- `bcd3456` feat: add new-project scaffolding (yesterday)

### To Apply Updates

Run: `/hplugins-sync`

Or with force (discard local changes): `/hplugins-sync --force`
```

### Step 6: Check Auto-Update Status

If auto-update is configured, remind user:

```
### Auto-Update Status

Auto-update is **enabled** with **notify only** mode.
Updates will be checked daily but not applied automatically.

To change: `/hplugins-config`
```

## Verbose Mode

With `--verbose`, also show:
- Full file diff for each changed file
- Detailed commit messages
- Author information
- Breaking change warnings (if detected)

## Exit Codes (for scripting)

When running programmatically:
- 0: No updates available
- 1: Updates available
- 2: Error checking updates
