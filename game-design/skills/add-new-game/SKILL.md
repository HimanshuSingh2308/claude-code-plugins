---
name: add-new-game
description: >
  Reference material for adding a new game to Weekly Arcade. This skill provides the
  detailed patterns, templates, and checklists used by the add-game agent architecture.
  The actual workflow is now orchestrated by the `add-game-orchestrator` agent, which
  delegates to specialized sub-agents: game-prd-extractor (haiku), game-builder (opus),
  game-landing-updater (sonnet), game-registry-updater (sonnet), game-seo-updater (haiku),
  and game-integration-checker (sonnet).
  Triggers: "add this game to the project", "integrate this game", "implement this PRD",
  "add new game this week". When triggered, spawn the `add-game-orchestrator` agent.
---

# Add New Game to Weekly Arcade

> **Agent-driven workflow.** This skill is reference material consumed by the add-game
> sub-agents. To add a game, spawn the **`add-game-orchestrator`** agent with the PRD.
> It coordinates 6 specialized sub-agents with optimized model assignments.

This document covers every file that must change, the exact patterns to follow, and the order to do it.

> **Astro migration in progress.** New games should be built in `apps/web-astro/` using the
> Astro framework. The Astro path eliminates ~130 lines of boilerplate per game (SEO, header,
> shared scripts, fallback polyfill, more-games section) — all handled by `GameLayout.astro`.
> See the **"Astro Path"** sections below. For the full Astro reference, load the `astro-pro` skill.

---

## Project Structure

### Astro App (preferred for new games)

```
apps/web-astro/src/
  data/games/{game-id}.json       ← Game metadata (drives SEO + layout) — CREATE THIS
  pages/games/{game-id}.astro     ← Game page (game-specific code only) — CREATE THIS
  layouts/GameLayout.astro        ← Shared layout (DO NOT MODIFY)
  components/                     ← Shared components (DO NOT MODIFY)
  public/js/                      ← Shared JS modules (copies from apps/web/src/js/)
```

### Legacy App (existing games)

```
apps/web/src/
  index.html                   ← Landing page (6 changes needed)
  sitemap.xml                  ← SEO sitemap (1 entry to add)
  leaderboard/index.html       ← Leaderboard page (auto-populated from API catalog)
  games/
    <game-slug>/
      index.html               ← The entire game (create this)
  js/
    api-client.js              ← Shared API client (DO NOT MODIFY)
    auth.js                    ← Auth manager + auth nudge + user cache (DO NOT MODIFY)
    game-cloud.js              ← Score/cloud/achievements/wake-lock library (DO NOT MODIFY)
    game-header.js             ← Shared header component + auto-auth (DO NOT MODIFY)
packages/shared/src/
  lib/types/leaderboard.types.ts   ← SubmitScoreDto shape
  lib/types/achievement.types.ts   ← AchievementCategory type (ADD GAME SLUG)
  lib/constants/scoring.ts         ← SCORING constants, helpers
  lib/constants/game-registry.ts   ← GAME_REGISTRY — single source of truth for all games (ADD ENTRY)
  lib/constants/achievements.ts    ← ACHIEVEMENTS registry — all achievement IDs (ADD ENTRIES)
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

## Phase 2 (Astro Path): Create game data + page

> **Use this path for all new games.** Skip to "Phase 2 (Legacy)" only if you must add
> to the old `apps/web/` app.

### 2A.1 Game Data JSON

**Create:** `apps/web-astro/src/data/games/GAME_SLUG.json`

```json
{
  "id": "GAME_SLUG",
  "name": "GAME_NAME",
  "icon": "GAME_EMOJI",
  "title": "GAME_NAME | Weekly Arcade - GAME_DESC_SHORT",
  "description": "GAME_OG_DESC",
  "keywords": "GAME_KEYWORDS",
  "url": "/games/GAME_SLUG/",
  "themeColor": "GAME_THEME_COLOR",
  "accentColor": "GAME_THEME_COLOR",
  "genres": GAME_GENRE,
  "ratingValue": "4.8",
  "ratingCount": "500",
  "category": "arcade",
  "rendering": "canvas"
}
```

### 2A.2 Game Page

**Create:** `apps/web-astro/src/pages/games/GAME_SLUG.astro`

```astro
---
import GameLayout from '../../layouts/GameLayout.astro';
import gameData from '../../data/games/GAME_SLUG.json';
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
  <!-- Game CSS variables -->
  <Fragment slot="head">
    <style>
      :root {
        --bg-primary: #0f0f1a;
        --accent: GAME_THEME_COLOR;
        /* add game-specific CSS variables */
      }
    </style>
  </Fragment>

  <!-- Game HTML (ONLY game-specific markup — no header, no meta, no boilerplate) -->
  <div class="game-container">
    <!-- game UI here -->
  </div>

  <!-- Game scripts -->
  <Fragment slot="scripts">
    <script is:inline>
    (function() {
      'use strict';

      // Header + auth (shared module handles everything)
      window.gameHeader.init({
        title: 'GAME_NAME',
        icon: 'GAME_EMOJI',
        gameId: 'GAME_SLUG',
        buttons: ['sound', 'leaderboard', 'auth'],
        onSound: () => toggleSound(),
        onSignIn: async (user) => {
          currentUser = user;
          cloudState = await window.gameCloud.loadState('GAME_SLUG');
          // sync cloud → local
        },
        onSignOut: () => { currentUser = null; }
      });

      // ... game logic (sound, controls, rendering, game loop) ...

      // Score submission via shared gameCloud
      async function submitScore() {
        await window.gameCloud.submitScore('GAME_SLUG', {
          score, level, timeMs, metadata: { /* game-specific */ }
        });
      }
    })();
    </script>
  </Fragment>
