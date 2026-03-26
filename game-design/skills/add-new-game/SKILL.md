---
name: add-new-game
description: >
  Use this skill whenever you need to add a new game to the Weekly Arcade project.
  Triggers include: "add this game to the project", "integrate this game", "implement
  this PRD", "add new game this week", "register the game", "update landing page for
  new game", "add to leaderboard". This skill handles ALL integration steps: creating
  the game HTML file, updating the landing page (card + hero badge + JSON-LD + SEO),
  registering in the leaderboard, updating the sitemap, and ensuring score submission,
  sounds, animations, and achievements use the correct project patterns.
  Always use this skill before writing any game code.
---

# Add New Game to Weekly Arcade

This skill handles the full integration of a new game into the Weekly Arcade NX monorepo.
It covers every file that must change, the exact patterns to follow, and the order to do it.

**Always read this entire skill before touching any file.**

---

## Project Structure

```
apps/web/src/
  index.html                   ← Landing page (6 changes needed)
  sitemap.xml                  ← SEO sitemap (1 entry to add)
  leaderboard/index.html       ← Leaderboard page GAMES array (1 entry)
  games/
    <game-slug>/
      index.html               ← The entire game (create this)
  js/
    api-client.js              ← Shared API client (DO NOT MODIFY)
    auth.js                    ← Auth manager (DO NOT MODIFY)
packages/shared/src/
  lib/types/leaderboard.types.ts   ← SubmitScoreDto shape
  lib/constants/scoring.ts         ← SCORING constants, helpers
```

---

## Phase 1: Extract from PRD

Before touching any file, extract these values from the PRD:

```
GAME_NAME        e.g. "Fieldstone"
GAME_SLUG        kebab-case, used as gameId in API calls  e.g. "fieldstone"
GAME_EMOJI       e.g. "🏰"
GAME_DESC        one-line card description  e.g. "Drop tiles, harvest rows, build a kingdom!"
GAME_TAGS        2–3 tag strings  e.g. ["Strategy", "Roguelite", "Puzzle"]
GAME_GENRE       for JSON-LD  e.g. ["Strategy", "Puzzle", "Roguelite"]
GAME_THEME_COLOR hex  e.g. "#2d5016"
GAME_KEYWORDS    SEO comma-separated keywords
GAME_OG_DESC     ≤150 char Open Graph description
GAME_STORAGE_KEY localStorage key  e.g. "fieldstone-player"

Score payload fields from PRD Scoring section:
  SCORE_FIELDS   which of: score (always), level, timeMs, guessCount, metadata{}

Achievements from PRD (5–10 is ideal):
  e.g. { id: 'first_run', name: 'First Run', desc: '...', icon: '🎯', xp: 100 }
```

---

## Phase 2: Create the game file

**Path:** `apps/web/src/games/<GAME_SLUG>/index.html`

Single self-contained HTML file. Follow all sections below exactly.

---

### 2.1 Head — SEO, OG, structured data

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GAME_NAME | Weekly Arcade - SHORT_TAGLINE</title>
  <meta name="description" content="FULL_DESCRIPTION. No download required.">
  <meta name="keywords" content="GAME_KEYWORDS, browser game, free game, no download">
  <link rel="canonical" href="https://weekly-arcade.web.app/games/GAME_SLUG/">
  <meta property="og:title" content="GAME_NAME | Weekly Arcade">
  <meta property="og:description" content="GAME_OG_DESC">
  <meta property="og:type" content="website">
  <meta property="og:url" content="https://weekly-arcade.web.app/games/GAME_SLUG/">
  <meta property="og:image" content="https://weekly-arcade.web.app/og-image.png">
  <meta property="og:site_name" content="Weekly Arcade">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="GAME_NAME | Weekly Arcade">
  <meta name="twitter:description" content="GAME_OG_DESC">
  <meta name="twitter:image" content="https://weekly-arcade.web.app/og-image.png">
  <meta name="theme-color" content="GAME_THEME_COLOR">
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "VideoGame",
    "name": "GAME_NAME",
    "url": "https://weekly-arcade.web.app/games/GAME_SLUG/",
    "description": "FULL_DESCRIPTION",
    "genre": GAME_GENRE_ARRAY,
    "playMode": "SinglePlayer",
    "applicationCategory": "Game",
    "operatingSystem": "Web Browser",
    "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
    "breadcrumb": {
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Weekly Arcade", "item": "https://weekly-arcade.web.app/" },
        { "@type": "ListItem", "position": 2, "name": "GAME_NAME", "item": "https://weekly-arcade.web.app/games/GAME_SLUG/" }
      ]
    }
  }
  </script>
