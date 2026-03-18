# Claude Code Plugins

Custom Claude Code plugins for game design, development workflows, and automation.

## Available Plugins

| Plugin | Description | Skills |
|--------|-------------|--------|
| [game-design](./game-design/) | Game design toolkit for PRDs, trend scouting, and game integration | `game-design-prd`, `game-trend-scout`, `add-new-game` |

## Installation

### From GitHub

```bash
# Install a specific plugin
/plugin install https://github.com/HimanshuSingh2308/claude-code-plugins/game-design
```

### Local Development

```bash
# Clone the repository
git clone https://github.com/HimanshuSingh2308/claude-code-plugins.git

# Test a plugin locally
claude --plugin-dir ./claude-code-plugins/game-design
```

## Plugin Structure

Each plugin follows the Claude Code plugin specification:

```
plugin-name/
├── .claude-plugin/
│   └── plugin.json      # Plugin manifest
├── skills/              # Skill definitions
│   └── skill-name/
│       └── SKILL.md
├── agents/              # Custom agents (optional)
├── hooks/               # Event handlers (optional)
└── README.md
```

## Creating New Plugins

1. Create a new directory in this repo
2. Add `.claude-plugin/plugin.json` with manifest
3. Add skills in `skills/` directory
4. Test locally with `claude --plugin-dir ./your-plugin`
5. Push to this repository

## Documentation

- [Claude Code Plugins Documentation](https://code.claude.com/docs/en/plugins)
- [Skills Documentation](https://code.claude.com/docs/en/skills)

## License

MIT
