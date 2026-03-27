# Claude Code Plugins Marketplace

A plugin marketplace for Claude Code with custom plugins for game design, development workflows, and automation.

## Quick Start

### Add the Marketplace

```bash
/plugin marketplace add HimanshuSingh2308/claude-code-plugins
```

### Install a Plugin

```bash
/plugin install game-design@hplugins
```

### Update Marketplace

```bash
/plugin marketplace update hplugins
```

## Available Plugins

| Plugin | Description | Skills |
|--------|-------------|--------|
| [game-design](./game-design/) | Game design toolkit for PRDs, trend scouting, and game integration | `game-design-prd`, `game-trend-scout`, `add-new-game` + 13 agents |

## Plugin Details

### game-design

A comprehensive game design toolkit with three powerful skills:

| Skill | Command | Purpose |
|-------|---------|---------|
| Game Design PRD | `/game-design:game-design-prd` | Create complete game design PRDs with engagement systems, scoring, leaderboards |
| Game Trend Scout | `/game-design:game-trend-scout` | Research trending games and score opportunities |
| Add New Game | `/game-design:add-new-game` | Integrate new games via `add-game-orchestrator` agent (6 sub-agents) |

**Includes reference files:**
- `game-genres.md` - Genre-specific design patterns
- `engagement-patterns.md` - Retention loops and psychological hooks
- `tech-stack-options.md` - Engine/backend recommendations

## Local Development

```bash
# Clone the repository
git clone https://github.com/HimanshuSingh2308/claude-code-plugins.git

# Add as local marketplace
/plugin marketplace add ./claude-code-plugins

# Or test a plugin directly
claude --plugin-dir ./claude-code-plugins/game-design
```

## Marketplace Structure

```
claude-code-plugins/
├── .claude-plugin/
│   └── marketplace.json    # Marketplace catalog
├── game-design/            # Plugin directory
│   ├── .claude-plugin/
│   │   └── plugin.json     # Plugin manifest
│   ├── skills/
│   │   ├── game-design-prd/
│   │   ├── game-trend-scout/
│   │   └── add-new-game/       # Reference material for sub-agents
│   ├── agents/                  # 13 agents with model optimization
│   └── README.md
└── README.md
```

## Creating New Plugins

1. Create a new directory for your plugin
2. Add `.claude-plugin/plugin.json` with manifest
3. Add skills in `skills/` directory
4. Add plugin entry to `.claude-plugin/marketplace.json`
5. Test locally with `claude --plugin-dir ./your-plugin`
6. Push to this repository

## Configuration for Teams

Add this marketplace to your project's `.claude/settings.json`:

```json
{
  "extraKnownMarketplaces": {
    "hplugins": {
      "source": {
        "source": "github",
        "repo": "HimanshuSingh2308/claude-code-plugins"
      }
    }
  },
  "enabledPlugins": {
    "game-design@hplugins": true
  }
}
```

## Documentation

- [Claude Code Plugins Documentation](https://code.claude.com/docs/en/plugins)
- [Plugin Marketplaces](https://code.claude.com/docs/en/plugin-marketplaces)
- [Skills Documentation](https://code.claude.com/docs/en/skills)

## License

MIT
