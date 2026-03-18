# Game Design Plugin

A Claude Code plugin for game design workflows, including PRD creation, trend scouting, and game integration.

## Skills Included

### `/game-design:game-design-prd`
Creates complete, actionable game design concepts and PRDs. Covers everything from concept ideation to full specification with emphasis on:
- Player engagement and retention systems
- Scoring and leaderboard design
- Multiplayer considerations
- Technical requirements

### `/game-design:game-trend-scout`
Researches live gaming trends and scores opportunities for browser/indie game development. Produces ranked reports with:
- 4-pass search process (demand, competition, browser gap, adjacent opportunities)
- Scoring formula across trend, competition, feasibility, and monetization
- Deep dives on top 3 opportunities
- Quick picks and signals to watch

### `/game-design:add-new-game`
Handles full integration of a new game into the Weekly Arcade project:
- Game file creation with SEO, sounds, achievements
- Landing page updates (cards, badges, JSON-LD)
- Leaderboard registration
- Sitemap updates

## Reference Files

The `game-design-prd` skill includes reference documentation:
- `references/game-genres.md` - Genre-specific design patterns
- `references/engagement-patterns.md` - Retention loops and psychological hooks
- `references/tech-stack-options.md` - Engine/backend recommendations

## Installation

```bash
# Via Claude Code plugin manager
/plugin install https://github.com/HimanshuSingh2308/claude-code-plugins/game-design

# Or for local development
claude --plugin-dir ./game-design
```

## Usage

```
# Create a game PRD
/game-design:game-design-prd

# Scout for trending game ideas
/game-design:game-trend-scout space shooter games

# Add a new game to Weekly Arcade
/game-design:add-new-game
```

## License

MIT