</head>
```

---

### 2.2 Required CSS — Achievements, Toast, Confetti, Level-Up, Shake

**Full CSS is in `references/game-ui-library.md`** under "Required CSS" section — copy that block
into the game's `<style>`. Customise colours to match the game's theme.

Includes: `.achievement-toast`, `.confetti-container`, `.confetti`, `.levelup-container`,
`.levelup-particle`, `.score-pop`, `.shake`, `.pulse` with all keyframe animations.

---

### 2.3–2.7 Sound, Achievements, Visual Feedback, XP, Score Submission

**All implementations are in `references/game-ui-library.md`** — copy each section verbatim.

The reference file contains the canonical implementations for:
- **2.3 Sound System** — `playSound(type)` with Web Audio API oscillator pattern
- **2.4 Achievement System** — `ACHIEVEMENTS` object + `checkAchievements(gameData)`
- **2.5 Visual Feedback** — `showAchievementToast()`, `showConfetti()`, `showScorePop()`, `showLevelUpEffect()`, `showNewAchievements()`
- **2.6 XP & Levels** — `addXP(amount)` with level-up detection
- **2.7 Score Submission** — `submitScoreToCloud(scoreValue, extras)`

**Customization points** (do these AFTER copying from reference):
- Sound: Add game-specific cases (e.g. `'harvest'`, `'attack'`) to the switch statement
- Achievements: Replace template achievements with PRD-defined ones
- Score submission: Replace `GAME_SLUG` and uncomment relevant score fields
- Storage key: Replace `GAME_STORAGE_KEY` with the actual game storage key

**gameId rule:** The string `'GAME_SLUG'` must exactly match the slug used in
the GAMES array and sitemap. One mismatch = scores go to a ghost leaderboard.

---

### 2.8 Auth integration

```javascript
// ── AUTH ───────────────────────────────────────────────────
let currentUser = null;

window.addEventListener('authStateChanged', (e) => {
  currentUser = e.detail?.user ?? null;
  // Update UI here: show username, enable leaderboard features, etc.
});
```

---

### 2.9 Game-over / round-end sequence

Call these functions in the correct order when a session ends:

```javascript
function onGameEnd(won, scoreValue, extras = {}) {
  // 1. Sound
  playSound(won ? 'win' : 'fail');

  // 2. Confetti on win
  if (won) showConfetti();

  // 3. Check achievements — returns new IDs
  const newAchievements = checkAchievements({
    won,
    score: scoreValue,
    // pass whatever fields your checkAchievements uses
  });

  // 4. Add XP
  const xpEarned = won ? Math.round(scoreValue / 10) : 25;
  addXP(xpEarned);

  // 5. Show achievement toasts (staggered)
  showNewAchievements(newAchievements);

  // 6. Submit score to cloud
  submitScoreToCloud(scoreValue, extras);

  // 7. Show game-over UI (your own modal/overlay)
  showGameOverModal(won, scoreValue);
}
```

---

### 2.10 Required script includes (bottom of `<body>`, before `</body>`)

```html
  <script src="../../js/api-client.js"></script>
  <script src="../../js/auth.js"></script>
```

**Critical:** path is `../../js/` — two levels up from `games/<slug>/`. One level
up (`../js/`) will 404.

**Do NOT add Firebase SDK script tags** (`firebase-app-compat.js`, `firebase-auth-compat.js`).
`auth.js` dynamically loads the Firebase SDK automatically. Adding them manually causes
duplicate initialization and inconsistency.

---

### 2.11 Required back link (anywhere in `<body>`)

```html
<a href="../../">← All Games</a>
```

---

## Phase 3: Update `apps/web/src/index.html` — 6 changes

### 3.1 Deploy date comment (line 1)
```html
<!-- Deploy: 2026-MM-DD -->   ← today's date
```

### 3.2 Hero badge
Find `<span class="badge">` inside `<section class="hero">`:
```html
<span class="badge">🎉 New Game This Week: PREVIOUS_GAME_NAME</span>
```
Replace with:
```html
<span class="badge">🎉 New Game This Week: GAME_NAME</span>
```

### 3.3 Strip NEW from all previous game cards
Find every `<span class="tag new">NEW</span>` in the `.games-grid` and delete it.
Use `expected_replacements` set to the count of currently-NEW games.

### 3.4 Add new game card at end of `.games-grid`
```html
      <!-- GAME_NAME — THIS WEEK -->
      <a href="/games/GAME_SLUG/" class="game-card">
        <div class="game-thumb">GAME_EMOJI</div>
        <div class="game-info">
          <div class="game-title">GAME_NAME</div>
          <div class="game-desc">GAME_DESC</div>
          <div class="game-tags">
            <span class="tag new">NEW</span>
            <span class="tag">TAG_1</span>
            <span class="tag">TAG_2</span>
          </div>
        </div>
      </a>