</GameLayout>

<!-- Game-specific styles (NO reset, body, reduced-motion — layout handles those) -->
<style is:global>
  .game-container { /* ... */ }
</style>
```

### 2A.3 What NOT to include in Astro games

GameLayout handles all of these — do NOT add them:
- `<meta charset>`, viewport, `<title>` — in BaseLayout
- Preconnects, SEO meta, OG tags, Twitter cards — in SEOHead.astro
- JSON-LD structured data — in SEOHead.astro
- PWA manifest, theme-color — in SEOHead.astro
- CSS reset (`* { box-sizing... }`), scrollbar hide — in BaseLayout
- Body styles (font, background, touch-action) — in GameLayout
- `@media (prefers-reduced-motion)` — in BaseLayout
- Header `<header id="gameHeader">` — in GameHeader.astro
- Script tags for api-client, auth, game-cloud, game-header — in GameLayout
- GameCloud fallback polyfill — in GameCloudFallback.astro
- "More Games" section — in MoreGames.astro

### 2A.4 Build & verify

```bash
cd apps/web-astro && npx astro build    # verify clean build
cd apps/web-astro && npx astro dev --port 4201   # test locally
```

Then continue to Phase 3 (landing page updates) and Phase 4+ as normal.

---

## Phase 2 (Legacy): Create the game file

> **Only use this path if adding to the old `apps/web/` app.**

**Path:** `apps/web/src/games/<GAME_SLUG>/index.html`

Single self-contained HTML file. Follow all sections below exactly.

---

### 2.1 Head — SEO, OG, structured data

**Full template is in `references/game-ui-library.md`** under "HTML Head Template" section — copy
that block and replace all `GAME_*` placeholders with PRD values.

Customization: add extra `<meta>` tags if the game has unique SEO needs (e.g. `game:section`).

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
- **2.7 Score Submission** — via `window.gameCloud.submitScore()` or `submitOrQueue()`

**Customization points** (do these AFTER copying from reference):
- Sound: Add game-specific cases (e.g. `'harvest'`, `'attack'`) to the switch statement
- Achievements: Replace template achievements with PRD-defined ones
- Score submission: Replace `GAME_SLUG` and uncomment relevant score fields
- Storage key: Replace `GAME_STORAGE_KEY` with the actual game storage key

**gameId rule:** The string `'GAME_SLUG'` must exactly match the slug used in
the GAMES array and sitemap. One mismatch = scores go to a ghost leaderboard.

---

### 2.8 Header + Auth + Cloud integration

All games use three shared libraries. **Do NOT write custom headers, auth polling,
submitScore guards, or cloud state boilerplate.**

#### Header (via game-header.js)

The shared header component renders the back button, title, and action buttons.
It also auto-wires auth via `gameCloud.initAuth` — no separate auth init needed.

Add this HTML in the `<body>` (with inline fallback for when JS hasn't loaded):

```html
<header id="gameHeader" style="display:flex;justify-content:space-between;align-items:center;padding:0.55rem 0.75rem;background:var(--bg-secondary,#1a1a2e);border-bottom:1px solid var(--border,rgba(255,255,255,0.06));">
  <a href="/" style="color:#888;text-decoration:none;font-size:1.3rem;min-width:44px;min-height:44px;display:flex;align-items:center;justify-content:center;">←</a>
  <span style="font-weight:700;font-size:1.05rem;">GAME_EMOJI GAME_NAME</span>
  <span></span>
