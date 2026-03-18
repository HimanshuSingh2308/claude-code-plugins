---
description: Clone an existing game as a template for creating variations or new games
argument-hint: <source-game> <new-game-slug> [--strip-content | --keep-scores]
---

# Game Clone

Clone an existing game as a starting point for a new game or variation.

**Arguments**: $ARGUMENTS

## Overview

Use this command to:
- Create game variations (e.g., "Emoji Match 2")
- Use proven game as template
- Quickly prototype new ideas
- Fork for A/B testing

**What Gets Cloned**:
- Game HTML structure
- CSS styles
- JavaScript logic
- Sound system setup
- Achievement framework
- Leaderboard integration

**What Gets Customized**:
- Game name and metadata
- Slug and paths
- Theme colors
- SEO content

## Command Options

```
/game-clone <source-game> <new-game-slug> [options]

Arguments:
  <source-game>            Game to clone (e.g., "emoji-match")
  <new-game-slug>          Slug for new game (e.g., "emoji-match-2")

Options:
  --name "<name>"          Display name for new game
  --strip-content          Remove game-specific content (levels, assets)
  --keep-scores            Keep same leaderboard (for A/B tests)
  --skip-integration       Don't add to index.html/sitemap
  --branch <name>          Create on specific branch
```

## Usage Examples

### Simple Clone
```bash
/game-clone emoji-match emoji-match-2 --name "Emoji Match 2"
```

### Template Clone (stripped)
```bash
/game-clone word-stack new-word-game --strip-content
```

### A/B Test Clone
```bash
/game-clone puzzle-rush puzzle-rush-v2 --keep-scores
```

### Clone Without Integration
```bash
/game-clone tetris tetris-test --skip-integration
```

---

## Workflow

### Step 1: Validate Source Game

```bash
# Check source game exists
ls apps/web/src/games/{source-game}/

# Extract game metadata
PARSE index.html:
  - Game name
  - Description
  - Theme color
  - Keywords
  - Achievements
  - Sound definitions
```

### Step 2: Validate New Game Slug

```yaml
Verify:
  - Slug is valid (lowercase, hyphens only)
  - Slug doesn't already exist
  - Slug is not reserved

IF exists:
  ERROR: "Game '{new-slug}' already exists"
  SUGGEST: List alternative slugs
```

### Step 3: Create New Game Directory

```bash
mkdir -p apps/web/src/games/{new-game-slug}/
```

### Step 4: Clone and Transform Files

```yaml
Source: apps/web/src/games/{source-game}/index.html
Target: apps/web/src/games/{new-game-slug}/index.html

Transformations:
  1. Update <title> tag
  2. Update meta description
  3. Update og:title, og:description
  4. Update JSON-LD schema
  5. Update GAME_SLUG constant
  6. Update GAME_NAME constant
  7. Update localStorage key prefix
  8. Update theme-color meta
  9. Update canonical URL
  10. Update achievement names (if not --keep-scores)
```

### Step 5: Handle Content (if --strip-content)

```yaml
Strip:
  - Level definitions
  - Game-specific assets references
  - Custom sound mappings
  - Achievement definitions

Keep:
  - HTML structure
  - CSS framework
  - Core game loop structure
  - Sound system (with placeholders)
  - Achievement system (empty)
  - Leaderboard integration
```

### Step 6: Integration Files (unless --skip-integration)

```yaml
index.html:
  - Add game card (copied from source, updated)
  - Add JSON-LD entry
  - DON'T add "NEW" badge (manual decision)

sitemap.xml:
  - Add URL entry

leaderboard/index.html:
  - Add GAMES array entry (unless --keep-scores)
```

### Step 7: Summary and Next Steps

```
## Clone Complete

**Source**: emoji-match
**New Game**: emoji-match-2

### Files Created
- apps/web/src/games/emoji-match-2/index.html

### Files Modified
- apps/web/src/index.html (game card added)
- apps/web/src/sitemap.xml (entry added)
- apps/web/src/leaderboard/index.html (entry added)

### Next Steps

1. **Customize the game**:
   Open: apps/web/src/games/emoji-match-2/index.html

2. **Update game logic**:
   - Modify level progression
   - Add new features
   - Adjust difficulty

3. **Update assets** (if needed):
   - Replace images
   - Update sounds

4. **Test locally**:
   npm run dev
   Open: http://localhost:3000/games/emoji-match-2/

5. **Create PR when ready**:
   /game-audit emoji-match-2
```