```

### 3.5 JSON-LD ItemList entry
Append before the closing `]` of the ItemList. Increment position by 1.
```json
      },
      {
        "@type": "ListItem",
        "position": NEXT_NUMBER,
        "item": {
          "@type": "VideoGame",
          "name": "GAME_NAME",
          "url": "https://weekly-arcade.web.app/games/GAME_SLUG/",
          "description": "GAME_DESC",
          "genre": GAME_GENRE_ARRAY,
          "playMode": "SinglePlayer",
          "applicationCategory": "Game",
          "operatingSystem": "Web Browser",
          "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" }
        }
      }
```

### 3.6 Update homepage SEO meta
```html
<meta name="description" content="Play free browser games every week. No downloads.
Wordle, Snake, 2048, GAME_NAME and more. Sign in optional for leaderboards.">
<meta name="keywords" content="free browser games, GAME_SLUG, GAME_KEYWORDS,
wordle, snake game, arcade games, puzzle games">
```

---

## Phase 4: Update `apps/web/src/leaderboard/index.html`

Find the `GAMES` array (search for `{ id: 'wordle'`). Add entry at the end:

```javascript
      { id: 'GAME_SLUG', name: 'GAME_NAME', icon: 'GAME_EMOJI', description: 'SHORT_2_4_WORD_DESC' }
```

---

## Phase 5: Update `apps/web/src/sitemap.xml`

Add after the last `<url>` game block:

```xml
  <url>
    <loc>https://weekly-arcade.web.app/games/GAME_SLUG/</loc>
    <lastmod>TODAY_DATE</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>
```

Bump all other game entries from `0.9` → `0.8` if any currently sit at `0.9`.

---

## Execution Order

1. Extract all `GAME_*` variables from the PRD
2. Create `apps/web/src/games/GAME_SLUG/index.html` (full game)
3. Edit `apps/web/src/index.html` — all 6 changes
4. Edit `apps/web/src/leaderboard/index.html` — GAMES array
5. Edit `apps/web/src/sitemap.xml` — URL entry

---

## Quality Checklist

- [ ] Game file at correct path `games/<GAME_SLUG>/index.html`
- [ ] `../../js/api-client.js` and `../../js/auth.js` included (two levels up)
- [ ] `submitScoreToCloud` calls `window.apiClient.submitScore('GAME_SLUG', {...})`
- [ ] gameId in submit exactly matches GAME_SLUG (no typos, right case)
- [ ] `ACHIEVEMENTS` object defined with `{ name, desc, icon, xp }` shape
- [ ] `checkAchievements()` called in `onGameEnd()`
- [ ] `showNewAchievements()` called after `checkAchievements()`
- [ ] `playSound()` called for all key game events (move, score, win, fail)
- [ ] `showConfetti()` called on win
- [ ] `showScorePop()` called when points are awarded during gameplay
- [ ] `addXP()` called in `onGameEnd()`
- [ ] `authStateChanged` listener sets `currentUser`
- [ ] "← All Games" back link present
- [ ] Hero badge updated to GAME_NAME
- [ ] NEW tag removed from all previous game cards
- [ ] New game card has `<span class="tag new">NEW</span>`
- [ ] JSON-LD ItemList updated with correct position number
- [ ] Homepage meta description and keywords mention GAME_NAME
- [ ] Leaderboard GAMES array has new entry
- [ ] Sitemap has new `<url>` entry with `priority 0.9`
- [ ] Deploy date comment updated

---

## Common Mistakes

**Wrong gameId** — The string in `submitScore('GAME_SLUG', ...)` must match the leaderboard
GAMES array `id` exactly. Any mismatch sends scores to a ghost board.

**Wrong script path** — From `games/<slug>/index.html` use `../../js/`. Using `../js/`
causes a 404 and the entire auth + score system silently stops working.

**Missing auth.js** — Without `auth.js`, `authStateChanged` never fires, `currentUser`
stays null, and all score submissions silently skip.

**Hero badge not updated** — Players discover new games through the hero section.
Always update `🎉 New Game This Week: GAME_NAME`.

**NEW tag left on old games** — Only the current week's game gets the `new` CSS class.
Strip it from every previous card when adding the new one.

**Achievement toast queue** — `activeToasts` tracks vertical stacking. It is a module-level
`let` variable, not scoped inside a function. Declare it at the top of the script block.

**Audio on mobile** — Web Audio API requires a user gesture to start. Never call
`playSound()` on page load. Only call it inside event handlers (click, keydown, touch).