</header>
```

Then in JS (after DOM ready):

```javascript
let currentUser = null;
let cloudState = null;

// Header renders ←, title, buttons AND wires auth automatically
const headerApi = window.gameHeader.init({
  title: 'GAME_NAME',
  icon: 'GAME_EMOJI',
  gameId: 'GAME_SLUG',
  buttons: ['sound', 'leaderboard', 'auth'],  // pick which buttons to show
  onSound: () => toggleSound(),
  onSignIn: async (user) => {
    currentUser = user;
    cloudState = await window.gameCloud.loadState('GAME_SLUG');
    // Merge cloud state with local (e.g. sync high score)
    if (cloudState?.additionalData?.highScore > localHighScore) {
      localHighScore = cloudState.additionalData.highScore;
      localStorage.setItem('GAME_SLUG-high-score', localHighScore);
    }
    await window.gameCloud.syncGuestScores('GAME_SLUG');
  },
  onSignOut: () => { currentUser = null; cloudState = null; }
});

// Use headerApi for dynamic updates:
// headerApi.setSoundMuted(true/false)
// headerApi.setHintCount(n)
// headerApi.showUndo(true/false, count)
```

**Available buttons:** `'sound'`, `'leaderboard'`, `'auth'`, `'hint'`, `'help'`, `'menu'`, `'undo'`

**What the header handles for you:**
- Back `←` link to homepage
- Title (left-aligned on mobile, centered on desktop)
- Auth button → avatar when signed in, "Sign In" when not
- `gameCloud.initAuth()` called automatically (no separate auth init)
- User cached in localStorage for instant avatar on page load
- 44px touch targets, safe-area padding, responsive

#### Cloud (via game-cloud.js)

```javascript
// Score submission — gameCloud handles auth guard + guest nudge
await window.gameCloud.submitScore('GAME_SLUG', {
  score, level, timeMs, metadata: { ... }
});

// Or: submit or queue for guest score storage
await window.gameCloud.submitOrQueue('GAME_SLUG', scoreData, { silent: false });

// Cloud state save/load
cloudState = await window.gameCloud.loadState('GAME_SLUG');
await window.gameCloud.saveState('GAME_SLUG', newState);

// Achievements
window.gameCloud.unlockAchievement('first_game', 'GAME_SLUG');
```

**gameCloud API reference:**
| Method | Purpose |
|--------|---------|
| `gameCloud.submitScore(gameId, data)` | Submit score (nudges guests) |
| `gameCloud.submitOrQueue(gameId, data, opts)` | Submit or save locally for guests |
| `gameCloud.loadState(gameId)` | Load cloud state |
| `gameCloud.saveState(gameId, state)` | Save cloud state |
| `gameCloud.saveGuestScore(gameId, data)` | Queue a guest score in localStorage |
| `gameCloud.syncGuestScores(gameId)` | Sync queued guest scores on sign-in |
| `gameCloud.unlockAchievement(id, gameId)` | Unlock achievement (silent fail) |
| `gameCloud.getUser()` | Get current Firebase user |
| `gameCloud.isSignedIn()` | Check auth status |

---

### 2.9 Game-over / round-end sequence

**Full template is in `references/game-ui-library.md`** under "Game-Over / Round-End Sequence" —
copy the `onGameEnd()` function and customize per the listed customization points.

Key things to adapt per game:
- XP formula (divisor and consolation amount)
- Win condition (some games are score-only, no binary win/lose)
- Extra `gameData` fields passed to `checkAchievements`
- Any game-specific end-of-round actions after step 6

---

### 2.10 Required script includes (bottom of `<body>`, before `</body>`)

```html
  <script src="../../js/api-client.js"></script>
  <script src="../../js/auth.js"></script>
  <script src="../../js/game-cloud.js"></script>
  <script src="../../js/game-header.js"></script>
