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
  leaderboard/index.html       ← Leaderboard page (auto-populated from API catalog)
  games/
    <game-slug>/
      index.html               ← The entire game (create this)
  js/
    api-client.js              ← Shared API client (DO NOT MODIFY)
    auth.js                    ← Auth manager + auth nudge (DO NOT MODIFY)
    game-cloud.js              ← Shared auth/score/cloud library (DO NOT MODIFY)
packages/shared/src/
  lib/types/leaderboard.types.ts   ← SubmitScoreDto shape
  lib/constants/scoring.ts         ← SCORING constants, helpers
  lib/constants/game-registry.ts   ← GAME_REGISTRY — single source of truth for all games (ADD ENTRY)
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

### 2.8 Auth + Cloud integration (via game-cloud.js)

All auth state, score submission, cloud save/load, guest score queuing, and achievements
are handled by the shared `game-cloud.js` library. **Do NOT write custom auth polling,
submitScore guards, or cloud state boilerplate** — use the `gameCloud` API instead.

```javascript
// ── AUTH & CLOUD (via shared game-cloud.js) ─────────────────
let currentUser = null;
let cloudState = null;

function initAuth() {
  window.gameCloud.initAuth({
    authBtnId: 'authBtn',        // ID of the sign-in button (or null for custom UI)
    signInStyle: 'name',          // 'name' shows first name, 'button' shows Sign In/Profile
    onSignIn: async (user) => {
      currentUser = user;
      cloudState = await window.gameCloud.loadState('GAME_SLUG');
      // Merge cloud state with local (e.g. sync high score)
      if (cloudState?.additionalData?.highScore > localHighScore) {
        localHighScore = cloudState.additionalData.highScore;
        localStorage.setItem('GAME_SLUG-high-score', localHighScore);
      }
      // If this game uses guest score queuing:
      await window.gameCloud.syncGuestScores('GAME_SLUG');
    },
    onSignOut: () => { currentUser = null; cloudState = null; }
  });
}

// Score submission — gameCloud handles auth guard + guest nudge
async function submitScore() {
  // Option A: Simple submit (skips silently for guests, shows nudge)
  await window.gameCloud.submitScore('GAME_SLUG', {
    score: score,
    level: level,
    timeMs: Date.now() - gameStartTime,
    metadata: { /* game-specific */ }
  });

  // Option B: Submit or queue (for games that store guest scores locally)
  await window.gameCloud.submitOrQueue('GAME_SLUG', scoreData, { silent: false });
}

// Cloud state — gameCloud handles auth guard + error handling
async function saveCloudState(won = false) {
  const prev = cloudState || {};
  const newState = {
    currentLevel: level,
    currentStreak: 0,
    bestStreak: Math.max(prev.bestStreak || 0, level),
    gamesPlayed: (prev.gamesPlayed || 0) + 1,
    gamesWon: (prev.gamesWon || 0) + (won ? 1 : 0),
    lastPlayedDate: new Date().toISOString().split('T')[0],
    additionalData: { highScore, lastScore: score }
  };
  await window.gameCloud.saveState('GAME_SLUG', newState);
  cloudState = newState;

  // Achievements — gameCloud handles auth guard + silent fail
  if (newState.gamesPlayed === 1) window.gameCloud.unlockAchievement('first_game', 'GAME_SLUG');
  if (newState.gamesWon >= 10) window.gameCloud.unlockAchievement('ten_wins', 'GAME_SLUG');
}
```

