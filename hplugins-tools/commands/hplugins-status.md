---
description: Show installed hplugins, available commands, skills, and detect local overrides
---

# HPlugins Status

Show the current state of all installed hplugins.

## Workflow

### Step 1: Check Installation

Verify plugins are installed:
```bash
ls ~/.claude/plugins/marketplaces/hplugins/
```

If not found, suggest installation instructions.

### Step 2: Get Version Info

```bash
cd ~/.claude/plugins/marketplaces/hplugins && git log -1 --format="Commit: %h%nDate: %ci%nMessage: %s"
```

Check if updates are available:
```bash
cd ~/.claude/plugins/marketplaces/hplugins && git fetch origin main --depth 1 2>/dev/null && git log HEAD..origin/main --oneline | wc -l
```

### Step 3: Enumerate Plugins

For each plugin directory (excluding `.git`, `.claude-plugin`):

1. Read `.claude-plugin/plugin.json` for:
   - Plugin name
   - Description
   - Version

2. Count and list commands in `commands/` directory

3. Count and list skills in `skills/` directory

4. Count and list agents in `agents/` directory (if exists)

### Step 4: Present Plugin Summary

```
## HPlugins Status

**Marketplace**: hplugins
**Version**: abc1234 (2026-03-18)
**Location**: ~/.claude/plugins/marketplaces/hplugins
**Updates Available**: Yes (3 commits behind) / No

---

### Installed Plugins

| Plugin | Version | Commands | Skills | Agents |
|--------|---------|----------|--------|--------|
| game-design | 1.0.0 | 3 | 3 | 0 |
| project-manager | 1.0.0 | 4 | 1 | 0 |
| hplugins-tools | 1.0.0 | 4 | 1 | 0 |

---

### Available Commands

**game-design**
- `/add-new-game` - Add a new game to Weekly Arcade project
- `/game-trend-scout` - Scout gaming trends and opportunities
- `/game-design-prd` - Create game design PRD

**project-manager**
- `/load-project` - Switch working context to a project
- `/recent-projects` - List and jump to recent projects
- `/project-info` - Display project metadata
- `/new-project` - Create project from template

**hplugins-tools**
- `/hplugins-sync` - Update all plugins
- `/hplugins-status` - Show this status (current)
- `/hplugins-check-updates` - Check for available updates
- `/hplugins-config` - Configure auto-update settings

---

### Available Skills

**game-design**
- `add-new-game` - Game integration patterns
- `game-design-prd` - PRD creation knowledge
- `game-trend-scout` - Trend analysis patterns

**project-manager**
- `project-context` - Project detection and management

**hplugins-tools**
- `auto-update` - Auto-update configuration and patterns
```

### Step 5: Detect Local Overrides

Check current project for local files that shadow global plugins:

```bash
# Check for local command overrides
ls .claude/commands/*.md 2>/dev/null

# Check for local skill overrides
ls -d .claude/skills/*/ 2>/dev/null

# Check for local agent overrides
ls .claude/agents/*.md 2>/dev/null
```

For each local file found, compare with global:
- **IDENTICAL**: Local copy matches global (can be removed)
- **OVERRIDE**: Local copy differs (active project-specific override)

### Step 6: Configuration Status

Check for config file:
```bash
cat ~/.claude/hplugins-config.json 2>/dev/null
```

Display auto-update configuration if exists:

```
### Auto-Update Configuration

- **Enabled**: Yes/No
- **Check Interval**: daily/weekly/manual
- **Auto Apply**: Yes/No
- **Last Check**: 2026-03-18 10:30:00
```

### Step 7: Health Check

Run basic health checks:
- Git repository intact
- All plugin.json files valid
- No broken symlinks
- Permissions correct

Report any issues found.

## Output Format

Use tables for structured data, code blocks for paths/commands, and clear section headers for easy scanning.