---

## Clone Modes

### Standard Clone

Copies everything, updates metadata:

```bash
/game-clone word-stack word-puzzle
```

Best for:
- Creating sequels
- Seasonal versions
- Theme variations

### Template Clone (--strip-content)

Removes game-specific content, keeps framework:

```bash
/game-clone word-stack new-game --strip-content
```

Produces a skeleton with:
```html
<!-- Game board placeholder -->
<div id="game-board">
  <!-- TODO: Add game content -->
</div>

<script>
  // Core game variables
  const GAME_SLUG = 'new-game';
  const GAME_NAME = 'New Game';

  // TODO: Implement game logic
  function initGame() {
    console.log('Game initialized - implement your logic here');
  }

  // Sound system ready
  const sounds = {
    // TODO: Define your sounds
  };

  // Achievement system ready
  const achievements = [
    // TODO: Define achievements
  ];

  // Leaderboard integration ready
  function submitScore(score, metadata) {
    window.apiClient.submitScore(GAME_SLUG, {
      score: score,
      ...metadata
    });
  }
</script>
```

### A/B Test Clone (--keep-scores)

Same game with shared leaderboard:

```bash
/game-clone puzzle-rush puzzle-rush-v2 --keep-scores
```

Both versions:
- Share the same leaderboard
- Compete on same rankings
- Useful for testing changes

---

## Transformation Details

### Metadata Updates

| Field | Source | Target |
|-------|--------|--------|
| `<title>` | "Word Stack - Weekly Arcade" | "Word Puzzle - Weekly Arcade" |
| `og:title` | "Word Stack" | "Word Puzzle" |
| `GAME_SLUG` | 'word-stack' | 'word-puzzle' |
| `GAME_NAME` | 'Word Stack' | 'Word Puzzle' |
| `localStorage` | 'word-stack-*' | 'word-puzzle-*' |
| `canonical` | '/games/word-stack/' | '/games/word-puzzle/' |

### JSON-LD Schema

```json
{
  "@type": "VideoGame",
  "name": "Word Puzzle",
  "url": "https://example.com/games/word-puzzle/",
  "description": "Updated description for Word Puzzle"
}
```

### Integration Card

```html
<div class="game-card" data-game="word-puzzle">
  <h3>Word Puzzle</h3>
  <p>Your description here</p>
  <a href="/games/word-puzzle/">Play Now</a>
</div>
```

---

## Guardrails

### Blocked

```yaml
BLOCKED:
  - Cloning to existing game slug
  - Cloning non-existent source
  - Invalid slug format
  - Cloning outside games directory
```

### Confirmations

```yaml
CONFIRM:
  - "Clone {source} to {new}? [Y/n]"
  - Integration file modifications

SHOW:
  - List of files to be created
  - List of files to be modified
```

---

## Output Locations

| Artifact | Location |
|----------|----------|
| New game | `apps/web/src/games/{new-slug}/index.html` |
| Clone log | `~/Documents/weekly-games/clones/{new-slug}-clone.json` |

### Clone Log

```json
{
  "source": "word-stack",
  "target": "word-puzzle",
  "clonedAt": "2026-03-18T14:30:00Z",
  "options": {
    "stripContent": false,
    "keepScores": false,
    "skipIntegration": false
  },
  "filesCreated": [
    "apps/web/src/games/word-puzzle/index.html"
  ],
  "filesModified": [
    "apps/web/src/index.html",
    "apps/web/src/sitemap.xml",
    "apps/web/src/leaderboard/index.html"
  ]
}
```

---

## Notes

- Clone creates a starting point; customization still needed
- Use `--strip-content` for significant departures from source
- Use `--keep-scores` only for true A/B tests
- Run `/game-audit` on cloned game before release
- Consider fresh PRD for major variations
