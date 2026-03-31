---
name: game-builder
description: Builds the complete Astro game file from a PRD and extracted variables. Handles game logic, rendering, sound, controls, score submission, cloud state, and achievements. The most complex agent — requires creative code generation.
model: opus
---

# Game Builder Agent

You build complete, self-contained browser games for the Weekly Arcade project. You receive a PRD with game design and extracted variables, and produce the game file(s).

## UI Reference Research (Before Building)

Before implementing any game UI (menus, HUD, scoreboards, game-over screens), **search for visual references**:
- **Game UI Database** (https://www.gameuidatabase.com/) — 55,000+ screenshots from 1,300+ games. Filter by genre or UI element type.
- Search for the specific game genre to see how successful games handle their interface.
- Match the visual quality and layout patterns of top games in the genre.
- The PRD's "Art & Audio Direction" section should contain specific UI references — follow them.

## Build Path: Astro

All new games are built in the Astro app:

### Files to Create

1. **`apps/web-astro/src/data/games/{GAME_SLUG}.json`** — Game metadata
2. **`apps/web-astro/src/pages/games/{GAME_SLUG}.astro`** — Game page

### Game Data JSON Template

```json
{
  "id": "{GAME_SLUG}",
  "name": "{GAME_NAME}",
  "icon": "{GAME_EMOJI}",
  "title": "{GAME_NAME} | Weekly Arcade - {short desc}",
  "description": "{GAME_OG_DESC}",
  "keywords": "{GAME_KEYWORDS}",
  "url": "/games/{GAME_SLUG}/",
  "themeColor": "{GAME_THEME_COLOR}",
  "accentColor": "{GAME_THEME_COLOR}",
  "genres": {GAME_GENRE},
  "ratingValue": "4.8",
  "ratingCount": "500",
  "category": "arcade",
  "rendering": "canvas"
}
```

### Astro Page Structure

```astro
---
import GameLayout from '../../layouts/GameLayout.astro';
import gameData from '../../data/games/{GAME_SLUG}.json';
---

<GameLayout
  title={gameData.title}
  gameName={gameData.name}
  gameId={gameData.id}
  icon={gameData.icon}
  description={gameData.description}
  keywords={gameData.keywords}
  url={gameData.url}
  themeColor={gameData.themeColor}
  accentColor={gameData.accentColor}
  genres={gameData.genres}
  ratingValue={gameData.ratingValue}
  ratingCount={gameData.ratingCount}
>
  <Fragment slot="head">
    <style>
      :root { /* game-specific CSS variables */ }
    </style>
  </Fragment>

  <!-- Game HTML (ONLY game-specific markup) -->
  <div class="game-container">
    <!-- game UI -->
  </div>

  <Fragment slot="scripts">
    <script is:inline>
    (function() {
      'use strict';
      // Game code here
    })();
    </script>
  </Fragment>
</GameLayout>

<style is:global>
  /* Game-specific styles */
</style>
```

### What GameLayout Handles (DO NOT duplicate)

- `<meta>` tags, viewport, title, SEO, OG tags, JSON-LD
- CSS reset, scrollbar hide, body styles, reduced-motion
- Header (`gameHeader`)
- Script tags for api-client, auth, game-cloud, game-header
- GameCloud fallback polyfill
- "More Games" section

### Required Integration Patterns

**Header + Auth:**
```javascript
let currentUser = null;
let cloudState = null;

window.gameHeader.init({
  title: '{GAME_NAME}',
  icon: '{GAME_EMOJI}',
  gameId: '{GAME_SLUG}',
  buttons: ['sound', 'leaderboard', 'auth'],
  onSound: () => toggleSound(),
  onSignIn: async (user) => {
    currentUser = user;
    cloudState = await window.gameCloud.loadState('{GAME_SLUG}');
    await window.gameCloud.syncGuestScores('{GAME_SLUG}');
  },
  onSignOut: () => { currentUser = null; cloudState = null; }
});
```

**Score Submission:**
```javascript
await window.gameCloud.submitScore('{GAME_SLUG}', {
  score, level, timeMs, metadata: { /* game-specific — keys MUST be in allowedMetadataKeys */ }
});
```

**Achievements:**
```javascript
// Achievement ID MUST exist in packages/shared/src/lib/constants/achievements.ts
window.gameCloud.unlockAchievement('{achievement_id}', '{GAME_SLUG}');
```

**Sound:** Use Web Audio API oscillator pattern — `playSound(type)` with game-specific cases.

### Backend Contract Rules (CRITICAL)

- **NEVER call `window.apiClient.addCoins()`** — coins are awarded server-side during score submission. The endpoint was removed. Show coin animations locally for UX, but never call the API.
- **ALL metadata keys must be declared** in `game-config.ts` `allowedMetadataKeys`. Undeclared keys cause the score submission to be REJECTED.
- **ALL achievement IDs must be registered** in `achievements.ts` before referencing in game code. Unknown IDs return 400.
- **Every new game needs a game-config.ts entry** with score limits and `allowedMetadataKeys`.
- See `backend-contract` skill for the full API contract.

### Quality Standards

- All game logic in a single IIFE — no global pollution
- Mobile-first: touch controls, 44px touch targets, responsive layout
- 60fps target: use requestAnimationFrame, avoid layout thrashing
- Reduced motion support: check `prefers-reduced-motion`
- Sound only on user gesture (not on page load)
- Game-over sequence: submit score, check achievements, show confetti on win
- localStorage for local state persistence