```

**Critical:** path is `../../js/` — two levels up from `games/<slug>/`. One level
up (`../js/`) will 404.

**Do NOT add Firebase SDK script tags** (`firebase-app-compat.js`, `firebase-auth-compat.js`).
`auth.js` dynamically loads the Firebase SDK automatically.

**Do NOT write custom headers, auth polling, submitScore guards, or cloud state boilerplate.**
Use `gameHeader.init()` for header+auth, `gameCloud.*` for cloud. See section 2.8.

---

### 2.11 Header element (replaces back link)

The `<header id="gameHeader">` element with inline fallback replaces the old `← All Games`
back link. See section 2.8 for the full HTML. **Do NOT add a separate back link** — the
header component provides one automatically.

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

## Phase 4: Update Game Registry (single source of truth)

**File:** `packages/shared/src/lib/constants/game-registry.ts`

Add entry to `GAME_REGISTRY` array:

```typescript
  { id: 'GAME_SLUG', name: 'GAME_NAME', icon: 'GAME_EMOJI', description: 'SHORT_DESC', genres: ['genre1', 'genre2'] },
```

This is the **single source of truth** for all game metadata. The API serves it at
`GET /api/games/catalog` (public, no auth). The leaderboard and profile pages fetch
from this endpoint automatically — **no manual GAMES array update needed** on those pages.

After editing, rebuild shared: `npx nx run shared:build`

---

## Phase 5: Register Achievements in Backend

**File:** `packages/shared/src/lib/constants/achievements.ts`

Add all game achievements to the `ACHIEVEMENTS` record. The backend validates
achievement IDs on unlock — any ID not in this file returns 400 "Unknown achievement".

```typescript
  // ============ GAME_NAME ACHIEVEMENTS ============
  GAME_SLUG_first: {
    id: 'GAME_SLUG_first',
    name: 'First Game',
    description: 'Complete your first game',
    icon: '🎯',
    xpReward: 100,
    category: 'GAME_SLUG',    // Must match AchievementCategory type
    requirement: { type: 'first_game', gameId: 'GAME_SLUG' },
  },
  // ... add all achievements from the PRD
```

**Also update the category type** if this is a new game:

**File:** `packages/shared/src/lib/types/achievement.types.ts`

Add the game slug to the `AchievementCategory` union:

```typescript
export type AchievementCategory =
  | 'gameplay'
  | 'streak'
  // ... existing categories
  | 'GAME_SLUG';    // ← add this
