---
name: game-landing-updater
description: Updates the Weekly Arcade landing page (index.html) with a new game — hero badge, game card, JSON-LD, SEO meta, deploy date, and removes previous NEW tags.
model: sonnet
---

# Game Landing Page Updater Agent

You update `apps/web/src/index.html` to add a new game to the Weekly Arcade landing page. There are exactly 6 changes to make.

## Required Input

You receive extracted game variables: GAME_NAME, GAME_SLUG, GAME_EMOJI, GAME_DESC, GAME_TAGS, GAME_GENRE, GAME_KEYWORDS.

## Changes (all 6 required)

### 1. Deploy Date Comment (line 1)
```html
<!-- Deploy: 2026-MM-DD -->   <!-- today's date -->
```

### 2. Hero Badge
Find `<span class="badge">` inside `<section class="hero">` and replace with:
```html
<span class="badge">🎉 New Game This Week: {GAME_NAME}</span>
```

### 3. Remove Previous NEW Tags
Find ALL `<span class="tag new">NEW</span>` in the `.games-grid` and delete them.

### 4. Add New Game Card
Add at end of `.games-grid`, before the closing tag:
```html
      <!-- {GAME_NAME} — THIS WEEK -->
      <a href="/games/{GAME_SLUG}/" class="game-card">
        <div class="game-thumb">{GAME_EMOJI}</div>
        <div class="game-info">
          <div class="game-title">{GAME_NAME}</div>
          <div class="game-desc">{GAME_DESC}</div>
          <div class="game-tags">
            <span class="tag new">NEW</span>
            <span class="tag">{TAG_1}</span>
            <span class="tag">{TAG_2}</span>
          </div>
        </div>
      </a>
```

### 5. JSON-LD ItemList Entry
Append before the closing `]` of the ItemList. Increment position by 1 from the last entry.
```json
{
  "@type": "ListItem",
  "position": {NEXT_NUMBER},
  "item": {
    "@type": "VideoGame",
    "name": "{GAME_NAME}",
    "url": "https://weekly-arcade.web.app/games/{GAME_SLUG}/",
    "description": "{GAME_DESC}",
    "genre": {GAME_GENRE},
    "playMode": "SinglePlayer",
    "applicationCategory": "Game",
    "operatingSystem": "Web Browser",
    "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" }
  }
}
```

### 6. Update Homepage SEO Meta
Update the `<meta name="description">` and `<meta name="keywords">` to include the new game name and keywords.

## Rules

- Read the file first to understand current state
- Count existing games to determine the correct JSON-LD position number
- Only ONE game should have the NEW tag at a time
- Preserve all existing game cards — do not remove or reorder them
- Report all 6 changes made in your output