**gameCloud API reference:**
| Method | Purpose |
|--------|---------|
| `gameCloud.initAuth(opts)` | Auth listener + button management |
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
```

**Critical:** path is `../../js/` — two levels up from `games/<slug>/`. One level
up (`../js/`) will 404.

**Do NOT add Firebase SDK script tags** (`firebase-app-compat.js`, `firebase-auth-compat.js`).
`auth.js` dynamically loads the Firebase SDK automatically. Adding them manually causes
duplicate initialization and inconsistency.

**Do NOT write custom auth polling, submitScore guards, or cloud state boilerplate.**
Use `window.gameCloud.*` methods from `game-cloud.js` instead. See section 2.8.

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
2. Create `apps/web/src/games/GAME_SLUG/index.html` (full game using `game-cloud.js`)
3. Edit `packages/shared/src/lib/constants/game-registry.ts` — add GAME_REGISTRY entry
4. Edit `apps/web/src/index.html` — all 6 changes
5. Edit `apps/web/src/sitemap.xml` — URL entry
6. Rebuild shared: `npx nx run shared:build`

---

## Quality Checklist

- [ ] Game file at correct path `games/<GAME_SLUG>/index.html`
- [ ] Three scripts included: `api-client.js`, `auth.js`, `game-cloud.js` (two levels up: `../../js/`)
- [ ] Auth uses `window.gameCloud.initAuth()` (NOT custom polling/onAuthStateChanged)
- [ ] Score submission uses `window.gameCloud.submitScore()` or `submitOrQueue()` (NOT raw apiClient)
- [ ] Cloud state uses `window.gameCloud.loadState()` / `saveState()` (NOT raw apiClient)
- [ ] Achievements use `window.gameCloud.unlockAchievement()` (NOT raw apiClient)
- [ ] gameId in all `gameCloud.*` calls exactly matches GAME_SLUG (no typos, right case)
- [ ] `GAME_REGISTRY` entry added in `packages/shared/src/lib/constants/game-registry.ts`
- [ ] `ACHIEVEMENTS` object defined with `{ name, desc, icon, xp }` shape
- [ ] `checkAchievements()` called in `onGameEnd()`
- [ ] `showNewAchievements()` called after `checkAchievements()`
- [ ] `playSound()` called for all key game events (move, score, win, fail)
- [ ] `showConfetti()` called on win
- [ ] `showScorePop()` called when points are awarded during gameplay
- [ ] `addXP()` called in `onGameEnd()`
- [ ] "← All Games" back link present
- [ ] Hero badge updated to GAME_NAME
- [ ] NEW tag removed from all previous game cards
- [ ] New game card has `<span class="tag new">NEW</span>` with `data-genres` attribute
- [ ] JSON-LD ItemList updated with correct position number
- [ ] Homepage meta description and keywords mention GAME_NAME
- [ ] Sitemap has new `<url>` entry with `priority 0.9`
- [ ] Deploy date comment updated

---

## Common Mistakes

**Writing custom auth boilerplate** — Do NOT write `setInterval(() => { if (authManager.isInitialized)...`
or `if (!currentUser || !window.apiClient) return` guards. Use `gameCloud.initAuth()` and
`gameCloud.submitScore()` instead — they handle all of this internally.

**Wrong gameId** — The string in `gameCloud.submitScore('GAME_SLUG', ...)` must match the
`GAME_REGISTRY` entry `id` exactly. Any mismatch sends scores to a ghost board.

**Missing game-cloud.js** — Without `game-cloud.js`, `gameCloud` is undefined and all
auth/score/cloud calls fail. Always include all three scripts: `api-client.js`, `auth.js`,
`game-cloud.js`.

**Missing GAME_REGISTRY entry** — The game catalog API and leaderboard/profile pages read
from `GAME_REGISTRY`. Without an entry, the game won't appear in the leaderboard game picker
or profile recent games.

**Wrong script path** — From `games/<slug>/index.html` use `../../js/`. Using `../js/`
causes a 404 and the entire auth + score system silently stops working.

**Hero badge not updated** — Players discover new games through the hero section.
Always update the hero to feature the new game.

**NEW tag left on old games** — Only the current week's game gets the `new` CSS class.
Strip it from every previous card when adding the new one.

**Achievement toast queue** — `activeToasts` tracks vertical stacking. It is a module-level
`let` variable, not scoped inside a function. Declare it at the top of the script block.

**Audio on mobile** — Web Audio API requires a user gesture to start. Never call
`playSound()` on page load. Only call it inside event handlers (click, keydown, touch).