```

**Achievement ID convention:** prefix all IDs with the game slug to avoid collisions.
E.g., `tt_first_day`, `tt_combo_5` for Tiny Tycoon.

After editing both files, rebuild: `npx nx run shared:build`

---

## Phase 6: Update `apps/web/src/sitemap.xml`

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
3. Edit `packages/shared/src/lib/constants/game-registry.ts` — add GAME_REGISTRY entry
4. Edit `packages/shared/src/lib/constants/achievements.ts` — register all achievements
5. Edit `packages/shared/src/lib/types/achievement.types.ts` — add category to union type
6. Edit `apps/web/src/index.html` — all 6 changes
7. Edit `apps/web/src/sitemap.xml` — URL entry
8. Rebuild shared: `npx nx run shared:build`

---

## Quality Checklist

**Scripts & Header:**
- [ ] Game file at correct path `games/<GAME_SLUG>/index.html`
- [ ] Four scripts included: `api-client.js`, `auth.js`, `game-cloud.js`, `game-header.js` (path: `../../js/`)
- [ ] `<header id="gameHeader">` present with inline fallback (← + game name)
- [ ] `gameHeader.init()` called with title, icon, gameId, buttons, onSignIn/onSignOut
- [ ] NO separate `gameCloud.initAuth()` call (header handles it)
- [ ] NO custom header CSS (shared `game-header.js` injects its own)
- [ ] NO manual back link (header provides ← automatically)

**Cloud & Scores:**
- [ ] Score submission uses `gameCloud.submitScore()` or `submitOrQueue()` (NOT raw apiClient)
- [ ] Cloud state uses `gameCloud.loadState()` / `saveState()` (NOT raw apiClient)
- [ ] Achievements use `gameCloud.unlockAchievement()` (NOT raw apiClient)
- [ ] gameId in all calls exactly matches GAME_SLUG
- [ ] All achievement IDs registered in `packages/shared/src/lib/constants/achievements.ts`
- [ ] Game slug added to `AchievementCategory` in `achievement.types.ts`
- [ ] Achievement IDs prefixed with game slug (e.g., `tt_combo_5`, not `combo_5`)

**Game Content:**
- [ ] `GAME_REGISTRY` entry added in `packages/shared/src/lib/constants/game-registry.ts`
- [ ] `ACHIEVEMENTS` object defined with `{ name, desc, icon, xp }` shape
- [ ] `checkAchievements()` called in `onGameEnd()`
- [ ] `playSound()` called for all key game events (move, score, win, fail)
- [ ] `showConfetti()` called on win
- [ ] `addXP()` called in `onGameEnd()`

**Landing Page & SEO:**
- [ ] Hero badge updated to GAME_NAME
- [ ] NEW tag removed from all previous game cards
- [ ] New game card has `<span class="tag new">NEW</span>` with `data-genres` attribute
- [ ] JSON-LD ItemList updated with correct position number
- [ ] Homepage meta description and keywords mention GAME_NAME
- [ ] Sitemap has new `<url>` entry with `priority 0.9`
- [ ] Deploy date comment updated

---

## Common Mistakes

**Writing custom header HTML/CSS** — Do NOT create a `<header>` with your own back button,
title styling, or auth button markup. Use `<header id="gameHeader">` with inline fallback +
`gameHeader.init()`. The shared component handles layout, auth, avatar, responsive, and touch targets.

**Calling gameCloud.initAuth separately** — Do NOT call `gameCloud.initAuth()` yourself.
`gameHeader.init()` calls it automatically when `'auth'` is in the buttons array. Calling
both results in duplicate auth listeners and double sign-in callbacks.

**Writing custom auth boilerplate** — Do NOT write `setInterval(() => { if (authManager.isInitialized)...`
or `if (!currentUser || !window.apiClient) return` guards. Use `gameCloud.submitScore()` —
it handles auth checking and guest nudge internally.

**Wrong gameId** — The string in `gameCloud.submitScore('GAME_SLUG', ...)` must match the
`GAME_REGISTRY` entry `id` exactly. Any mismatch sends scores to a ghost board.

**Missing scripts** — Always include all four: `api-client.js`, `auth.js`, `game-cloud.js`,
`game-header.js`. Missing any one breaks auth, scores, or the header.

**Missing header fallback** — The `<header id="gameHeader">` must have inline fallback
HTML/CSS (← + game name). Without it, if `game-header.js` fails to load (stale SW cache),
users see no header and can't navigate back.

**Missing GAME_REGISTRY entry** — The leaderboard, profile, and game catalog API read
from `GAME_REGISTRY`. Without an entry, the game won't appear anywhere except direct URL.

**Unregistered achievements** — If achievement IDs in the game code aren't registered in
`packages/shared/src/lib/constants/achievements.ts`, the API returns 400 "Unknown achievement"
on every unlock attempt. Also add the game slug to `AchievementCategory` type or the build fails.

**Wrong script path** — From `games/<slug>/index.html` use `../../js/`. Using `../js/`
causes a 404 and everything silently breaks.

**Nested comments in JSDoc** — Never use `/* ... */` inside a `/** ... */` block. The
inner `*/` closes the outer comment and causes a SyntaxError in the shared JS file.

**Audio on mobile** — Web Audio API requires a user gesture to start. Never call
`playSound()` on page load. Only call it inside event handlers (click, keydown, touch).
